using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetPinnedMessages;

public class GetPinnedMessagesQueryHandler : IRequestHandler<GetPinnedMessagesQuery, GetPinnedMessagesResult>
{
    private readonly IMessageRepository _messageRepository;

    public GetPinnedMessagesQueryHandler(IMessageRepository messageRepository)
    {
        _messageRepository = messageRepository;
    }

    public async Task<GetPinnedMessagesResult> Handle(GetPinnedMessagesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var messages = await _messageRepository.GetPinnedByChatIdAsync(request.ChatId, cancellationToken);
            var dtos = messages.Select(m => MessageDtoMapper.Map(m, request.UserId)).ToList();

            return new GetPinnedMessagesResult
            {
                Success = true,
                Messages = dtos,
            };
        }
        catch (Exception ex)
        {
            return new GetPinnedMessagesResult
            {
                Success = false,
                ErrorMessage = ex.Message,
            };
        }
    }
}
