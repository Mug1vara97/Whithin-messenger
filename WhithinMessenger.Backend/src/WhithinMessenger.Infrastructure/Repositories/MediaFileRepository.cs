using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories
{
    public class MediaFileRepository : IMediaFileRepository
    {
        private readonly WithinDbContext _context;

        public MediaFileRepository(WithinDbContext context)
        {
            _context = context;
        }

        public async Task<MediaFile?> GetByIdAsync(Guid mediaFileId, CancellationToken cancellationToken = default)
        {
            return await _context.MediaFiles
                .Include(mf => mf.Message)
                .FirstOrDefaultAsync(mf => mf.Id == mediaFileId, cancellationToken);
        }

        public async Task<List<MediaFile>> GetByMessageIdAsync(Guid messageId, CancellationToken cancellationToken = default)
        {
            return await _context.MediaFiles
                .Where(mf => mf.MessageId == messageId && !mf.IsDeleted)
                .OrderBy(mf => mf.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<MediaFile> AddAsync(MediaFile mediaFile, CancellationToken cancellationToken = default)
        {
            _context.MediaFiles.Add(mediaFile);
            await _context.SaveChangesAsync(cancellationToken);
            return mediaFile;
        }

        public async Task<MediaFile> UpdateAsync(MediaFile mediaFile, CancellationToken cancellationToken = default)
        {
            _context.MediaFiles.Update(mediaFile);
            await _context.SaveChangesAsync(cancellationToken);
            return mediaFile;
        }

        public async Task DeleteAsync(Guid mediaFileId, CancellationToken cancellationToken = default)
        {
            var mediaFile = await _context.MediaFiles.FindAsync(mediaFileId);
            if (mediaFile != null)
            {
                mediaFile.IsDeleted = true;
                mediaFile.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task<List<MediaFile>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            return await _context.MediaFiles
                .Include(mf => mf.Message)
                .Where(mf => mf.Message.ChatId == chatId && !mf.IsDeleted)
                .OrderByDescending(mf => mf.CreatedAt)
                .ToListAsync(cancellationToken);
        }
    }
}















