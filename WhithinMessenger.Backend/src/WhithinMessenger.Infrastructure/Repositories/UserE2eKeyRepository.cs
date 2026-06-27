using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class UserE2eKeyRepository : IUserE2eKeyRepository
{
    private readonly WithinDbContext _context;

    public UserE2eKeyRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task UpsertAsync(UserE2eDeviceKey key, CancellationToken cancellationToken = default)
    {
        var existing = await _context.UserE2eDeviceKeys
            .FirstOrDefaultAsync(
                k => k.UserId == key.UserId && k.DeviceId == key.DeviceId,
                cancellationToken);

        if (existing == null)
        {
            _context.UserE2eDeviceKeys.Add(key);
        }
        else
        {
            existing.PublicKeyBase64 = key.PublicKeyBase64;
            existing.UpdatedAt = key.UpdatedAt;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public Task<UserE2eDeviceKey?> GetPrimaryAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return _context.UserE2eDeviceKeys
            .AsNoTracking()
            .Where(k => k.UserId == userId)
            .OrderByDescending(k => k.DeviceId == "default")
            .ThenByDescending(k => k.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task<UserE2eDeviceKey?> GetByDeviceAsync(
        Guid userId,
        string deviceId,
        CancellationToken cancellationToken = default)
    {
        var normalizedDeviceId = deviceId.Trim();
        return _context.UserE2eDeviceKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(
                k => k.UserId == userId && k.DeviceId == normalizedDeviceId,
                cancellationToken);
    }

    public Task<bool> HasKeyAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return _context.UserE2eDeviceKeys.AnyAsync(k => k.UserId == userId, cancellationToken);
    }
}
