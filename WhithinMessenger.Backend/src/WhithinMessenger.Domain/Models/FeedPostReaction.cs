namespace WhithinMessenger.Domain.Models;

public enum FeedReactionValue
{
    Dislike = -1,
    Like = 1,
}

public class FeedPostReaction
{
    public Guid Id { get; set; }

    public Guid FeedPostId { get; set; }

    public Guid UserId { get; set; }

    public FeedReactionValue Value { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    public FeedPost FeedPost { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;
}

public class FeedPostComment
{
    public Guid Id { get; set; }

    public Guid FeedPostId { get; set; }

    public Guid AuthorUserId { get; set; }

    public string Text { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    public FeedPost FeedPost { get; set; } = null!;

    public ApplicationUser Author { get; set; } = null!;
}
