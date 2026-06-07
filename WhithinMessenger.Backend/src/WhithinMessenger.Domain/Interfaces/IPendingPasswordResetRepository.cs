using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IPendingPasswordResetRepository
{
    Task<PendingPasswordReset?> GetByUserIdAndTokenAsync(
        Guid userId,
        string token,
        CancellationToken cancellationToken = default);

    Task ReplaceAsync(
        PendingPasswordReset pendingReset,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        PendingPasswordReset pendingReset,
        CancellationToken cancellationToken = default);
}
