using System.IO.Compression;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Stickers;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Application.Stickers;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.UploadStickerPack;

public class UploadStickerPackCommandHandler : IRequestHandler<UploadStickerPackCommand, UploadStickerPackResult>
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".webp", ".png", ".gif", ".jpg", ".jpeg", ".webm"
    };

    private const int MaxImageStickerBytes = 2 * 1024 * 1024;
    private const int MaxVideoStickerBytes = 5 * 1024 * 1024;

    private readonly IStickerPackRepository _stickerPackRepository;
    private readonly IFileService _fileService;
    private readonly IVideoConverterService _videoConverterService;

    public UploadStickerPackCommandHandler(
        IStickerPackRepository stickerPackRepository,
        IFileService fileService,
        IVideoConverterService videoConverterService)
    {
        _stickerPackRepository = stickerPackRepository;
        _fileService = fileService;
        _videoConverterService = videoConverterService;
    }

    public async Task<UploadStickerPackResult> Handle(UploadStickerPackCommand request, CancellationToken cancellationToken)
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

            var archiveName = request.Archive.FileName ?? string.Empty;
            if (!archiveName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Поддерживаются только ZIP-архивы"
                };
            }

            var pack = new StickerPack
            {
                Id = Guid.NewGuid(),
                Title = title,
                CreatedByUserId = request.UserId,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _stickerPackRepository.CreatePackAsync(pack, cancellationToken);

            var stickers = new List<Sticker>();
            var sortOrder = 0;

            await using var archiveStream = request.Archive.OpenReadStream();
            using var zip = new ZipArchive(archiveStream, ZipArchiveMode.Read);

            foreach (var entry in zip.Entries
                         .Where(e => !e.FullName.EndsWith('/') && !string.IsNullOrWhiteSpace(e.Name))
                         .OrderBy(e => e.FullName, StringComparer.OrdinalIgnoreCase))
            {
                var extension = Path.GetExtension(entry.Name);
                if (!AllowedExtensions.Contains(extension))
                {
                    continue;
                }

                await using var entryStream = entry.Open();
                await using var memory = new MemoryStream();
                await entryStream.CopyToAsync(memory, cancellationToken);
                var bytes = memory.ToArray();
                var maxBytes = extension.Equals(".webm", StringComparison.OrdinalIgnoreCase)
                    ? MaxVideoStickerBytes
                    : MaxImageStickerBytes;
                if (bytes.Length == 0 || bytes.Length > maxBytes)
                {
                    continue;
                }

                if (extension.Equals(".webm", StringComparison.OrdinalIgnoreCase))
                {
                    var converted = await _videoConverterService.TryConvertWebmToAnimatedWebpAsync(
                        bytes,
                        cancellationToken);
                    if (converted != null)
                    {
                        bytes = converted.Bytes;
                        extension = converted.Extension;
                    }
                }

                var fileName = $"{Guid.NewGuid()}{extension.ToLowerInvariant()}";
                var folderPath = $"stickers/{pack.Id}";
                var uploadsPath = Path.Combine(_fileService.GetFullPathForFolder(folderPath));
                Directory.CreateDirectory(uploadsPath);
                var absolutePath = Path.Combine(uploadsPath, fileName);
                await File.WriteAllBytesAsync(absolutePath, bytes, cancellationToken);

                var relativePath = Path.Combine("uploads", folderPath, fileName).Replace("\\", "/");
                var contentType = extension.ToLowerInvariant() switch
                {
                    ".webp" => "image/webp",
                    ".png" => "image/png",
                    ".gif" => "image/gif",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".webm" => "video/webm",
                    _ => "application/octet-stream"
                };

                if (bytes.Length > MaxImageStickerBytes)
                {
                    continue;
                }

                stickers.Add(new Sticker
                {
                    Id = Guid.NewGuid(),
                    StickerPackId = pack.Id,
                    FilePath = relativePath,
                    ContentType = contentType,
                    SortOrder = sortOrder++
                });
            }

            if (stickers.Count == 0)
            {
                return new UploadStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "В архиве не найдено стикеров (webp, png, gif, jpg, webm)"
                };
            }

            pack.CoverImagePath =
                stickers.FirstOrDefault(s => s.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))?.FilePath
                ?? stickers[0].FilePath;
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

            created.CoverImagePath = pack.CoverImagePath;
            // Cover path is set on entity before stickers; reload includes stickers.

            return new UploadStickerPackResult
            {
                Success = true,
                Pack = MapPack(created)
            };
        }
        catch (Exception ex)
        {
            return new UploadStickerPackResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
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
}
