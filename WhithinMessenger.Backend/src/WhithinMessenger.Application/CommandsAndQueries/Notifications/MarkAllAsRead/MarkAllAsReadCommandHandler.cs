using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkAllAsRead;

public class MarkAllAsReadCommandHandler : IRequestHandler<MarkAllAsReadCommand, MarkAllAsReadResult>
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IHubContext<Hub> _notificationHub;
    private readonly INotificationService _notificationService;

    public MarkAllAsReadCommandHandler(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub,
        INotificationService notificationService)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
        _notificationService = notificationService;
    }

    public async Task<MarkAllAsReadResult> Handle(MarkAllAsReadCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var markedIds = await _notificationRepository.MarkAllAsReadAsync(request.UserId, cancellationToken);
            var markedCount = markedIds.Count;

            var unreadCount = await _notificationService.GetUnreadCountForUserAsync(request.UserId, cancellationToken);
            await _notificationHub.Clients.User(request.UserId.ToString())
                .SendAsync("UnreadCountChanged", unreadCount, cancellationToken);

            if (markedCount > 0)
            {
                await _notificationHub.Clients.User(request.UserId.ToString())
                    .SendAsync("AllNotificationsRead", new { markedCount }, cancellationToken);
            }

            return new MarkAllAsReadResult
            {
                Success = true,
                MarkedCount = markedCount,
            };
        }
        catch (Exception ex)
        {
            return new MarkAllAsReadResult
            {
                Success = false,
                ErrorMessage = ex.Message,
            };
        }
    }
}
