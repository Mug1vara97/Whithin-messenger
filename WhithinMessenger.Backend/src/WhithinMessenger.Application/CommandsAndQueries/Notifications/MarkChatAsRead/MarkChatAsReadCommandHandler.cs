using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkChatAsRead;

public class MarkChatAsReadCommandHandler : IRequestHandler<MarkChatAsReadCommand, MarkChatAsReadResult>
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IHubContext<Hub> _notificationHub;
    private readonly INotificationService _notificationService;

    public MarkChatAsReadCommandHandler(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub,
        INotificationService notificationService)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
        _notificationService = notificationService;
    }

    public async Task<MarkChatAsReadResult> Handle(MarkChatAsReadCommand request, CancellationToken cancellationToken)
    {
        try
        {
            await _notificationRepository.MarkChatAsReadAsync(request.ChatId, request.UserId, cancellationToken);

            var unreadCount = await _notificationService.GetUnreadCountForUserAsync(request.UserId, cancellationToken);
            await _notificationHub.Clients.User(request.UserId.ToString()).SendAsync("UnreadCountChanged", unreadCount, cancellationToken);

            return new MarkChatAsReadResult { Success = true };
        }
        catch (Exception ex)
        {
            return new MarkChatAsReadResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}

