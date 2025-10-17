using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.SearchMessages;

public record SearchMessagesQuery(Guid ChatId, string Query) : IRequest<SearchMessagesResult>;

public record SearchMessagesResult
{
    public bool Success { get; init; }
    public List<MessageDto> Messages { get; init; } = new();
    public string? ErrorMessage { get; init; }
}

