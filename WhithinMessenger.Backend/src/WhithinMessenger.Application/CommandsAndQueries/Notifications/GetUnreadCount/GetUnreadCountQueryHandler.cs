using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.GetUnreadCount;

public class GetUnreadCountQueryHandler : IRequestHandler<GetUnreadCountQuery, GetUnreadCountResult>
{
    private readonly INotificationRepository _notificationRepository;

    public GetUnreadCountQueryHandler(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task<GetUnreadCountResult> Handle(GetUnreadCountQuery request, CancellationToken cancellationToken)
    {
        var count = await _notificationRepository.GetUnreadCountAsync(request.UserId, cancellationToken);
        return new GetUnreadCountResult { UnreadCount = count };
    }
}



