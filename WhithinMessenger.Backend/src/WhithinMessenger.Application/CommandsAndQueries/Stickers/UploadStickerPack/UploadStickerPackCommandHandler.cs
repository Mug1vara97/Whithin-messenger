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

    private readonly IStickerPackRepository _stickerPackRepository;
    private readonly IFileService _fileService;
    private readonly IStickerFileProcessingService _stickerFileProcessingService;
    private readonly ILogger<UploadStickerPackCommandHandler> _logger;

    public UploadStickerPackCommandHandler(
        IStickerPackRepository stickerPackRepository,
        IFileService fileService,
        IStickerFileProcessingService stickerFileProcessingService,
        ILogger<UploadStickerPackCommandHandler> logger)
    {
        _stickerPackRepository = stickerPackRepository;
        _fileService = fileService;
        _stickerFileProcessingService = stickerFileProcessingService;
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
            var title = request.Title?.Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Укажите название стикерпака"
                };
            }

            if (title.Length > 100)
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Название не может быть длиннее 100 символов"
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
                    prepared.SourceName,
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
                Pack = StickerPackMapper.ToDto(created)
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

    private async Task<List<ProcessedStickerFile>> ExtractStickersFromArchiveAsync(
        Stream archiveStream,
        CancellationToken cancellationToken)
    {
        var prepared = new List<ProcessedStickerFile>();

        using var zip = new ZipArchive(archiveStream, ZipArchiveMode.Read);
        foreach (var entry in zip.Entries
                     .Where(e => !e.FullName.EndsWith('/') && !string.IsNullOrWhiteSpace(e.Name))
                     .OrderBy(e => e.FullName, StringComparer.OrdinalIgnoreCase))
        {
            await using var entryStream = entry.Open();
            await using var memory = new MemoryStream();
            await entryStream.CopyToAsync(memory, cancellationToken);
            var bytes = memory.ToArray();

            var processed = await _stickerFileProcessingService.ProcessAsync(
                entry.Name,
                bytes,
                cancellationToken);
            if (processed != null)
            {
                prepared.Add(processed);
            }
            else
            {
                _logger.LogDebug("Skipping archive entry {EntryName}", entry.FullName);
            }
        }

        return prepared;
    }
}
