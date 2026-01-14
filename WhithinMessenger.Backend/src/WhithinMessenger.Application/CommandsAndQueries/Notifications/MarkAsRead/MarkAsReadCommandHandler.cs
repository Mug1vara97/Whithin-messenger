using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkAsRead;

public class MarkAsReadCommandHandler : IRequestHandler<MarkAsReadCommand, MarkAsReadResult>
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IHubContext<Hub> _notificationHub;
    private readonly INotificationService _notificationService;

    public MarkAsReadCommandHandler(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub,
        INotificationService notificationService)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
        _notificationService = notificationService;
    }

    public async Task<MarkAsReadResult> Handle(MarkAsReadCommand request, CancellationToken cancellationToken)
    {
        try
        {
            await _notificationRepository.MarkAsReadAsync(request.NotificationId, request.UserId, cancellationToken);

            var unreadCount = await _notificationService.GetUnreadCountForUserAsync(request.UserId, cancellationToken);
            await _notificationHub.Clients.User(request.UserId.ToString()).SendAsync("UnreadCountChanged", unreadCount, cancellationToken);

            return new MarkAsReadResult { Success = true };
        }
        catch (Exception ex)
        {
            return new MarkAsReadResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}

