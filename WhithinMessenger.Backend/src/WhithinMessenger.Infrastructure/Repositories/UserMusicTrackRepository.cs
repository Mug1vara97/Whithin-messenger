using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class UserMusicTrackRepository : IUserMusicTrackRepository
{
    private readonly WithinDbContext _context;

    public UserMusicTrackRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserMusicTrack>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserMusicTracks
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.AddedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<UserMusicTrack> AddAsync(UserMusicTrack track, CancellationToken cancellationToken = default)
    {
        var existing = await _context.UserMusicTracks
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == track.UserId && x.VideoId == track.VideoId, cancellationToken);
        if (existing != null)
        {
            return existing;
        }

        _context.UserMusicTracks.Add(track);
        await _context.SaveChangesAsync(cancellationToken);
        return track;
    }

    public async Task<bool> RemoveAsync(Guid userId, string videoId, CancellationToken cancellationToken = default)
    {
        var deleted = await _context.UserMusicTracks
            .Where(x => x.UserId == userId && x.VideoId == videoId)
            .ExecuteDeleteAsync(cancellationToken);
        return deleted > 0;
    }
}
