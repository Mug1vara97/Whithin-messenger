using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.DeleteMessage;

public class DeleteMessageCommandHandler : IRequestHandler<DeleteMessageCommand, DeleteMessageResult>
{
    private readonly IMessageRepository _messageRepository;

    public DeleteMessageCommandHandler(IMessageRepository messageRepository)
    {
        _messageRepository = messageRepository;
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
