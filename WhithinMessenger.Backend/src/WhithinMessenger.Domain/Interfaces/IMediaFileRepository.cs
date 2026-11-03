using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public interface IMediaFileRepository
    {
        Task<MediaFile?> GetByIdAsync(Guid mediaFileId, CancellationToken cancellationToken = default);
        Task<List<MediaFile>> GetByMessageIdAsync(Guid messageId, CancellationToken cancellationToken = default);
        Task<List<MediaFile>> GetAllByMessageIdAsync(Guid messageId, CancellationToken cancellationToken = default);
        Task<MediaFile> AddAsync(MediaFile mediaFile, CancellationToken cancellationToken = default);
        Task<MediaFile> UpdateAsync(MediaFile mediaFile, CancellationToken cancellationToken = default);
        Task DeleteAsync(Guid mediaFileId, CancellationToken cancellationToken = default);
        Task<List<MediaFile>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Resolves the human-readable original file name for a storage path
        /// (chat MediaFiles or feed FeedPostAttachments). Returns null if unknown.
        /// </summary>
        Task<string?> ResolveOriginalFileNameByPathAsync(string filePath, CancellationToken cancellationToken = default);
    }
}















