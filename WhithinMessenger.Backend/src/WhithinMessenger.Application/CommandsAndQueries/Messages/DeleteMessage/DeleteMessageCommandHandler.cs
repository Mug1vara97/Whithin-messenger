using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.DeleteMessage;

public class DeleteMessageCommandHandler : IRequestHandler<DeleteMessageCommand, DeleteMessageResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public DeleteMessageCommandHandler(
        IMessageRepository messageRepository,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<DeleteMessageResult> Handle(DeleteMessageCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var message = await _messageRepository.GetByIdAsync(request.MessageId, cancellationToken);

            if (message == null)
            {
                return new DeleteMessageResult
                {
                    Success = false,
                    ErrorMessage = "Message not found"
                };
            }

            var chat = await _chatRepository.GetByIdAsync(message.ChatId, cancellationToken);
            var moderationCheck = await _permissionChecker.ValidateMessageModerationAsync(
                chat?.ServerId,
                request.UserId,
                message.UserId,
                cancellationToken);

            if (!moderationCheck.Allowed)
            {
                return new DeleteMessageResult
                {
                    Success = false,
                    ErrorMessage = moderationCheck.ErrorMessage
                };
            }

            await _messageRepository.DeleteAsync(request.MessageId, cancellationToken);

            return new DeleteMessageResult
            {
                Success = true
            };
        }
        catch (Exception ex)
        {
            return new DeleteMessageResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
