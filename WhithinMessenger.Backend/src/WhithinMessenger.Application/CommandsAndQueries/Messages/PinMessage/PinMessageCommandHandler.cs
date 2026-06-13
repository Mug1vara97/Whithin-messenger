using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.PinMessage;

public class PinMessageCommandHandler : IRequestHandler<PinMessageCommand, PinMessageResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public PinMessageCommandHandler(
        IMessageRepository messageRepository,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<PinMessageResult> Handle(PinMessageCommand request, CancellationToken cancellationToken)
    {
        var message = await _messageRepository.GetByIdAsync(request.MessageId, cancellationToken);
        if (message == null)
        {
            return new PinMessageResult { Success = false, ErrorMessage = "Message not found" };
        }

        var chat = await _chatRepository.GetByIdAsync(message.ChatId, cancellationToken);
        if (chat == null)
        {
            return new PinMessageResult { Success = false, ErrorMessage = "Chat not found" };
        }

        var pinCheck = await _permissionChecker.ValidatePinMessageAsync(
            chat.ServerId,
            request.UserId,
            cancellationToken);

        if (!pinCheck.Allowed)
        {
            return new PinMessageResult { Success = false, ErrorMessage = pinCheck.ErrorMessage };
        }

        if (!chat.ServerId.HasValue)
        {
            var members = await _chatRepository.GetChatMembersAsync(message.ChatId, cancellationToken);
            if (!members.Contains(request.UserId))
            {
                return new PinMessageResult { Success = false, ErrorMessage = "User not authorized" };
            }
        }

        message.IsPinned = true;
        message.PinnedAt = DateTimeOffset.UtcNow;
        message.PinnedByUserId = request.UserId;
        await _messageRepository.UpdateAsync(message, cancellationToken);

        return new PinMessageResult
        {
            Success = true,
            ChatId = message.ChatId,
            PinnedAt = message.PinnedAt,
        };
    }
}
