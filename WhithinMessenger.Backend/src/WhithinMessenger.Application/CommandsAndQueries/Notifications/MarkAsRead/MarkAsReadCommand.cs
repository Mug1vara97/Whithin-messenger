using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkAsRead;

public record MarkAsReadCommand(
    Guid NotificationId,
    Guid UserId
) : IRequest<MarkAsReadResult>;

public record MarkAsReadResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}



