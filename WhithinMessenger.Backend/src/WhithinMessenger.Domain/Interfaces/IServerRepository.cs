using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IServerRepository
{
    Task<Server?> GetByIdAsync(Guid serverId, CancellationToken cancellationToken = default);
    Task<Server?> GetByIdWithCategoriesAsync(Guid serverId, CancellationToken cancellationToken = default);
    Task<List<Server>> GetUserServersAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Server> CreateAsync(Server server, CancellationToken cancellationToken = default);
    Task<Server> UpdateAsync(Server server, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid serverId, CancellationToken cancellationToken = default);
    Task<bool> UserHasAccessAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default);
    Task<bool> IsUserMemberAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default);
    Task<List<Server>> GetPublicServersAsync(CancellationToken cancellationToken = default);
}