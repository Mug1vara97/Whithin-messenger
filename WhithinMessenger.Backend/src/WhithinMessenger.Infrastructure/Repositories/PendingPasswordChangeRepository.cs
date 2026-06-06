using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class PendingPasswordChangeRepository : IPendingPasswordChangeRepository
{
    private readonly WithinDbContext _context;

    public PendingPasswordChangeRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<PendingPasswordChange?> GetByUserIdAndTokenAsync(
        Guid userId,
        string token,
        CancellationToken cancellationToken = default)
    {
        return await _context.PendingPasswordChanges
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Token == token, cancellationToken);
    }

    public async Task ReplaceAsync(
        PendingPasswordChange pendingChange,
        CancellationToken cancellationToken = default)
    {
        var existing = await _context.PendingPasswordChanges
            .Where(x => x.UserId == pendingChange.UserId)
            .ToListAsync(cancellationToken);

        if (existing.Count > 0)
        {
            _context.PendingPasswordChanges.RemoveRange(existing);
        }

        _context.PendingPasswordChanges.Add(pendingChange);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(
        PendingPasswordChange pendingChange,
        CancellationToken cancellationToken = default)
    {
        _context.PendingPasswordChanges.Remove(pendingChange);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
