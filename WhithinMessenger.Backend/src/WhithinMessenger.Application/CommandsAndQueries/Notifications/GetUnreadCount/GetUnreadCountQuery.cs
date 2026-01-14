using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.GetUnreadCount;

public record GetUnreadCountQuery(Guid UserId) : IRequest<GetUnreadCountResult>;

public record GetUnreadCountResult
{
    public int UnreadCount { get; init; }
}



