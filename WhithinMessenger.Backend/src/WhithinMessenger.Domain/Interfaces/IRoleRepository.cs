using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IRoleRepository
{
    Task<ServerRole?> GetByIdAsync(Guid roleId, CancellationToken cancellationToken = default);
    Task<List<ServerRole>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default);
    Task<List<ServerRole>> GetUserRolesAsync(Guid userId, Guid serverId, CancellationToken cancellationToken = default);
    Task<bool> UserHasRoleAsync(Guid userId, Guid serverId, Guid roleId, CancellationToken cancellationToken = default);
    Task AssignRoleToUserAsync(Guid userId, Guid roleId, CancellationToken cancellationToken = default);
    Task RemoveRoleFromUserAsync(Guid userId, Guid roleId, CancellationToken cancellationToken = default);
    Task<ServerRole> CreateAsync(ServerRole role, CancellationToken cancellationToken = default);
    Task<ServerRole> UpdateAsync(ServerRole role, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid roleId, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(Guid serverId, string roleName, CancellationToken cancellationToken = default);
}
