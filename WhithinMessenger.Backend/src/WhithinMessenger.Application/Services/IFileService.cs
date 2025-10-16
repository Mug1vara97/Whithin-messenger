using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Application.Services
{
    public interface IFileService
    {
        Task<string> SaveFileAsync(IFormFile file, string folderPath);
        Task<string> SaveThumbnailAsync(byte[] imageData, string originalFileName, string folderPath);
        Task<string> SaveChatAvatarAsync(IFormFile file, CancellationToken cancellationToken = default);
        Task<bool> DeleteFileAsync(string filePath, CancellationToken cancellationToken = default);
        Task<byte[]?> GetFileAsync(string filePath);
        Task<string> GetContentTypeAsync(string filePath);
        bool IsImageFile(string contentType);
        bool IsVideoFile(string contentType);
        bool IsAudioFile(string contentType);
        string GetMediaFolderPath(string contentType);
    }
}




