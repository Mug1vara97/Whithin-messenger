using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.Services;

public class UserBlockService : IUserBlockService
{
    private readonly IFriendshipRepository _friendshipRepository;

    public UserBlockService(IFriendshipRepository friendshipRepository)
    {
        _friendshipRepository = friendshipRepository;
    }

    public Task<bool> IsBlockedByAsync(Guid blockerId, Guid blockedUserId, CancellationToken cancellationToken = default) =>
        _friendshipRepository.IsBlockedByAsync(blockerId, blockedUserId, cancellationToken);

    public Task<IReadOnlyList<Guid>> GetBlockedUserIdsAsync(Guid blockerId, CancellationToken cancellationToken = default) =>
        _friendshipRepository.GetBlockedUserIdsAsync(blockerId, cancellationToken);

    public Task<IReadOnlyList<Guid>> GetBlockerUserIdsAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _friendshipRepository.GetBlockerUserIdsAsync(userId, cancellationToken);

    public async Task<bool> ShouldHidePresenceAsync(
        Guid viewerId,
        Guid targetUserId,
        CancellationToken cancellationToken = default)
    {
        if (viewerId == targetUserId)
        {
            return false;
        }

        if (await _friendshipRepository.IsBlockedByAsync(targetUserId, viewerId, cancellationToken))
        {
            return true;
        }

        if (await _friendshipRepository.IsBlockedByAsync(viewerId, targetUserId, cancellationToken))
        {
            return true;
        }

        return false;
    }
}
