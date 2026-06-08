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
}
