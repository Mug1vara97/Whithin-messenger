using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public class GetMessagesQueryHandler : IRequestHandler<GetMessagesQuery, GetMessagesResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;

    public GetMessagesQueryHandler(IMessageRepository messageRepository, IChatRepository chatRepository)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
    }

    public async Task<GetMessagesResult> Handle(GetMessagesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var limit = request.Limit > 0 ? request.Limit : 0;
            Task<int> memberCountTask =
                _chatRepository.GetChatMemberCountAsync(request.ChatId, cancellationToken);

            List<Message> messages;
            var hasMoreOlder = false;

            if (limit > 0)
            {
                var pageTask = _messageRepository.GetByChatIdPageWithHasMoreAsync(
                    request.ChatId,
                    limit,
                    request.BeforeMessageId,
                    cancellationToken);
                await Task.WhenAll(pageTask, memberCountTask);
                (messages, hasMoreOlder) = await pageTask;
            }
            else
            {
                var allMessagesTask = _messageRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
                await Task.WhenAll(allMessagesTask, memberCountTask);
                messages = await allMessagesTask;
            }

            var recipientCount = Math.Max(0, await memberCountTask - 1);
            var ownMessageIds = request.UserId.HasValue
                ? messages
                    .Where(m => m.UserId == request.UserId.Value)
                    .Select(m => m.Id)
                    .ToList()
                : [];

            Dictionary<Guid, string> statuses = new();
            if (request.UserId.HasValue && ownMessageIds.Count > 0 && recipientCount > 0)
            {
                statuses = await _messageRepository.GetMessageStatusesAsync(
                    request.UserId.Value,
                    ownMessageIds,
                    recipientCount,
                    cancellationToken);
            }

            var messageDtos = messages.Select(m =>
            {
                var dto = MessageDtoMapper.Map(m, request.UserId);
                if (request.UserId.HasValue && m.UserId == request.UserId.Value)
                {
                    dto.Status = statuses.GetValueOrDefault(m.Id, MessageStatusHelper.Sent);
                }
                return dto;
            }).ToList();

            return new GetMessagesResult
            {
                Success = true,
                Messages = messageDtos,
                HasMoreOlder = hasMoreOlder,
            };
        }
        catch (Exception ex)
        {
            return new GetMessagesResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
