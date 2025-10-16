using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IMemberRepository
{
    Task<ServerMember?> GetByIdAsync(Guid memberId, CancellationToken cancellationToken = default);
    Task<List<ServerMember>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default);
    Task<List<ServerMember>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<ServerMember> CreateAsync(ServerMember member, CancellationToken cancellationToken = default);
    Task<ServerMember> UpdateAsync(ServerMember member, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid memberId, CancellationToken cancellationToken = default);
    Task<bool> IsMemberAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default);
}
