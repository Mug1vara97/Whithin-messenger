using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class FeedPostRepository : IFeedPostRepository
{
    private readonly WithinDbContext _context;

    public FeedPostRepository(WithinDbContext context)
    {
        _context = context;
    }

    private IQueryable<FeedPost> QueryWithAuthors() =>
        _context.FeedPosts
            .AsNoTracking()
            .Include(p => p.Author)
            .ThenInclude(u => u.UserProfile)
            .Include(p => p.Server)
            .Include(p => p.Attachments);

    public async Task<FeedPost?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        return await _context.FeedPosts
            .Include(p => p.Author)
            .ThenInclude(u => u.UserProfile)
            .Include(p => p.Server)
            .Include(p => p.Attachments)
            .FirstOrDefaultAsync(p => p.Id == postId, cancellationToken);
    }

    public async Task<List<FeedPost>> GetByAuthorAsync(
        Guid authorUserId,
        FeedPostScope scope,
        int take,
        CancellationToken cancellationToken = default)
    {
        return await QueryWithAuthors()
            .Where(p => p.AuthorUserId == authorUserId && p.Scope == scope)
            .OrderByDescending(p => p.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<FeedPost>> GetFriendFeedAsync(
        IReadOnlyCollection<Guid> authorUserIds,
        int take,
        CancellationToken cancellationToken = default)
    {
        if (authorUserIds.Count == 0)
        {
            return [];
        }

        return await QueryWithAuthors()
            .Where(p => p.Scope == FeedPostScope.Friend && authorUserIds.Contains(p.AuthorUserId))
            .OrderByDescending(p => p.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<FeedPost>> GetServerFeedAsync(
        IReadOnlyCollection<Guid> serverIds,
        int take,
        CancellationToken cancellationToken = default)
    {
        if (serverIds.Count == 0)
        {
            return [];
        }

        return await QueryWithAuthors()
            .Where(p => p.Scope == FeedPostScope.Server && p.ServerId.HasValue && serverIds.Contains(p.ServerId.Value))
            .OrderByDescending(p => p.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task CreateAsync(FeedPost post, CancellationToken cancellationToken = default)
    {
        _context.FeedPosts.Add(post);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(FeedPost post, CancellationToken cancellationToken = default)
    {
        _context.FeedPosts.Remove(post);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
