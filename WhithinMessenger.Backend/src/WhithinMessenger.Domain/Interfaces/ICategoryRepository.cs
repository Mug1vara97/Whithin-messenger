using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface ICategoryRepository
{
    Task<ChatCategory?> GetByIdAsync(Guid categoryId, CancellationToken cancellationToken = default);
    Task<List<ChatCategory>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default);
    Task<ChatCategory> CreateAsync(ChatCategory category, CancellationToken cancellationToken = default);
    Task<ChatCategory> UpdateAsync(ChatCategory category, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid categoryId, CancellationToken cancellationToken = default);
    Task DeleteAllByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(Guid serverId, string categoryName, CancellationToken cancellationToken = default);
}

