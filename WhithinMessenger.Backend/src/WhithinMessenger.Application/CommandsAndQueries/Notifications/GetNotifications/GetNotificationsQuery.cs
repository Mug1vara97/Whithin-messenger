using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.GetNotifications;

public record GetNotificationsQuery(
    Guid UserId,
    int Page = 1,
    int PageSize = 20,
    bool UnreadOnly = true
) : IRequest<GetNotificationsResult>;

public record GetNotificationsResult
{
    public List<NotificationDto> Notifications { get; init; } = new();
}



