using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkChatAsRead;

public record MarkChatAsReadCommand(
    Guid ChatId,
    Guid UserId
) : IRequest<MarkChatAsReadResult>;

public record MarkChatAsReadResult
{
    public bool Success { get; init; }
    public int MarkedCount { get; init; }
    public string? ErrorMessage { get; init; }
}



