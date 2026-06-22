using Microsoft.Extensions.Logging;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public interface IMediaFileStorageCleanup
{
    Task DeleteMediaAssetsAsync(MediaFile mediaFile, CancellationToken cancellationToken = default);
    Task DeleteMediaAssetsAsync(IEnumerable<MediaFile> mediaFiles, CancellationToken cancellationToken = default);
}

public class MediaFileStorageCleanup : IMediaFileStorageCleanup
{
    private readonly IFileService _fileService;
    private readonly ILogger<MediaFileStorageCleanup> _logger;

    public MediaFileStorageCleanup(IFileService fileService, ILogger<MediaFileStorageCleanup> logger)
    {
        _fileService = fileService;
        _logger = logger;
    }

    public async Task DeleteMediaAssetsAsync(
        IEnumerable<MediaFile> mediaFiles,
        CancellationToken cancellationToken = default)
    {
        foreach (var mediaFile in mediaFiles)
        {
            await DeleteMediaAssetsAsync(mediaFile, cancellationToken);
        }
    }

    public async Task DeleteMediaAssetsAsync(MediaFile mediaFile, CancellationToken cancellationToken = default)
    {
        if (mediaFile == null)
        {
            return;
        }

        if (!string.IsNullOrWhiteSpace(mediaFile.FilePath))
        {
            await _fileService.DeleteFileAsync(mediaFile.FilePath, cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(mediaFile.ThumbnailPath))
        {
            await _fileService.DeleteFileAsync(mediaFile.ThumbnailPath, cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(mediaFile.StreamingManifestPath))
        {
            var hlsDirectory = Path.GetDirectoryName(
                mediaFile.StreamingManifestPath.Replace('\\', '/'));

            if (!string.IsNullOrWhiteSpace(hlsDirectory))
            {
                await _fileService.DeleteDirectoryAsync(hlsDirectory, cancellationToken);
            }
        }
        else if (_fileService.IsVideoFile(mediaFile.ContentType) && !mediaFile.IsVideoNote)
        {
            var fallbackHlsDirectory = Path
                .Combine("uploads", "video", "hls", mediaFile.Id.ToString())
                .Replace('\\', '/');
            await _fileService.DeleteDirectoryAsync(fallbackHlsDirectory, cancellationToken);
        }

        _logger.LogInformation(
            "Deleted media assets for {MediaFileId} ({ContentType})",
            mediaFile.Id,
            mediaFile.ContentType);
    }
}
