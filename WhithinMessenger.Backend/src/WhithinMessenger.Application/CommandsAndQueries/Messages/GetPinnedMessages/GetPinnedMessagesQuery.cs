using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetPinnedMessages;

public record GetPinnedMessagesQuery(Guid ChatId, Guid? UserId) : IRequest<GetPinnedMessagesResult>;

public class GetPinnedMessagesResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public List<MessageDto> Messages { get; init; } = new();
}
