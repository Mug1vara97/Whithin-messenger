namespace WhithinMessenger.Domain.Models;

/// <summary>Track saved to a user's music library (streamed by the client from YouTube).</summary>
public class UserMusicTrack
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string VideoId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public string? ThumbnailUrl { get; set; }
    public DateTimeOffset AddedAt { get; set; }
    public ApplicationUser User { get; set; } = null!;
}
