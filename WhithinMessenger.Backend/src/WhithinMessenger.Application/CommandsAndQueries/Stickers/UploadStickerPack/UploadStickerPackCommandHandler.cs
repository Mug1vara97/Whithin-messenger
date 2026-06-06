using System.IO.Compression;
using MediatR;
using Microsoft.Extensions.Logging;
using WhithinMessenger.Application.CommandsAndQueries.Stickers;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Application.Stickers;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.UploadStickerPack;

public class UploadStickerPackCommandHandler : IRequestHandler<UploadStickerPackCommand, UploadStickerPackResult>
{
    private static readonly SemaphoreSlim UploadSemaphore = new(1, 1);

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".webp", ".png", ".gif", ".jpg", ".jpeg", ".webm"
    };

    private const int MaxImageStickerBytes = 2 * 1024 * 1024;
    private const int MaxVideoStickerBytes = 5 * 1024 * 1024;

    private readonly IStickerPackRepository _stickerPackRepository;
    private readonly IFileService _fileService;
    private readonly IVideoConverterService _videoConverterService;
    private readonly ILogger<UploadStickerPackCommandHandler> _logger;

    public UploadStickerPackCommandHandler(
        IStickerPackRepository stickerPackRepository,
        IFileService fileService,
        IVideoConverterService videoConverterService,
        ILogger<UploadStickerPackCommandHandler> logger)
    {
        _stickerPackRepository = stickerPackRepository;
        _fileService = fileService;
        _videoConverterService = videoConverterService;
        _logger = logger;
    }

    public async Task<UploadStickerPackResult> Handle(UploadStickerPackCommand request, CancellationToken cancellationToken)
    {
        await UploadSemaphore.WaitAsync(cancellationToken);
        try
        {
            return await HandleCoreAsync(request, cancellationToken);
        }
        finally
        {
            UploadSemaphore.Release();
        }
    }

    private async Task<UploadStickerPackResult> HandleCoreAsync(
        UploadStickerPackCommand request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (request.UserId != StickerPackAdmin.AllowedUploaderUserId)
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Загрузка стикерпаков доступна только администратору"
                };
            }

            var title = request.Title?.Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Укажите название стикерпака"
                };
            }

            if (request.Archive == null || request.Archive.Length == 0)
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Архив не выбран"
                };
            }

            _logger.LogInformation(
                "Sticker pack upload started. Title={Title}, Archive={ArchiveName}, Size={ArchiveSize}",
                title,
                request.Archive.FileName,
                request.Archive.Length);

            await using var archiveStream = request.Archive.OpenReadStream();
            var preparedStickers = await ExtractStickersFromArchiveAsync(archiveStream, cancellationToken);

            if (preparedStickers.Count == 0)
            {
                _logger.LogWarning(
                    "Sticker pack upload rejected: no valid stickers in archive {ArchiveName}",
                    request.Archive.FileName);

                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "В архиве не найдено стикеров (webp, png, gif, jpg, webm). Проверьте формат и размер файлов."
                };
            }

            var pack = new StickerPack
            {
                Id = Guid.NewGuid(),
                Title = title,
                CreatedByUserId = request.UserId,
                CreatedAt = DateTimeOffset.UtcNow
            };

            var folderPath = $"stickers/{pack.Id}";
            var uploadsPath = Path.Combine(_fileService.GetFullPathForFolder(folderPath));
            Directory.CreateDirectory(uploadsPath);

            var stickers = new List<Sticker>();
            for (var i = 0; i < preparedStickers.Count; i++)
            {
                var prepared = preparedStickers[i];
                var fileName = $"{Guid.NewGuid()}{prepared.Extension}";
                var absolutePath = Path.Combine(uploadsPath, fileName);
                await File.WriteAllBytesAsync(absolutePath, prepared.Bytes, cancellationToken);

                var relativePath = Path.Combine("uploads", folderPath, fileName).Replace("\\", "/");
                stickers.Add(new Sticker
                {
                    Id = Guid.NewGuid(),
                    StickerPackId = pack.Id,
                    FilePath = relativePath,
                    ContentType = prepared.ContentType,
                    SortOrder = i
                });

                _logger.LogInformation(
                    "Saved sticker {EntryName} -> {RelativePath} ({SizeBytes} bytes)",
                    prepared.EntryName,
                    relativePath,
                    prepared.Bytes.Length);
            }

            pack.CoverImagePath =
                stickers.FirstOrDefault(s => s.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))?.FilePath
                ?? stickers[0].FilePath;

            await _stickerPackRepository.CreatePackAsync(pack, cancellationToken);
            await _stickerPackRepository.AddStickersAsync(stickers, cancellationToken);
            await _stickerPackRepository.UpdatePackAsync(pack, cancellationToken);
            await _stickerPackRepository.InstallPackForUserAsync(request.UserId, pack.Id, cancellationToken);

            var created = await _stickerPackRepository.GetByIdWithStickersAsync(pack.Id, cancellationToken);
            if (created == null)
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Не удалось загрузить созданный стикерпак"
                };
            }

            _logger.LogInformation(
                "Sticker pack upload completed. PackId={PackId}, Title={Title}, Stickers={StickerCount}",
                created.Id,
                created.Title,
                created.Stickers.Count);

            return new UploadStickerPackResult
            {
                Success = true,
                Pack = MapPack(created)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sticker pack upload failed");
            return new UploadStickerPackResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    private async Task<List<PreparedStickerFile>> ExtractStickersFromArchiveAsync(
        Stream archiveStream,
        CancellationToken cancellationToken)
    {
        var prepared = new List<PreparedStickerFile>();

        using var zip = new ZipArchive(archiveStream, ZipArchiveMode.Read);
        foreach (var entry in zip.Entries
                     .Where(e => !e.FullName.EndsWith('/') && !string.IsNullOrWhiteSpace(e.Name))
                     .OrderBy(e => e.FullName, StringComparer.OrdinalIgnoreCase))
        {
            var extension = Path.GetExtension(entry.Name);
            if (!AllowedExtensions.Contains(extension))
            {
                _logger.LogDebug("Skipping archive entry {EntryName}: unsupported extension", entry.FullName);
                continue;
            }

            await using var entryStream = entry.Open();
            await using var memory = new MemoryStream();
            await entryStream.CopyToAsync(memory, cancellationToken);
            var bytes = memory.ToArray();

            var isWebm = extension.Equals(".webm", StringComparison.OrdinalIgnoreCase);
            var maxBytes = isWebm ? MaxVideoStickerBytes : MaxImageStickerBytes;
            if (bytes.Length == 0 || bytes.Length > maxBytes)
            {
                _logger.LogWarning(
                    "Skipping archive entry {EntryName}: invalid size {SizeBytes} (max {MaxBytes})",
                    entry.FullName,
                    bytes.Length,
                    maxBytes);
                continue;
            }

            if (isWebm)
            {
                var converted = await _videoConverterService.TryConvertWebmToAnimatedWebpAsync(bytes, cancellationToken);
                if (converted != null)
                {
                    bytes = converted.Bytes;
                    extension = converted.Extension;
                    _logger.LogInformation(
                        "Converted sticker {EntryName} to animated webp ({SizeBytes} bytes)",
                        entry.FullName,
                        bytes.Length);
                }
                else
                {
                    _logger.LogWarning(
                        "Webm conversion failed for {EntryName}, keeping original webm",
                        entry.FullName);
                }
            }

            var maxStoredBytes = extension.Equals(".webm", StringComparison.OrdinalIgnoreCase)
                ? MaxVideoStickerBytes
                : MaxImageStickerBytes;
            if (bytes.Length == 0 || bytes.Length > maxStoredBytes)
            {
                _logger.LogWarning(
                    "Skipping archive entry {EntryName} after processing: size {SizeBytes} exceeds {MaxBytes}",
                    entry.FullName,
                    bytes.Length,
                    maxStoredBytes);
                continue;
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

            prepared.Add(new PreparedStickerFile(entry.FullName, bytes, extension.ToLowerInvariant(), contentType));
        }

        return prepared;
    }

    private static StickerPackDto MapPack(StickerPack pack) =>
        new()
        {
            Id = pack.Id,
            Title = pack.Title,
            CoverImagePath = pack.CoverImagePath,
            CreatedAt = pack.CreatedAt,
            Stickers = pack.Stickers
                .OrderBy(s => s.SortOrder)
                .Select(s => new StickerDto
                {
                    Id = s.Id,
                    StickerPackId = s.StickerPackId,
                    FilePath = s.FilePath,
                    ContentType = s.ContentType,
                    SortOrder = s.SortOrder
                })
                .ToList()
        };

    private sealed record PreparedStickerFile(
        string EntryName,
        byte[] Bytes,
        string Extension,
        string ContentType);
}
