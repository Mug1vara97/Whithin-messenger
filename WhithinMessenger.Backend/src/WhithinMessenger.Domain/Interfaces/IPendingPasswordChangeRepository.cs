using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IPendingPasswordChangeRepository
{
    Task<PendingPasswordChange?> GetByUserIdAndTokenAsync(
        Guid userId,
        string token,
        CancellationToken cancellationToken = default);

    Task ReplaceAsync(
        PendingPasswordChange pendingChange,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(PendingPasswordChange pendingChange, CancellationToken cancellationToken = default);
}
