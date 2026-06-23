using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.CreatePoll;

public class CreatePollCommandHandler : IRequestHandler<CreatePollCommand, CreatePollResult>
{
    private const int MaxOptions = 10;
    private const int MinOptions = 2;

    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public CreatePollCommandHandler(
        IMessageRepository messageRepository,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<CreatePollResult> Handle(CreatePollCommand request, CancellationToken cancellationToken)
    {
        var question = request.Question?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(question))
        {
            return new CreatePollResult { Success = false, ErrorMessage = "Введите вопрос опроса" };
        }

        var options = request.Options
            .Select(o => o?.Trim() ?? string.Empty)
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(MaxOptions)
            .ToList();

        if (options.Count < MinOptions)
        {
            return new CreatePollResult { Success = false, ErrorMessage = "Добавьте минимум 2 варианта ответа" };
        }

        var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
        if (chat == null)
        {
            return new CreatePollResult { Success = false, ErrorMessage = "Chat not found" };
        }

        var chatTypeName = chat.Type?.TypeName ?? string.Empty;
        if (string.Equals(chatTypeName, ChatTypeNames.Private, StringComparison.OrdinalIgnoreCase))
        {
            return new CreatePollResult { Success = false, ErrorMessage = "Опросы недоступны в личных чатах" };
        }

        if (!string.Equals(chatTypeName, ChatTypeNames.Group, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(chatTypeName, ChatTypeNames.TextChannel, StringComparison.OrdinalIgnoreCase))
        {
            return new CreatePollResult
            {
                Success = false,
                ErrorMessage = "Опросы доступны только в групповых чатах и текстовых каналах сервера",
            };
        }

        if (chat.ServerId.HasValue &&
            !await _permissionChecker.HasPermissionAsync(chat.ServerId.Value, request.UserId, "sendMessages", cancellationToken))
        {
            return new CreatePollResult { Success = false, ErrorMessage = "Недостаточно прав для отправки сообщений" };
        }

        var messageId = Guid.NewGuid();
        var pollId = Guid.NewGuid();

        var message = new Message
        {
            Id = messageId,
            ChatId = request.ChatId,
            UserId = request.UserId,
            Content = question,
            ContentType = "poll",
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var poll = new MessagePoll
        {
            Id = pollId,
            MessageId = messageId,
            Question = question,
            AllowMultiple = request.AllowMultiple,
            IsAnonymous = request.IsAnonymous,
            Options = options.Select((text, index) => new PollOption
            {
                Id = Guid.NewGuid(),
                PollId = pollId,
                Text = text,
                SortOrder = index,
            }).ToList(),
        };

        message.Poll = poll;
        await _messageRepository.AddAsync(message, cancellationToken);

        return new CreatePollResult
        {
            Success = true,
            MessageId = messageId,
        };
    }
}
