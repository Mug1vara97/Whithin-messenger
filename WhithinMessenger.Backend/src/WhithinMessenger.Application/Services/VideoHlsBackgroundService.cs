using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace WhithinMessenger.Application.Services;

public interface IVideoHlsBackgroundService
{
    void QueueGeneration(Guid mediaFileId, string inputFilePath);
}

public class VideoHlsBackgroundService : IVideoHlsBackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<VideoHlsBackgroundService> _logger;

    public VideoHlsBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<VideoHlsBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public void QueueGeneration(Guid mediaFileId, string inputFilePath)
    {
        _ = Task.Run(() => GenerateAsync(mediaFileId, inputFilePath));
    }

    private async Task GenerateAsync(Guid mediaFileId, string inputFilePath)
    {
        try
        {
            if (!File.Exists(inputFilePath))
            {
                _logger.LogWarning("HLS background job skipped, file missing: {FilePath}", inputFilePath);
                return;
            }

            using var scope = _scopeFactory.CreateScope();
            var fileService = scope.ServiceProvider.GetRequiredService<IFileService>();
            var videoConverterService = scope.ServiceProvider.GetRequiredService<IVideoConverterService>();
            var mediaFileRepository =
                scope.ServiceProvider.GetRequiredService<WhithinMessenger.Domain.Interfaces.IMediaFileRepository>();

            var hlsOutputDirectory = Path.Combine(
                fileService.GetFullPathForFolder("video/hls"),
                mediaFileId.ToString());

            var manifestFileName = await videoConverterService.GenerateAdaptiveHlsAsync(
                inputFilePath,
                hlsOutputDirectory,
                CancellationToken.None);

            if (string.IsNullOrEmpty(manifestFileName))
            {
                return;
            }

            var streamingManifestPath = Path
                .Combine("uploads", "video", "hls", mediaFileId.ToString(), manifestFileName)
                .Replace("\\", "/");

            var mediaFile = await mediaFileRepository.GetByIdAsync(mediaFileId, CancellationToken.None);
            if (mediaFile == null)
            {
                return;
            }

            mediaFile.StreamingManifestPath = streamingManifestPath;
            await mediaFileRepository.UpdateAsync(mediaFile, CancellationToken.None);

            _logger.LogInformation(
                "HLS background job completed for media {MediaFileId}: {ManifestPath}",
                mediaFileId,
                streamingManifestPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "HLS background job failed for media {MediaFileId}", mediaFileId);
        }
    }
}
