namespace WhithinMessenger.Application.Services;

public interface IUserBlockService
{
    Task<bool> IsBlockedByAsync(Guid blockerId, Guid blockedUserId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetBlockedUserIdsAsync(Guid blockerId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetBlockerUserIdsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> ShouldHidePresenceAsync(Guid viewerId, Guid targetUserId, CancellationToken cancellationToken = default);
}
