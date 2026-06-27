using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IFriendshipRepository
{
    Task<Friendship?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<Friendship?> GetByUsersAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default);
    
    Task<IEnumerable<Friendship>> GetFriendsAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<IEnumerable<Friendship>> GetPendingRequestsAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<IEnumerable<Friendship>> GetSentRequestsAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<Friendship> CreateAsync(Friendship friendship, CancellationToken cancellationToken = default);
    
    Task<Friendship> UpdateAsync(Friendship friendship, CancellationToken cancellationToken = default);
    
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<bool> AreFriendsAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default);
    
    Task<bool> HasPendingRequestAsync(Guid requesterId, Guid addresseeId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetBlockedUserIdsAsync(Guid blockerId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetBlockerUserIdsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> IsBlockedByAsync(Guid blockerId, Guid blockedUserId, CancellationToken cancellationToken = default);

    Task<IEnumerable<Friendship>> GetBlockedFriendshipsAsync(Guid blockerId, CancellationToken cancellationToken = default);
}








