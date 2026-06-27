using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Stickers;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Application.Stickers;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.AddStickerToPack;

public class AddStickerToPackCommandHandler : IRequestHandler<AddStickerToPackCommand, AddStickerToPackResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;
    private readonly IFileService _fileService;
    private readonly IStickerFileProcessingService _stickerFileProcessingService;

    public AddStickerToPackCommandHandler(
        IStickerPackRepository stickerPackRepository,
        IFileService fileService,
        IStickerFileProcessingService stickerFileProcessingService)
    {
        _stickerPackRepository = stickerPackRepository;
        _fileService = fileService;
        _stickerFileProcessingService = stickerFileProcessingService;
    }

    public async Task<AddStickerToPackResult> Handle(
        AddStickerToPackCommand request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (request.File == null || request.File.Length == 0)
            {
                return new AddStickerToPackResult
                {
                    Success = false,
                    ErrorMessage = "Файл не выбран"
                };
            }

            var pack = await _stickerPackRepository.GetByIdForEditAsync(request.PackId, cancellationToken);
            if (pack == null)
            {
                return new AddStickerToPackResult
                {
                    Success = false,
                    ErrorMessage = "Стикерпак не найден"
                };
            }

            if (pack.CreatedByUserId != request.UserId)
            {
                return new AddStickerToPackResult
                {
                    Success = false,
                    ErrorMessage = "Добавлять стикеры может только создатель стикерпака"
                };
            }

            await using var stream = request.File.OpenReadStream();
            await using var memory = new MemoryStream();
            await stream.CopyToAsync(memory, cancellationToken);
            var bytes = memory.ToArray();

            var processed = await _stickerFileProcessingService.ProcessAsync(
                request.File.FileName,
                bytes,
                cancellationToken);
            if (processed == null)
            {
                return new AddStickerToPackResult
                {
                    Success = false,
                    ErrorMessage = "Неподдерживаемый формат или слишком большой файл (webp, png, gif, jpg, webm до 2–5 МБ)"
                };
            }

            var folderPath = $"stickers/{pack.Id}";
            var uploadsPath = Path.Combine(_fileService.GetFullPathForFolder(folderPath));
            Directory.CreateDirectory(uploadsPath);

            var fileName = $"{Guid.NewGuid()}{processed.Extension}";
            var absolutePath = Path.Combine(uploadsPath, fileName);
            await File.WriteAllBytesAsync(absolutePath, processed.Bytes, cancellationToken);

            var relativePath = Path.Combine("uploads", folderPath, fileName).Replace("\\", "/");
            var nextSortOrder = pack.Stickers.Count == 0
                ? 0
                : pack.Stickers.Max(s => s.SortOrder) + 1;

            var sticker = new Sticker
            {
                Id = Guid.NewGuid(),
                StickerPackId = pack.Id,
                FilePath = relativePath,
                ContentType = processed.ContentType,
                SortOrder = nextSortOrder
            };

            await _stickerPackRepository.AddStickersAsync([sticker], cancellationToken);

            if (string.IsNullOrWhiteSpace(pack.CoverImagePath) &&
                processed.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                pack.CoverImagePath = relativePath;
                await _stickerPackRepository.UpdatePackAsync(pack, cancellationToken);
            }

            var updated = await _stickerPackRepository.GetByIdWithStickersAsync(pack.Id, cancellationToken);
            if (updated == null)
            {
                return new AddStickerToPackResult
                {
                    Success = false,
                    ErrorMessage = "Не удалось обновить стикерпак"
                };
            }

            var stickerDto = updated.Stickers
                .OrderBy(s => s.SortOrder)
                .FirstOrDefault(s => s.Id == sticker.Id);

            return new AddStickerToPackResult
            {
                Success = true,
                Pack = StickerPackMapper.ToDto(updated),
                Sticker = stickerDto == null
                    ? null
                    : new StickerDto
                    {
                        Id = stickerDto.Id,
                        StickerPackId = stickerDto.StickerPackId,
                        FilePath = stickerDto.FilePath,
                        ContentType = stickerDto.ContentType,
                        SortOrder = stickerDto.SortOrder
                    }
            };
        }
        catch (Exception ex)
        {
            return new AddStickerToPackResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
