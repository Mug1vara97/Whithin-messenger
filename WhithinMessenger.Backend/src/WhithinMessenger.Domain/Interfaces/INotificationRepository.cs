using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface INotificationRepository
{
    Task<Notification?> GetByIdAsync(Guid notificationId, CancellationToken cancellationToken = default);
    Task<List<NotificationDto>> GetNotificationsAsync(Guid userId, int page, int pageSize, bool unreadOnly, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
    Task CreateAsync(Notification notification, CancellationToken cancellationToken = default);
    Task UpdateAsync(Notification notification, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid notificationId, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(Guid notificationId, Guid userId, CancellationToken cancellationToken = default);
    Task MarkChatAsReadAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default);
}

public class NotificationDto
{
    public Guid Id { get; init; }
    public Guid ChatId { get; init; }
    public Guid? MessageId { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public bool IsRead { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ReadAt { get; init; }
    public string? ChatName { get; init; }
    public string? SenderName { get; init; }
    public string? MessageContent { get; init; }
}



