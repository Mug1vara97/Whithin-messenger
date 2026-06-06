using Microsoft.Extensions.Logging;
using FFMpegCore;
using FFMpegCore.Enums;

namespace WhithinMessenger.Application.Services;

public class VideoConverterService : IVideoConverterService
{
    private readonly ILogger<VideoConverterService> _logger;

    public VideoConverterService(ILogger<VideoConverterService> logger)
    {
        _logger = logger;
    }

    public bool IsVideoFile(string contentType)
    {
        return contentType?.StartsWith("video/") == true;
    }

    public bool NeedsConversion(string filePath)
    {
        try
        {
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                return false;

            // Проверяем кодек видео через FFprobe
            var mediaInfo = FFProbe.Analyse(filePath);
            var videoStream = mediaInfo.VideoStreams.FirstOrDefault();
            
            if (videoStream == null)
                return false;

            // Если кодек HEVC (H.265) или другой неподдерживаемый - нужна конвертация
            var codec = videoStream.CodecName?.ToLowerInvariant() ?? "";
            var needsConversion = codec.Contains("hevc") || 
                                 codec.Contains("h265") || 
                                 codec.Contains("vp9") ||
                                 codec.Contains("av1");

            if (needsConversion)
            {
                _logger.LogInformation("Video needs conversion: codec={Codec}, file={FilePath}", codec, filePath);
            }

            return needsConversion;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to check if video needs conversion: {FilePath}", filePath);
            // В случае ошибки пробуем конвертировать на всякий случай
            return true;
        }
    }

    private const int MaxAnimatedWebpBytes = 2 * 1024 * 1024;

    public async Task<StickerConvertedMedia?> TryConvertWebmToAnimatedWebpAsync(
        byte[] webmBytes,
        CancellationToken cancellationToken = default)
    {
        if (webmBytes.Length == 0)
        {
            return null;
        }

        var tempDir = Path.Combine(Path.GetTempPath(), "whithin-stickers", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        var inputPath = Path.Combine(tempDir, "input.webm");
        var outputPath = Path.Combine(tempDir, "output.webp");

        try
        {
            await File.WriteAllBytesAsync(inputPath, webmBytes, cancellationToken);

            var conversionTask = FFMpegArguments
                .FromFileInput(inputPath)
                .OutputToFile(outputPath, overwrite: true, options => options
                    .WithVideoCodec("libwebp")
                    .WithCustomArgument("-an")
                    .WithCustomArgument("-vsync 0")
                    .WithCustomArgument("-loop 0")
                    .WithCustomArgument("-vf fps=20,scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease")
                    .WithCustomArgument("-lossless 0")
                    .WithCustomArgument("-compression_level 4")
                    .WithCustomArgument("-q:v 80")
                    .ForceFormat("webp"))
                .ProcessAsynchronously(true);

            await conversionTask.WaitAsync(cancellationToken);

            if (!File.Exists(outputPath))
            {
                return null;
            }

            var converted = await File.ReadAllBytesAsync(outputPath, cancellationToken);
            if (converted.Length == 0 || converted.Length > MaxAnimatedWebpBytes)
            {
                return null;
            }

            return new StickerConvertedMedia(converted, ".webp", "image/webp");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to convert sticker webm to animated webp");
            return null;
        }
        finally
        {
            TryDeleteDirectory(tempDir);
        }
    }

    public async Task<string?> ConvertVideoToH264Async(string inputFilePath, string outputFolderPath, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(inputFilePath))
            {
                _logger.LogError("Input file does not exist: {FilePath}", inputFilePath);
                return null;
            }

            Directory.CreateDirectory(outputFolderPath);

            var inputFileInfo = new FileInfo(inputFilePath);
            var outputFileName = $"{Guid.NewGuid()}.mp4";
            var outputFilePath = Path.Combine(outputFolderPath, outputFileName);

            _logger.LogInformation("Starting video conversion: {InputFile} -> {OutputFile}", inputFilePath, outputFilePath);

            // Конвертируем в H.264 (AVC) с совместимыми настройками для браузеров
            var conversionTask = FFMpegArguments
                .FromFileInput(inputFilePath)
                .OutputToFile(outputFilePath, overwrite: true, options => options
                    .WithVideoCodec(VideoCodec.LibX264)
                    .WithConstantRateFactor(23) // Качество: 18-28 (меньше = лучше качество, больше размер)
                    .WithSpeedPreset(Speed.VeryFast) // Быстрая конвертация
                    .WithAudioCodec(AudioCodec.Aac)
                    .WithVariableBitrate(4)
                    .ForceFormat("mp4")
                )
                .ProcessAsynchronously(true);

            // Ожидаем завершения с поддержкой отмены
            await conversionTask.WaitAsync(cancellationToken);

            if (!File.Exists(outputFilePath))
            {
                _logger.LogError("Converted file was not created: {OutputFile}", outputFilePath);
                return null;
            }

            var outputFileInfo = new FileInfo(outputFilePath);
            _logger.LogInformation("Video conversion completed: {InputSize} -> {OutputSize}, {InputFile} -> {OutputFile}",
                inputFileInfo.Length, outputFileInfo.Length, inputFilePath, outputFilePath);

            return Path.GetFileName(outputFilePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error converting video: {InputFile}", inputFilePath);
            return null;
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, recursive: true);
            }
        }
        catch
        {
            // Best-effort cleanup for temp conversion files.
        }
    }
}
