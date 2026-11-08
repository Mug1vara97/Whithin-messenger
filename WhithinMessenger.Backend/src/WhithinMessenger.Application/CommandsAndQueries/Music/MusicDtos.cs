using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Music;

public record UserMusicTrackDto
{
    public string VideoId { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Artist { get; init; } = string.Empty;
    public int DurationSeconds { get; init; }
    public string? ThumbnailUrl { get; init; }
    public DateTimeOffset AddedAt { get; init; }
}

public static class UserMusicTrackMapper
{
    public static UserMusicTrackDto ToDto(UserMusicTrack track) => new()
    {
        VideoId = track.VideoId,
        Title = track.Title,
        Artist = track.Artist,
        DurationSeconds = track.DurationSeconds,
        ThumbnailUrl = track.ThumbnailUrl,
        AddedAt = track.AddedAt
    };
}
