using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public interface IMessageRepository
    {
        Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default);
        Task<List<Message>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default);
        Task<Message> AddAsync(Message message, CancellationToken cancellationToken = default);
        Task<Message> UpdateAsync(Message message, CancellationToken cancellationToken = default);
        Task DeleteAsync(Guid messageId, CancellationToken cancellationToken = default);
    }
}
























