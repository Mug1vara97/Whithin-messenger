namespace WhithinMessenger.Application.Services;

public interface INotificationService
{
    Task CreateNotificationAsync(Guid userId, Guid chatId, Guid? messageId, string type, string content, Guid? serverId = null, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}



