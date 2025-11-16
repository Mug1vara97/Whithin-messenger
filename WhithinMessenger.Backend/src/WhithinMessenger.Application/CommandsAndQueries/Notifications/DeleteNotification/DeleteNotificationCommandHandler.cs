using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.DeleteNotification;

public class DeleteNotificationCommandHandler : IRequestHandler<DeleteNotificationCommand, DeleteNotificationResult>
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IHubContext<Hub> _notificationHub;
    private readonly INotificationService _notificationService;

    public DeleteNotificationCommandHandler(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub,
        INotificationService notificationService)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
        _notificationService = notificationService;
    }

    public async Task<DeleteNotificationResult> Handle(DeleteNotificationCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var notification = await _notificationRepository.GetByIdAsync(request.NotificationId, cancellationToken);
            if (notification == null || notification.UserId != request.UserId)
            {
                return new DeleteNotificationResult
                {
                    Success = false,
                    ErrorMessage = "Notification not found"
                };
            }

            await _notificationRepository.DeleteAsync(request.NotificationId, cancellationToken);

            var unreadCount = await _notificationService.GetUnreadCountForUserAsync(request.UserId, cancellationToken);
            await _notificationHub.Clients.User(request.UserId.ToString()).SendAsync("UnreadCountChanged", unreadCount, cancellationToken);

            return new DeleteNotificationResult { Success = true };
        }
        catch (Exception ex)
        {
            return new DeleteNotificationResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}

