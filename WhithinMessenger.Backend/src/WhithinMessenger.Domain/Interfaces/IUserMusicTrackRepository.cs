using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IUserMusicTrackRepository
{
    Task<List<UserMusicTrack>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Adds the track or returns the existing entry for the same video.</summary>
    Task<UserMusicTrack> AddAsync(UserMusicTrack track, CancellationToken cancellationToken = default);

    Task<bool> RemoveAsync(Guid userId, string videoId, CancellationToken cancellationToken = default);
}
