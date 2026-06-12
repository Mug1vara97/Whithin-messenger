using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.EditMessage;

public class EditMessageCommandHandler : IRequestHandler<EditMessageCommand, EditMessageResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public EditMessageCommandHandler(
        IMessageRepository messageRepository,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<EditMessageResult> Handle(EditMessageCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var message = await _messageRepository.GetByIdAsync(request.MessageId, cancellationToken);

            if (message == null)
            {
                return new EditMessageResult
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
                return new EditMessageResult
                {
                    Success = false,
                    ErrorMessage = moderationCheck.ErrorMessage
                };
            }

            message.Content = request.NewContent;
            await _messageRepository.UpdateAsync(message, cancellationToken);

            return new EditMessageResult
            {
                Success = true
            };
        }
        catch (Exception ex)
        {
            return new EditMessageResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
