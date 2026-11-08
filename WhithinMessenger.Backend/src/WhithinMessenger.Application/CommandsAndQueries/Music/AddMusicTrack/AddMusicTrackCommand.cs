using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Music.AddMusicTrack;

public record AddMusicTrackCommand(
    Guid UserId,
    string VideoId,
    string Title,
    string Artist,
    int DurationSeconds,
    string? ThumbnailUrl) : IRequest<AddMusicTrackResult>;

public record AddMusicTrackResult
{
    public bool Success { get; init; }
    public UserMusicTrackDto? Track { get; init; }
    public string? ErrorMessage { get; init; }
}
