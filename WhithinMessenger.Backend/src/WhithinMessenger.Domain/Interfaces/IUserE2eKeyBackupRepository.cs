using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IUserE2eKeyBackupRepository
{
    Task<UserE2eKeyBackup?> GetAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task UpsertAsync(
        Guid userId,
        string payloadJson,
        CancellationToken cancellationToken = default);
}
