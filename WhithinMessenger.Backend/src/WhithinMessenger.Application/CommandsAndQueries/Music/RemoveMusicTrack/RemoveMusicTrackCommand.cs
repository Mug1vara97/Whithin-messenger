using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Music.RemoveMusicTrack;

public record RemoveMusicTrackCommand(Guid UserId, string VideoId) : IRequest<RemoveMusicTrackResult>;

public record RemoveMusicTrackResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
