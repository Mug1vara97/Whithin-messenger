namespace WhithinMessenger.Application.Services;

public interface INotificationService
{
    Task CreateNotificationAsync(Guid userId, Guid chatId, Guid? messageId, string type, string content, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}



