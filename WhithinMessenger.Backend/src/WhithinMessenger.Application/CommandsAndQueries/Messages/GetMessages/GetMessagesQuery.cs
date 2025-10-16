using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public record GetMessagesQuery(Guid ChatId) : IRequest<GetMessagesResult>;

public record GetMessagesResult
{
    public bool Success { get; init; }
    public List<MessageDto> Messages { get; init; } = new();
    public string? ErrorMessage { get; init; }
}
























