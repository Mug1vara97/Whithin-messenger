using System.Drawing;
using System.Drawing.Imaging;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace WhithinMessenger.Application.Services
{
    public class FileService : IFileService
    {
        private readonly ILogger<FileService> _logger;
        private readonly string _webRootPath;

        public FileService(ILogger<FileService> logger, string webRootPath = "wwwroot")
        {
            _logger = logger;
            _webRootPath = webRootPath;
        }

        public async Task<string> SaveFileAsync(IFormFile file, string folderPath)
        {
            try
            {
                var uploadsPath = Path.Combine(_webRootPath, "uploads", folderPath);
                Directory.CreateDirectory(uploadsPath);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(uploadsPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                    await stream.FlushAsync(); // Ensure all data is written
                }

                // Verify file was saved correctly
                var savedFileInfo = new FileInfo(filePath);
                if (savedFileInfo.Length != file.Length)
                {
                    _logger.LogWarning("File size mismatch after save: expected {ExpectedSize}, got {ActualSize} for {FileName}", 
                        file.Length, savedFileInfo.Length, file.FileName);
                }

                return Path.Combine("uploads", folderPath, fileName).Replace("\\", "/");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving file: {FileName}", file.FileName);
                throw;
            }
        }

        public async Task<string> SaveChatAvatarAsync(IFormFile file, CancellationToken cancellationToken = default)
        {
            try
            {
                var uploadsPath = Path.Combine(_webRootPath, "uploads", "chat-avatars");
                Directory.CreateDirectory(uploadsPath);

                var fileExtension = Path.GetExtension(file.FileName);
                var fileName = $"{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(uploadsPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream, cancellationToken);
                }

                return $"/uploads/chat-avatars/{fileName}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving chat avatar: {FileName}", file.FileName);
                throw;
            }
        }

        public async Task<string> SaveThumbnailAsync(byte[] imageData, string originalFileName, string folderPath)
        {
            try
            {
                var uploadsPath = Path.Combine(_webRootPath, "uploads", folderPath, "thumbnails");
                Directory.CreateDirectory(uploadsPath);

                var fileName = $"thumb_{Guid.NewGuid()}{Path.GetExtension(originalFileName)}";
                var filePath = Path.Combine(uploadsPath, fileName);

                using (var originalStream = new MemoryStream(imageData))
                using (var image = Image.FromStream(originalStream))
                {
                    var thumbnail = CreateThumbnail(image, 200, 200);
                    thumbnail.Save(filePath, ImageFormat.Jpeg);
                }

                return Path.Combine("uploads", folderPath, "thumbnails", fileName).Replace("\\", "/");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating thumbnail for: {FileName}", originalFileName);
                throw;
            }
        }

        public async Task<bool> DeleteFileAsync(string filePath, CancellationToken cancellationToken = default)
        {
            try
            {
                var fullPath = Path.Combine(_webRootPath, filePath);
                if (File.Exists(fullPath))
                {
                    File.Delete(fullPath);
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file: {FilePath}", filePath);
                return false;
            }
        }

        public async Task<byte[]?> GetFileAsync(string filePath)
        {
            try
            {
                var fullPath = Path.Combine(_webRootPath, filePath);
                if (File.Exists(fullPath))
                {
                    return await File.ReadAllBytesAsync(fullPath);
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading file: {FilePath}", filePath);
                return null;
            }
        }

        public async Task<string> GetContentTypeAsync(string filePath)
        {
            try
            {
                var extension = Path.GetExtension(filePath).ToLowerInvariant();
                return extension switch
                {
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".png" => "image/png",
                    ".gif" => "image/gif",
                    ".webp" => "image/webp",
                    ".mp4" => "video/mp4",
                    ".avi" => "video/avi",
                    ".mov" => "video/quicktime",
                    ".wmv" => "video/x-ms-wmv",
                    ".mp3" => "audio/mpeg",
                    ".wav" => "audio/wav",
                    ".ogg" => "audio/ogg",
                    ".m4a" => "audio/mp4",
                    _ => "application/octet-stream"
                };
            }
            catch
            {
                return "application/octet-stream";
            }
        }

        public bool IsImageFile(string contentType)
        {
            return contentType.StartsWith("image/");
        }

        public bool IsVideoFile(string contentType)
        {
            return contentType.StartsWith("video/");
        }

        public bool IsAudioFile(string contentType)
        {
            return contentType.StartsWith("audio/");
        }

        public string GetMediaFolderPath(string contentType)
        {
            if (IsImageFile(contentType))
                return "images";
            if (IsVideoFile(contentType))
                return "videos";
            if (IsAudioFile(contentType))
                return "audio";
            return "files";
        }

        private static Image CreateThumbnail(Image originalImage, int maxWidth, int maxHeight)
        {
            var ratioX = (double)maxWidth / originalImage.Width;
            var ratioY = (double)maxHeight / originalImage.Height;
            var ratio = Math.Min(ratioX, ratioY);

            var newWidth = (int)(originalImage.Width * ratio);
            var newHeight = (int)(originalImage.Height * ratio);

            var thumbnail = new Bitmap(newWidth, newHeight);
            using (var graphics = Graphics.FromImage(thumbnail))
            {
                graphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                graphics.DrawImage(originalImage, 0, 0, newWidth, newHeight);
            }

            return thumbnail;
        }

        public string GetFullPath(string relativePath)
        {
            return Path.Combine(_webRootPath, relativePath);
        }

        public string GetFullPathForFolder(string folderPath)
        {
            return Path.Combine(_webRootPath, "uploads", folderPath);
        }
    }
}