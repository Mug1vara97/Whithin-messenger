using Microsoft.Extensions.Logging;
using FFMpegCore;
using FFMpegCore.Enums;
using System.Diagnostics;
using System.Globalization;
using System.Text;

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
            return false;
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

    public async Task<string?> GenerateAdaptiveHlsAsync(
        string inputFilePath,
        string outputDirectory,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(inputFilePath))
            {
                _logger.LogError("Input file does not exist for HLS: {FilePath}", inputFilePath);
                return null;
            }

            Directory.CreateDirectory(outputDirectory);

            var sourceHeight = 720;
            try
            {
                var mediaInfo = FFProbe.Analyse(inputFilePath);
                sourceHeight = mediaInfo.VideoStreams.FirstOrDefault()?.Height ?? sourceHeight;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to probe source video for HLS ladder: {FilePath}", inputFilePath);
            }

            var ladder = BuildHlsLadder(sourceHeight);
            var masterFileName = "master.m3u8";
            var masterPath = Path.Combine(outputDirectory, masterFileName);

            var arguments = ladder.Count > 1
                ? BuildMultiBitrateHlsArguments(inputFilePath, outputDirectory, ladder)
                : BuildSingleBitrateHlsArguments(inputFilePath, outputDirectory);

            var success = await RunFfmpegAsync(arguments, cancellationToken);
            if (!success || !File.Exists(masterPath))
            {
                _logger.LogWarning("HLS generation failed for {FilePath}", inputFilePath);
                return null;
            }

            _logger.LogInformation(
                "HLS stream generated: {InputFile} -> {MasterPath} ({RenditionCount} renditions)",
                inputFilePath,
                masterPath,
                ladder.Count);

            return masterFileName;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating HLS stream: {InputFile}", inputFilePath);
            return null;
        }
    }

    private static List<(int Height, int BitrateKbps)> BuildHlsLadder(int sourceHeight)
    {
        var presets = new (int Height, int BitrateKbps)[]
        {
            (1080, 4500),
            (720, 2500),
            (480, 1200),
            (360, 800),
        };

        var ladder = presets
            .Where(preset => sourceHeight >= preset.Height - 40 || preset.Height == 360)
            .ToList();

        if (ladder.Count == 0)
        {
            ladder.Add((Math.Max(240, sourceHeight), 800));
        }

        return ladder;
    }

    private static string BuildSingleBitrateHlsArguments(string inputFilePath, string outputDirectory)
    {
        var playlistPath = Path.Combine(outputDirectory, "master.m3u8").Replace("\\", "/");
        var segmentPattern = Path.Combine(outputDirectory, "segment_%03d.ts").Replace("\\", "/");

        return string.Join(' ',
            "-y",
            Quote(inputFilePath),
            "-c:v libx264 -preset veryfast -crf 22",
            "-c:a aac -b:a 128k -ac 2",
            "-movflags +faststart",
            "-f hls -hls_time 4 -hls_playlist_type vod",
            $"-hls_segment_filename {Quote(segmentPattern)}",
            Quote(playlistPath));
    }

    private static string BuildMultiBitrateHlsArguments(
        string inputFilePath,
        string outputDirectory,
        IReadOnlyList<(int Height, int BitrateKbps)> ladder)
    {
        var builder = new StringBuilder();
        builder.Append("-y ");
        builder.Append(Quote(inputFilePath));

        for (var i = 0; i < ladder.Count; i++)
        {
            builder.Append(" -map 0:v:0 -map 0:a:0");
        }

        builder.Append(" -c:v libx264 -preset veryfast -c:a aac -b:a 128k -ac 2");

        for (var i = 0; i < ladder.Count; i++)
        {
            var (height, bitrateKbps) = ladder[i];
            builder.Append(CultureInfo.InvariantCulture, $" -filter:v:{i} scale=-2:{height}");
            builder.Append(CultureInfo.InvariantCulture, $" -b:v:{i} {bitrateKbps}k");
            builder.Append(CultureInfo.InvariantCulture, $" -maxrate:v:{i} {bitrateKbps + 400}k");
            builder.Append(CultureInfo.InvariantCulture, $" -bufsize:v:{i} {bitrateKbps * 2}k");
        }

        var streamMap = string.Join(' ', Enumerable.Range(0, ladder.Count).Select(i => $"v:{i},a:{i}"));
        var segmentPattern = Path.Combine(outputDirectory, "v%v", "segment_%03d.ts").Replace("\\", "/");
        var playlistPattern = Path.Combine(outputDirectory, "v%v", "playlist.m3u8").Replace("\\", "/");
        var masterPath = Path.Combine(outputDirectory, "master.m3u8").Replace("\\", "/");

        builder.Append(CultureInfo.InvariantCulture, $" -var_stream_map \"{streamMap}\"");
        builder.Append(" -master_pl_name master.m3u8");
        builder.Append(" -f hls -hls_time 4 -hls_playlist_type vod");
        builder.Append(CultureInfo.InvariantCulture, $" -hls_segment_filename {Quote(segmentPattern)}");
        builder.Append(' ');
        builder.Append(Quote(playlistPattern));

        return builder.ToString();
    }

    private async Task<bool> RunFfmpegAsync(string arguments, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = Process.Start(startInfo);
        if (process == null)
        {
            return false;
        }

        await process.WaitForExitAsync(cancellationToken);
        if (process.ExitCode != 0)
        {
            var error = await process.StandardError.ReadToEndAsync(cancellationToken);
            _logger.LogWarning("ffmpeg exited with code {ExitCode}: {Error}", process.ExitCode, error);
            return false;
        }

        return true;
    }

    private static string Quote(string value) => $"\"{value.Replace("\"", "\\\"", StringComparison.Ordinal)}\"";

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
