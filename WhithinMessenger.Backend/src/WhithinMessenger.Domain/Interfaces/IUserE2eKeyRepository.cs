using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IUserE2eKeyRepository
{
    Task UpsertAsync(UserE2eDeviceKey key, CancellationToken cancellationToken = default);

    Task<UserE2eDeviceKey?> GetPrimaryAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> HasKeyAsync(Guid userId, CancellationToken cancellationToken = default);
}
