using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.IdeaBoard;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;

public class SendMessageCommandHandler : IRequestHandler<SendMessageCommand, SendMessageResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IUserListCacheService _userListCache;
    private readonly IUserBlockService _userBlockService;

    public SendMessageCommandHandler(
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker,
        IUserListCacheService userListCache,
        IUserBlockService userBlockService)
    {
        _messageRepository = messageRepository;
        _userRepository = userRepository;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
        _userListCache = userListCache;
        _userBlockService = userBlockService;
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

            if (chat.TypeId == IdeaBoardType.TypeId
                || chat.Type?.TypeName == ChatTypeNames.IdeasBoard)
            {
                return new SendMessageResult
                {
                    Success = false,
                    ErrorMessage = "В канал доски нельзя отправлять текстовые сообщения",
                };
            }

            if (chat.ServerId.HasValue)
            {
                if (!await _permissionChecker.HasPermissionAsync(
                        chat.ServerId.Value, request.UserId, "sendMessages", cancellationToken))
                {
                    return new SendMessageResult
                    {
                        Success = false,
                        ErrorMessage = "Недостаточно прав для отправки сообщений"
                    };
                }
            }
            else if (string.Equals(chat.Type?.TypeName, ChatTypeNames.Private, StringComparison.OrdinalIgnoreCase))
            {
                var members = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
                var recipientId = members.FirstOrDefault(memberId => memberId != request.UserId);
                if (recipientId != Guid.Empty
                    && await _userBlockService.IsBlockedByAsync(recipientId, request.UserId, cancellationToken))
                {
                    return new SendMessageResult
                    {
                        Success = false,
                        ErrorMessage = "Вы не можете отправить сообщение этому пользователю"
                    };
                }
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

            if (!chat.ServerId.HasValue)
            {
                await _userListCache.InvalidateChatListForChatAsync(request.ChatId, cancellationToken);
            }

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
