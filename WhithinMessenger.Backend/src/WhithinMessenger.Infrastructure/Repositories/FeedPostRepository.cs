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
        FeedPostScope? scope,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = QueryWithAuthors().Where(p => p.AuthorUserId == authorUserId);
        if (scope.HasValue)
        {
            query = query.Where(p => p.Scope == scope.Value);
        }

        return await query
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
            .Include(c => c.Reactions)
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
            .Include(c => c.Reactions)
            .FirstOrDefaultAsync(c => c.Id == commentId, cancellationToken);
    }

    public async Task AddCommentAsync(FeedPostComment comment, CancellationToken cancellationToken = default)
    {
        _context.FeedPostComments.Add(comment);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteCommentAsync(FeedPostComment comment, CancellationToken cancellationToken = default)
    {
        // Cascade-delete nested replies (FK ParentCommentId is Restrict).
        var toRemove = new List<FeedPostComment>();
        async Task CollectAsync(Guid id)
        {
            var children = await _context.FeedPostComments
                .Where(c => c.ParentCommentId == id)
                .ToListAsync(cancellationToken);
            foreach (var child in children)
            {
                await CollectAsync(child.Id);
                toRemove.Add(child);
            }
        }

        await CollectAsync(comment.Id);
        if (toRemove.Count > 0)
        {
            _context.FeedPostComments.RemoveRange(toRemove);
        }

        _context.FeedPostComments.Remove(comment);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<FeedCommentReaction?> GetCommentReactionAsync(
        Guid commentId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.FeedCommentReactions
            .FirstOrDefaultAsync(
                r => r.FeedPostCommentId == commentId && r.UserId == userId,
                cancellationToken);
    }

    public async Task UpsertCommentReactionAsync(
        FeedCommentReaction reaction,
        CancellationToken cancellationToken = default)
    {
        var existing = await _context.FeedCommentReactions
            .FirstOrDefaultAsync(
                r => r.FeedPostCommentId == reaction.FeedPostCommentId && r.UserId == reaction.UserId,
                cancellationToken);

        if (existing == null)
        {
            _context.FeedCommentReactions.Add(reaction);
        }
        else
        {
            existing.Value = reaction.Value;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveCommentReactionAsync(
        FeedCommentReaction reaction,
        CancellationToken cancellationToken = default)
    {
        _context.FeedCommentReactions.Remove(reaction);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> GetCommentDepthAsync(Guid commentId, CancellationToken cancellationToken = default)
    {
        var depth = 0;
        var currentId = (Guid?)commentId;
        while (currentId.HasValue && depth < 32)
        {
            var parentId = await _context.FeedPostComments
                .AsNoTracking()
                .Where(c => c.Id == currentId.Value)
                .Select(c => c.ParentCommentId)
                .FirstOrDefaultAsync(cancellationToken);
            if (!parentId.HasValue)
            {
                break;
            }

            depth += 1;
            currentId = parentId;
        }

        return depth;
    }
}
