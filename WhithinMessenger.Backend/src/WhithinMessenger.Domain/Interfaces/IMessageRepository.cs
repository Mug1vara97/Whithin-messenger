using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public record MarkedMessageReadReceipt(Guid MessageId, Guid SenderUserId);

    public record MessageDeliveryReceipt(Guid ChatId, Guid MessageId);

    public interface IMessageRepository
    {
        Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default);
        Task<List<Message>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default);
        Task<Message> AddAsync(Message message, CancellationToken cancellationToken = default);
        Task<Message> UpdateAsync(Message message, CancellationToken cancellationToken = default);
        Task DeleteAsync(Guid messageId, CancellationToken cancellationToken = default);
        Task<int> GetUnreadCountByChatAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<MarkedMessageReadReceipt>> MarkChatAsReadAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default);
        Task<bool> MarkMessageDeliveredAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<MessageDeliveryReceipt>> AcknowledgePendingDeliveriesForUserAsync(
            Guid userId,
            CancellationToken cancellationToken = default);
        Task<bool> MarkMessageReadAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default);
        Task<string?> GetMessageStatusAsync(Guid messageId, Guid senderUserId, int recipientCount, CancellationToken cancellationToken = default);
        Task<Dictionary<Guid, string>> GetMessageStatusesAsync(
            Guid senderUserId,
            IReadOnlyList<Guid> messageIds,
            int recipientCount,
            CancellationToken cancellationToken = default);
    }
}
