using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessageById;

public class GetMessageByIdQueryHandler : IRequestHandler<GetMessageByIdQuery, GetMessageByIdResult>
{
    private readonly IMessageRepository _messageRepository;

    public GetMessageByIdQueryHandler(IMessageRepository messageRepository)
    {
        _messageRepository = messageRepository;
    }

    public async Task<GetMessageByIdResult> Handle(GetMessageByIdQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var message = await _messageRepository.GetByIdAsync(request.MessageId, cancellationToken);
            
            if (message == null)
            {
                return new GetMessageByIdResult
                {
                    Success = false,
                    ErrorMessage = "Message not found"
                };
            }

            return new GetMessageByIdResult
            {
                Success = true,
                Message = message
            };
        }
        catch (Exception ex)
        {
            return new GetMessageByIdResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
























