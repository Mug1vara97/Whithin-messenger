namespace WhithinMessenger.Domain.Models;

public class FeedPostAttachment
{
    public Guid Id { get; set; }

    public Guid FeedPostId { get; set; }

    public string FileName { get; set; } = string.Empty;

    public string OriginalFileName { get; set; } = string.Empty;

    public string FilePath { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long FileSize { get; set; }

    public string? ThumbnailPath { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public FeedPost FeedPost { get; set; } = null!;
}
