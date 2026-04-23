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
}
