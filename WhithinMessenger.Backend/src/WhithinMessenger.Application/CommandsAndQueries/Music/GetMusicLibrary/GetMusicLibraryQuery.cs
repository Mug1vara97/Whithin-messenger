using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Music.GetMusicLibrary;

public record GetMusicLibraryQuery(Guid UserId) : IRequest<GetMusicLibraryResult>;

public record GetMusicLibraryResult
{
    public bool Success { get; init; }
    public List<UserMusicTrackDto> Tracks { get; init; } = new();
    public string? ErrorMessage { get; init; }
}
