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
        string? chatDisplayName = null,
        string? serverDisplayName = null,
        string? senderDisplayName = null,
        string? senderAvatarUrl = null,
        string? senderAvatarColor = null,
        string? pushMessageType = null,
        string? pushPreviewText = null,
        string? pushThumbnailUrl = null,
        Guid? senderId = null,
        int encryptionVersion = 0,
        string? encryptedMessageContent = null,
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
                serverName = serverDisplayName,
                chatName = chatDisplayName,
                senderName = senderDisplayName,
                senderAvatarUrl = senderAvatarUrl,
                senderAvatarColor = senderAvatarColor,
                messageId = notification.MessageId,
                type = notification.Type,
                content = notification.Content,
                messageContent = encryptionVersion > 0 ? encryptedMessageContent : null,
                encryptionVersion = encryptionVersion,
                senderId = senderId,
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
                serverId: serverId,
                chatDisplayName: chatDisplayName,
                senderDisplayName: senderDisplayName,
                senderAvatarUrl: senderAvatarUrl,
                senderAvatarColor: senderAvatarColor,
                serverDisplayName: serverDisplayName,
                pushMessageType: pushMessageType,
                pushPreviewText: pushPreviewText,
                pushThumbnailUrl: pushThumbnailUrl,
                senderId: senderId,
                encryptionVersion: encryptionVersion,
                encryptedMessageContent: encryptedMessageContent,
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
        string? callerAvatar = null,
        string? callerAvatarColor = null,
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
                    callerAvatar: callerAvatar,
                    callerAvatarColor: callerAvatarColor,
                    cancellationToken: cancellationToken
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Incoming-call push failed for user {userId}: {ex.Message}");
            }
        }
    }

    public async Task SendIncomingCallDismissedPushAsync(
        Guid userId,
        Guid chatId,
        string reason,
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
                await _firebasePushSender.SendIncomingCallDismissedAsync(
                    deviceToken: token,
                    chatId: chatId,
                    reason: reason,
                    cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Incoming-call dismiss push failed for user {userId}: {ex.Message}");
            }
        }
    }

    public async Task SendFriendRequestPushAsync(
        Guid addresseeId,
        Guid requestId,
        Guid senderId,
        string senderUsername,
        CancellationToken cancellationToken = default)
    {
        var tokens = await _userPushTokenStore.GetTokensAsync(addresseeId, cancellationToken);
        if (tokens.Count == 0)
        {
            return;
        }

        foreach (var token in tokens)
        {
            try
            {
                await _firebasePushSender.SendFriendRequestNotificationAsync(
                    deviceToken: token,
                    requestId: requestId,
                    senderId: senderId,
                    senderUsername: senderUsername,
                    cancellationToken: cancellationToken
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Friend-request push failed for user {addresseeId}: {ex.Message}");
            }
        }
    }

    private async Task SendPushToRegisteredDevicesAsync(
        Guid userId,
        Guid chatId,
        string type,
        string content,
        Guid? serverId,
        string? chatDisplayName,
        string? senderDisplayName,
        string? senderAvatarUrl,
        string? senderAvatarColor,
        string? serverDisplayName,
        string? pushMessageType,
        string? pushPreviewText,
        string? pushThumbnailUrl,
        Guid? senderId,
        int encryptionVersion,
        string? encryptedMessageContent,
        CancellationToken cancellationToken
    )
    {
        var tokens = await _userPushTokenStore.GetTokensAsync(userId, cancellationToken);
        if (tokens.Count == 0)
        {
            return;
        }

        var resolvedChatTitle = !string.IsNullOrWhiteSpace(chatDisplayName)
            ? chatDisplayName.Trim()
            : type switch
            {
                "direct_message" => "New message",
                "group_message" => "New message in group",
                "server_message" => "New message in channel",
                _ => "Whithin"
            };

        foreach (var token in tokens)
        {
            try
            {
                await _firebasePushSender.SendChatNotificationAsync(
                    deviceToken: token,
                    chatId: chatId,
                    title: resolvedChatTitle,
                    message: content,
                    messageType: pushMessageType,
                    previewText: pushPreviewText,
                    thumbnailUrl: pushThumbnailUrl,
                    senderUsername: senderDisplayName,
                    senderAvatarUrl: senderAvatarUrl,
                    senderAvatarColor: senderAvatarColor,
                    serverName: serverDisplayName,
                    serverId: serverId,
                    notificationType: type,
                    senderId: senderId,
                    encryptionVersion: encryptionVersion,
                    encryptedMessageContent: encryptedMessageContent,
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

