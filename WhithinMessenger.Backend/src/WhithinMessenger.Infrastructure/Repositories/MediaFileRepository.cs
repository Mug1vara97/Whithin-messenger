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

        public async Task<List<MediaFile>> GetAllByMessageIdAsync(Guid messageId, CancellationToken cancellationToken = default)
        {
            return await _context.MediaFiles
                .Where(mf => mf.MessageId == messageId)
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
                    .ThenInclude(m => m.User)
                .Where(mf => mf.Message.ChatId == chatId && !mf.IsDeleted)
                .OrderByDescending(mf => mf.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<string?> ResolveOriginalFileNameByPathAsync(string filePath, CancellationToken cancellationToken = default)
        {
            var variants = BuildPathVariants(filePath);
            if (variants.Count == 0)
            {
                return null;
            }

            var fromMedia = await _context.MediaFiles
                .AsNoTracking()
                .Where(mf => !mf.IsDeleted && variants.Contains(mf.FilePath))
                .Select(mf => mf.OriginalFileName)
                .FirstOrDefaultAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(fromMedia))
            {
                return fromMedia.Trim();
            }

            var fromFeed = await _context.FeedPostAttachments
                .AsNoTracking()
                .Where(a => variants.Contains(a.FilePath))
                .Select(a => a.OriginalFileName)
                .FirstOrDefaultAsync(cancellationToken);

            return string.IsNullOrWhiteSpace(fromFeed) ? null : fromFeed.Trim();
        }

        private static HashSet<string> BuildPathVariants(string filePath)
        {
            var variants = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(filePath))
            {
                return variants;
            }

            var trimmed = filePath.Trim().Replace('\\', '/');
            variants.Add(trimmed);
            variants.Add(trimmed.TrimStart('/'));
            variants.Add("/" + trimmed.TrimStart('/'));

            var withoutUploads = trimmed.TrimStart('/');
            if (withoutUploads.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
            {
                variants.Add(withoutUploads);
                variants.Add("/" + withoutUploads);
            }
            else if (!string.IsNullOrEmpty(withoutUploads))
            {
                variants.Add("uploads/" + withoutUploads);
                variants.Add("/uploads/" + withoutUploads);
            }

            return variants;
        }
    }
}















