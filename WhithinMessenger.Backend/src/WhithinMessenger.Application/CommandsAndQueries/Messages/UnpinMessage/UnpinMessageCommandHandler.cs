using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.UnpinMessage;

public class UnpinMessageCommandHandler : IRequestHandler<UnpinMessageCommand, UnpinMessageResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public UnpinMessageCommandHandler(
        IMessageRepository messageRepository,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<UnpinMessageResult> Handle(UnpinMessageCommand request, CancellationToken cancellationToken)
    {
        var message = await _messageRepository.GetByIdAsync(request.MessageId, cancellationToken);
        if (message == null)
        {
            return new UnpinMessageResult { Success = false, ErrorMessage = "Message not found" };
        }

        if (!message.IsPinned)
        {
            return new UnpinMessageResult { Success = true, ChatId = message.ChatId };
        }

        var chat = await _chatRepository.GetByIdAsync(message.ChatId, cancellationToken);
        if (chat == null)
        {
            return new UnpinMessageResult { Success = false, ErrorMessage = "Chat not found" };
        }

        var pinCheck = await _permissionChecker.ValidatePinMessageAsync(
            chat.ServerId,
            request.UserId,
            cancellationToken);

        if (!pinCheck.Allowed)
        {
            return new UnpinMessageResult { Success = false, ErrorMessage = pinCheck.ErrorMessage };
        }

        if (!chat.ServerId.HasValue)
        {
            var members = await _chatRepository.GetChatMembersAsync(message.ChatId, cancellationToken);
            if (!members.Contains(request.UserId))
            {
                return new UnpinMessageResult { Success = false, ErrorMessage = "User not authorized" };
            }
        }

        message.IsPinned = false;
        message.PinnedAt = null;
        message.PinnedByUserId = null;
        await _messageRepository.UpdateAsync(message, cancellationToken);

        return new UnpinMessageResult
        {
            Success = true,
            ChatId = message.ChatId,
        };
    }
}
