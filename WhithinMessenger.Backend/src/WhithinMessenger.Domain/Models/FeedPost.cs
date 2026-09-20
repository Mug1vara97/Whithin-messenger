namespace WhithinMessenger.Domain.Models;

public enum FeedPostScope
{
    Friend = 0,
    Server = 1,
}

public class FeedPost
{
    public Guid Id { get; set; }

    public Guid AuthorUserId { get; set; }

    public string Text { get; set; } = string.Empty;

    public FeedPostScope Scope { get; set; } = FeedPostScope.Friend;

    /// <summary>Для Scope=Server — сервер, от имени которого пост.</summary>
    public Guid? ServerId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    public ApplicationUser Author { get; set; } = null!;

    public Server? Server { get; set; }

    public ICollection<FeedPostAttachment> Attachments { get; set; } = new List<FeedPostAttachment>();
}
