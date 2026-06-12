namespace WhithinMessenger.Domain.Models;

public class IdeaBoardCard
{
    public Guid Id { get; set; }

    public Guid ChatId { get; set; }

    public Guid AuthorUserId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string? Tag { get; set; }

    public string? SourceUrl { get; set; }

    public double? PositionX { get; set; }

    public double? PositionY { get; set; }

    public double Rotation { get; set; }

    public bool IsFiled { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    public Chat Chat { get; set; } = null!;

    public ApplicationUser Author { get; set; } = null!;
}
