using MediatR;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;

public class SendMessageCommandHandler : IRequestHandler<SendMessageCommand, SendMessageResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChatRepository _chatRepository;

    public SendMessageCommandHandler(
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        IChatRepository chatRepository)
    {
        _messageRepository = messageRepository;
        _userRepository = userRepository;
        _chatRepository = chatRepository;
    }

    public async Task<SendMessageResult> Handle(SendMessageCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
            if (user == null)
            {
                return new SendMessageResult
                {
                    Success = false,
                    ErrorMessage = "User not found"
                };
            }

            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new SendMessageResult
                {
                    Success = false,
                    ErrorMessage = "Chat not found"
                };
            }

            var newMessage = new Message
            {
                Id = Guid.NewGuid(),
                ChatId = request.ChatId,
                UserId = request.UserId,
                Content = request.Content,
                CreatedAt = DateTimeOffset.UtcNow,
                RepliedToMessageId = request.RepliedToMessageId,
                ForwardedFromMessageId = request.ForwardedFromMessageId,
                ForwardedByUserId = request.ForwardedFromMessageId.HasValue ? request.UserId : null
            };

            if (request.ForwardedFromMessageId.HasValue)
            {
                var originalMessage = await _messageRepository.GetByIdAsync(request.ForwardedFromMessageId.Value, cancellationToken);
                if (originalMessage != null)
                {
                    newMessage.ForwardedFromChatId = originalMessage.ChatId;
                }
            }

            await _messageRepository.AddAsync(newMessage, cancellationToken);

            return new SendMessageResult
            {
                Success = true,
                MessageId = newMessage.Id
            };
        }
        catch (Exception ex)
        {
            return new SendMessageResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
