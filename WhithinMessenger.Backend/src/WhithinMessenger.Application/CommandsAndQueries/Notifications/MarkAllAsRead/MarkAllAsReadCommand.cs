using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkAllAsRead;

public record MarkAllAsReadCommand(Guid UserId) : IRequest<MarkAllAsReadResult>;

public record MarkAllAsReadResult
{
    public bool Success { get; init; }
    public int MarkedCount { get; init; }
    public string? ErrorMessage { get; init; }
}
