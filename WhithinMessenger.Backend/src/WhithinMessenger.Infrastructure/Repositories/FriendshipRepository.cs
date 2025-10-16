using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class FriendshipRepository : IFriendshipRepository
{
    private readonly WithinDbContext _context;

    public FriendshipRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<Friendship?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
    }

    public async Task<Friendship?> GetByUsersAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default)
    {
        return await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .FirstOrDefaultAsync(f => 
                (f.RequesterId == userId1 && f.AddresseeId == userId2) ||
                (f.RequesterId == userId2 && f.AddresseeId == userId1), 
                cancellationToken);
    }

    public async Task<IEnumerable<Friendship>> GetFriendsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .Where(f => (f.RequesterId == userId || f.AddresseeId == userId) && f.Status == FriendshipStatus.Accepted)
            .OrderBy(f => f.UpdatedAt ?? f.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Friendship>> GetPendingRequestsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .Where(f => f.AddresseeId == userId && f.Status == FriendshipStatus.Pending)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Friendship>> GetSentRequestsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .Where(f => f.RequesterId == userId && f.Status == FriendshipStatus.Pending)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Friendship> CreateAsync(Friendship friendship, CancellationToken cancellationToken = default)
    {
        _context.Friendships.Add(friendship);
        await _context.SaveChangesAsync(cancellationToken);
        return friendship;
    }

    public async Task<Friendship> UpdateAsync(Friendship friendship, CancellationToken cancellationToken = default)
    {
        _context.Friendships.Update(friendship);
        await _context.SaveChangesAsync(cancellationToken);
        return friendship;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var friendship = await _context.Friendships.FindAsync(id);
        if (friendship != null)
        {
            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> AreFriendsAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default)
    {
        return await _context.Friendships
            .AnyAsync(f => 
                (f.RequesterId == userId1 && f.AddresseeId == userId2) ||
                (f.RequesterId == userId2 && f.AddresseeId == userId1) && 
                f.Status == FriendshipStatus.Accepted, 
                cancellationToken);
    }

    public async Task<bool> HasPendingRequestAsync(Guid requesterId, Guid addresseeId, CancellationToken cancellationToken = default)
    {
        return await _context.Friendships
            .AnyAsync(f => 
                f.RequesterId == requesterId && 
                f.AddresseeId == addresseeId && 
                f.Status == FriendshipStatus.Pending, 
                cancellationToken);
    }
}








