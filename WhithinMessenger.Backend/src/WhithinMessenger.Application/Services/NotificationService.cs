using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

// Используем базовый Hub класс для избежания зависимости от конкретной реализации
public class NotificationService : INotificationService
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IHubContext<Hub> _notificationHub;
    private readonly IUserPushTokenStore _userPushTokenStore;
    private readonly IFirebasePushSender _firebasePushSender;

    public NotificationService(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub,
        IUserPushTokenStore userPushTokenStore,
        IFirebasePushSender firebasePushSender)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
        _userPushTokenStore = userPushTokenStore;
        _firebasePushSender = firebasePushSender;
    }

    public async Task CreateNotificationAsync(
        Guid userId,
        Guid chatId,
        Guid? messageId,
        string type,
        string content,
        Guid? serverId = null,
        CancellationToken cancellationToken = default)
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
                serverId = serverId,
                messageId = notification.MessageId,
                type = notification.Type,
                content = notification.Content,
                isRead = notification.IsRead,
                createdAt = notification.CreatedAt
            }, cancellationToken);

            var unreadCount = await GetUnreadCountForUserAsync(userId, cancellationToken);
            await _notificationHub.Clients.User(userId.ToString()).SendAsync("UnreadCountChanged", unreadCount, cancellationToken);

            await SendPushToRegisteredDevicesAsync(
                userId: userId,
                chatId: chatId,
                type: type,
                content: content,
                cancellationToken: cancellationToken
            );

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

    public async Task SendIncomingCallPushAsync(
        Guid userId,
        Guid chatId,
        Guid callerId,
        string callerName,
        CancellationToken cancellationToken = default)
    {
        var tokens = await _userPushTokenStore.GetTokensAsync(userId, cancellationToken);
        if (tokens.Count == 0)
        {
            return;
        }

        foreach (var token in tokens)
        {
            try
            {
                await _firebasePushSender.SendIncomingCallNotificationAsync(
                    deviceToken: token,
                    chatId: chatId,
                    callerId: callerId,
                    callerName: callerName,
                    cancellationToken: cancellationToken
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Incoming-call push failed for user {userId}: {ex.Message}");
            }
        }
    }

    private async Task SendPushToRegisteredDevicesAsync(
        Guid userId,
        Guid chatId,
        string type,
        string content,
        CancellationToken cancellationToken
    )
    {
        var tokens = await _userPushTokenStore.GetTokensAsync(userId, cancellationToken);
        if (tokens.Count == 0)
        {
            return;
        }

        var title = type switch
        {
            "direct_message" => "New message",
            "group_message" => "New message in group",
            _ => "Whithin"
        };

        foreach (var token in tokens)
        {
            try
            {
                await _firebasePushSender.SendChatNotificationAsync(
                    deviceToken: token,
                    chatId: chatId,
                    title: title,
                    message: content,
                    cancellationToken: cancellationToken
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Push send failed for user {userId}: {ex.Message}");
            }
        }
    }
}

