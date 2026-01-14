using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

// Используем базовый Hub класс для избежания зависимости от конкретной реализации
public class NotificationService : INotificationService
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IHubContext<Hub> _notificationHub;

    public NotificationService(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
    }

    public async Task CreateNotificationAsync(Guid userId, Guid chatId, Guid? messageId, string type, string content, CancellationToken cancellationToken = default)
    {
        try
        {
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ChatId = chatId,
                MessageId = messageId,
                Type = type,
                Content = content,
                IsRead = false,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _notificationRepository.CreateAsync(notification, cancellationToken);

            await _notificationHub.Clients.User(userId.ToString()).SendAsync("ReceiveNotification", new
            {
                notificationId = notification.Id,
                chatId = notification.ChatId,
                messageId = notification.MessageId,
                type = notification.Type,
                content = notification.Content,
                isRead = notification.IsRead,
                createdAt = notification.CreatedAt
            }, cancellationToken);

            var unreadCount = await GetUnreadCountForUserAsync(userId, cancellationToken);
            await _notificationHub.Clients.User(userId.ToString()).SendAsync("UnreadCountChanged", unreadCount, cancellationToken);

            Console.WriteLine($"Created notification for user {userId}: {content}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error creating notification: {ex.Message}");
        }
    }

    public async Task<int> GetUnreadCountForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _notificationRepository.GetUnreadCountAsync(userId, cancellationToken);
    }
}

