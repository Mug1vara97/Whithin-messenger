namespace WhithinMessenger.Application.Services;

public interface IVideoConverterService
{
    Task<string?> ConvertVideoToH264Async(string inputFilePath, string outputFolderPath, CancellationToken cancellationToken = default);
    Task<string?> GenerateAdaptiveHlsAsync(string inputFilePath, string outputDirectory, CancellationToken cancellationToken = default);
    Task<StickerConvertedMedia?> TryConvertWebmToAnimatedWebpAsync(
        byte[] webmBytes,
        CancellationToken cancellationToken = default);
    bool IsVideoFile(string contentType);
    bool NeedsConversion(string filePath);
}

public record StickerConvertedMedia(byte[] Bytes, string Extension, string ContentType);
