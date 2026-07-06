using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class UserE2eKeyBackupRepository : IUserE2eKeyBackupRepository
{
    private readonly WithinDbContext _context;

    public UserE2eKeyBackupRepository(WithinDbContext context)
    {
        _context = context;
    }

    public Task<UserE2eKeyBackup?> GetAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return _context.UserE2eKeyBackups
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
    }

    public async Task UpsertAsync(
        Guid userId,
        string payloadJson,
        CancellationToken cancellationToken = default)
    {
        var normalizedPayload = payloadJson.Trim();
        var existing = await _context.UserE2eKeyBackups
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

        if (existing == null)
        {
            _context.UserE2eKeyBackups.Add(new UserE2eKeyBackup
            {
                UserId = userId,
                PayloadJson = normalizedPayload,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            existing.PayloadJson = normalizedPayload;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
