using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public interface IServerMemberRepository
    {
        Task<ServerMember?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<ServerMember?> GetByServerAndUserAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<ServerMember>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default);
        Task<List<ServerMember>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
        Task CreateAsync(ServerMember serverMember, CancellationToken cancellationToken = default);
        Task UpdateAsync(ServerMember serverMember, CancellationToken cancellationToken = default);
        Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
        Task DeleteByServerAndUserAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
        Task RemoveAllMembersAsync(Guid serverId, CancellationToken cancellationToken = default);
        Task AddAsync(ServerMember serverMember, CancellationToken cancellationToken = default);
        Task RemoveAsync(ServerMember serverMember, CancellationToken cancellationToken = default);
        Task<bool> IsUserMemberAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<ServerMemberInfo>> GetServerMembersAsync(Guid serverId, CancellationToken cancellationToken = default);
    }
}