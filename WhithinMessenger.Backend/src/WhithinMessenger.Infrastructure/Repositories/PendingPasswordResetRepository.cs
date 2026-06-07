using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class PendingPasswordResetRepository : IPendingPasswordResetRepository
{
    private readonly WithinDbContext _context;

    public PendingPasswordResetRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<PendingPasswordReset?> GetByUserIdAndTokenAsync(
        Guid userId,
        string token,
        CancellationToken cancellationToken = default)
    {
        return await _context.PendingPasswordResets
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Token == token, cancellationToken);
    }

    public async Task ReplaceAsync(
        PendingPasswordReset pendingReset,
        CancellationToken cancellationToken = default)
    {
        var existing = await _context.PendingPasswordResets
            .Where(x => x.UserId == pendingReset.UserId)
            .ToListAsync(cancellationToken);

        if (existing.Count > 0)
        {
            _context.PendingPasswordResets.RemoveRange(existing);
        }

        _context.PendingPasswordResets.Add(pendingReset);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(
        PendingPasswordReset pendingReset,
        CancellationToken cancellationToken = default)
    {
        _context.PendingPasswordResets.Remove(pendingReset);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
