using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.EditMessage;

public class EditMessageCommandHandler : IRequestHandler<EditMessageCommand, EditMessageResult>
{
    private readonly IMessageRepository _messageRepository;

    public EditMessageCommandHandler(IMessageRepository messageRepository)
    {
        _messageRepository = messageRepository;
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

            if (message.UserId != request.UserId)
            {
                return new EditMessageResult
                {
                    Success = false,
                    ErrorMessage = "User not authorized to edit this message"
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
