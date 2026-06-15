namespace WhithinMessenger.Application.Models;

public class CachedUserServerItem
{
    public Guid ServerId { get; init; }
    public string Name { get; init; } = string.Empty;
    public Guid OwnerId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public bool IsPublic { get; init; }
    public string? Description { get; init; }
    public string? Avatar { get; init; }
    public string? Banner { get; init; }
    public string? BannerColor { get; init; }

    public object ToApiObject() =>
        new
        {
            serverId = ServerId,
            name = Name,
            ownerId = OwnerId,
            createdAt = CreatedAt,
            isPublic = IsPublic,
            description = Description,
            avatar = Avatar,
            banner = Banner,
            bannerColor = BannerColor,
        };
}
