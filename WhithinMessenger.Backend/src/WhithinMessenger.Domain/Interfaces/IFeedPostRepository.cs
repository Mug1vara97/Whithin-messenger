using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IFeedPostRepository
{
    Task<FeedPost?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default);

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
}
