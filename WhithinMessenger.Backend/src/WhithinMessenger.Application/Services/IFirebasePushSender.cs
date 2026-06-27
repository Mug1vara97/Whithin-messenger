namespace WhithinMessenger.Application.Services;

public interface IFirebasePushSender
{
    Task SendChatNotificationAsync(
        string deviceToken,
        Guid chatId,
        string title,
        string message,
        string? messageType = null,
        string? previewText = null,
        string? thumbnailUrl = null,
        string? senderUsername = null,
        string? senderAvatarUrl = null,
        string? senderAvatarColor = null,
        string? serverName = null,
        Guid? serverId = null,
        string? notificationType = null,
        Guid? senderId = null,
        int encryptionVersion = 0,
        string? encryptedMessageContent = null,
        CancellationToken cancellationToken = default
    );

    Task SendIncomingCallNotificationAsync(
        string deviceToken,
        Guid chatId,
        Guid callerId,
        string callerName,
        string? callerAvatar = null,
        string? callerAvatarColor = null,
        CancellationToken cancellationToken = default
    );

    Task SendFriendRequestNotificationAsync(
        string deviceToken,
        Guid requestId,
        Guid senderId,
        string senderUsername,
        CancellationToken cancellationToken = default
    );

    Task SendIncomingCallDismissedAsync(
        string deviceToken,
        Guid chatId,
        string reason,
        CancellationToken cancellationToken = default
    );
}
