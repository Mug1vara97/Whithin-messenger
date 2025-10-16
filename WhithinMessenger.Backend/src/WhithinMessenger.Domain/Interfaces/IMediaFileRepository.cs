using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public interface IMediaFileRepository
    {
        Task<MediaFile?> GetByIdAsync(Guid mediaFileId, CancellationToken cancellationToken = default);
        Task<List<MediaFile>> GetByMessageIdAsync(Guid messageId, CancellationToken cancellationToken = default);
        Task<MediaFile> AddAsync(MediaFile mediaFile, CancellationToken cancellationToken = default);
        Task<MediaFile> UpdateAsync(MediaFile mediaFile, CancellationToken cancellationToken = default);
        Task DeleteAsync(Guid mediaFileId, CancellationToken cancellationToken = default);
        Task<List<MediaFile>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default);
    }
}















