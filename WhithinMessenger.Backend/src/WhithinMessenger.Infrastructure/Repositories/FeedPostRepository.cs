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
            .Include(p => p.Attachments)
            .Include(p => p.Reactions)
            .Include(p => p.Comments);

    public async Task<FeedPost?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        return await _context.FeedPosts
            .Include(p => p.Author)
            .ThenInclude(u => u.UserProfile)
            .Include(p => p.Server)
            .Include(p => p.Attachments)
            .Include(p => p.Reactions)
            .Include(p => p.Comments)
            .FirstOrDefaultAsync(p => p.Id == postId, cancellationToken);
    }

    public async Task<FeedPost?> GetByIdWithEngagementAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        return await GetByIdAsync(postId, cancellationToken);
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

    public async Task<FeedPostReaction?> GetReactionAsync(
        Guid postId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.FeedPostReactions
            .FirstOrDefaultAsync(r => r.FeedPostId == postId && r.UserId == userId, cancellationToken);
    }

    public async Task UpsertReactionAsync(FeedPostReaction reaction, CancellationToken cancellationToken = default)
    {
        var existing = await _context.FeedPostReactions
            .FirstOrDefaultAsync(
                r => r.FeedPostId == reaction.FeedPostId && r.UserId == reaction.UserId,
                cancellationToken);

        if (existing == null)
        {
            _context.FeedPostReactions.Add(reaction);
        }
        else
        {
            existing.Value = reaction.Value;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveReactionAsync(FeedPostReaction reaction, CancellationToken cancellationToken = default)
    {
        _context.FeedPostReactions.Remove(reaction);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<FeedPostComment>> GetCommentsAsync(
        Guid postId,
        int take,
        CancellationToken cancellationToken = default)
    {
        return await _context.FeedPostComments
            .AsNoTracking()
            .Include(c => c.Author)
            .ThenInclude(u => u.UserProfile)
            .Where(c => c.FeedPostId == postId)
            .OrderBy(c => c.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<FeedPostComment?> GetCommentByIdAsync(
        Guid commentId,
        CancellationToken cancellationToken = default)
    {
        return await _context.FeedPostComments
            .Include(c => c.Author)
            .ThenInclude(u => u.UserProfile)
            .FirstOrDefaultAsync(c => c.Id == commentId, cancellationToken);
    }

    public async Task AddCommentAsync(FeedPostComment comment, CancellationToken cancellationToken = default)
    {
        _context.FeedPostComments.Add(comment);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteCommentAsync(FeedPostComment comment, CancellationToken cancellationToken = default)
    {
        _context.FeedPostComments.Remove(comment);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
