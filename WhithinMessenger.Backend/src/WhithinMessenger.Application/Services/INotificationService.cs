namespace WhithinMessenger.Application.Services;

public interface INotificationService
{
    Task CreateNotificationAsync(
        Guid userId,
        Guid chatId,
        Guid? messageId,
        string type,
        string content,
        Guid? serverId = null,
        string? chatDisplayName = null,
        CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountForUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task SendIncomingCallPushAsync(Guid userId, Guid chatId, Guid callerId, string callerName, CancellationToken cancellationToken = default);

    Task SendFriendRequestPushAsync(
        Guid addresseeId,
        Guid requestId,
        Guid senderId,
        string senderUsername,
        CancellationToken cancellationToken = default);
}



