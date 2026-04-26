namespace WhithinMessenger.Application.Services;

public interface IFirebasePushSender
{
    Task SendChatNotificationAsync(
        string deviceToken,
        Guid chatId,
        string title,
        string message,
        CancellationToken cancellationToken = default
    );

    Task SendIncomingCallNotificationAsync(
        string deviceToken,
        Guid chatId,
        Guid callerId,
        string callerName,
        CancellationToken cancellationToken = default
    );
}
