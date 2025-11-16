using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.DeleteNotification;

public record DeleteNotificationCommand(
    Guid NotificationId,
    Guid UserId
) : IRequest<DeleteNotificationResult>;

public record DeleteNotificationResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}



