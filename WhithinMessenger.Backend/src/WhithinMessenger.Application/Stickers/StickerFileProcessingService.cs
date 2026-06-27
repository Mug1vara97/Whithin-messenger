using Microsoft.Extensions.Logging;
using WhithinMessenger.Application.Services;

namespace WhithinMessenger.Application.Stickers;

public sealed class StickerFileProcessingService : IStickerFileProcessingService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".webp", ".png", ".gif", ".jpg", ".jpeg", ".webm"
    };

    private const int MaxImageStickerBytes = 2 * 1024 * 1024;
    private const int MaxVideoStickerBytes = 5 * 1024 * 1024;

    private readonly IVideoConverterService _videoConverterService;
    private readonly ILogger<StickerFileProcessingService> _logger;

    public StickerFileProcessingService(
        IVideoConverterService videoConverterService,
        ILogger<StickerFileProcessingService> logger)
    {
        _videoConverterService = videoConverterService;
        _logger = logger;
    }

    public async Task<ProcessedStickerFile?> ProcessAsync(
        string fileName,
        byte[] bytes,
        CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(fileName);
        if (!AllowedExtensions.Contains(extension))
        {
            _logger.LogDebug("Skipping sticker file {FileName}: unsupported extension", fileName);
            return null;
        }

        var isWebm = extension.Equals(".webm", StringComparison.OrdinalIgnoreCase);
        var maxBytes = isWebm ? MaxVideoStickerBytes : MaxImageStickerBytes;
        if (bytes.Length == 0 || bytes.Length > maxBytes)
        {
            _logger.LogWarning(
                "Skipping sticker file {FileName}: invalid size {SizeBytes} (max {MaxBytes})",
                fileName,
                bytes.Length,
                maxBytes);
            return null;
        }

        if (isWebm)
        {
            var converted = await _videoConverterService.TryConvertWebmToAnimatedWebpAsync(bytes, cancellationToken);
            if (converted != null)
            {
                bytes = converted.Bytes;
                extension = converted.Extension;
                _logger.LogInformation(
                    "Converted sticker {FileName} to animated webp ({SizeBytes} bytes)",
                    fileName,
                    bytes.Length);
            }
            else
            {
                _logger.LogWarning("Webm conversion failed for {FileName}, keeping original webm", fileName);
            }
        }

        var maxStoredBytes = extension.Equals(".webm", StringComparison.OrdinalIgnoreCase)
            ? MaxVideoStickerBytes
            : MaxImageStickerBytes;
        if (bytes.Length == 0 || bytes.Length > maxStoredBytes)
        {
            return null;
        }

        var contentType = extension.ToLowerInvariant() switch
        {
            ".webp" => "image/webp",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webm" => "video/webm",
            _ => "application/octet-stream"
        };

        return new ProcessedStickerFile(
            fileName,
            bytes,
            extension.ToLowerInvariant(),
            contentType);
    }
}
