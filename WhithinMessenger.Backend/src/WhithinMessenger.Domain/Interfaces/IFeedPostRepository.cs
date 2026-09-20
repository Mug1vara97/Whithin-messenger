using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IFeedPostRepository
{
    Task<FeedPost?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default);

    Task<FeedPost?> GetByIdWithEngagementAsync(Guid postId, CancellationToken cancellationToken = default);

    Task<List<FeedPost>> GetByAuthorAsync(
        Guid authorUserId,
        FeedPostScope scope,
        int take,
        CancellationToken cancellationToken = default);

    Task<List<FeedPost>> GetFriendFeedAsync(
        IReadOnlyCollection<Guid> authorUserIds,
        int take,
        CancellationToken cancellationToken = default);

    Task<List<FeedPost>> GetServerFeedAsync(
        IReadOnlyCollection<Guid> serverIds,
        int take,
        CancellationToken cancellationToken = default);

    Task CreateAsync(FeedPost post, CancellationToken cancellationToken = default);

    Task DeleteAsync(FeedPost post, CancellationToken cancellationToken = default);

    Task<FeedPostReaction?> GetReactionAsync(
        Guid postId,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task UpsertReactionAsync(FeedPostReaction reaction, CancellationToken cancellationToken = default);

    Task RemoveReactionAsync(FeedPostReaction reaction, CancellationToken cancellationToken = default);

    Task<List<FeedPostComment>> GetCommentsAsync(
        Guid postId,
        int take,
        CancellationToken cancellationToken = default);

    Task<FeedPostComment?> GetCommentByIdAsync(Guid commentId, CancellationToken cancellationToken = default);

    Task AddCommentAsync(FeedPostComment comment, CancellationToken cancellationToken = default);

    Task DeleteCommentAsync(FeedPostComment comment, CancellationToken cancellationToken = default);
}
