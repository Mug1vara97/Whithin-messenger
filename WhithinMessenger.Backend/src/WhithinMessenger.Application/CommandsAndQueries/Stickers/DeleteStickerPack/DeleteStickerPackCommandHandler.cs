using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.DeleteStickerPack;

public class DeleteStickerPackCommandHandler : IRequestHandler<DeleteStickerPackCommand, DeleteStickerPackResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;
    private readonly IFileService _fileService;

    public DeleteStickerPackCommandHandler(
        IStickerPackRepository stickerPackRepository,
        IFileService fileService)
    {
        _stickerPackRepository = stickerPackRepository;
        _fileService = fileService;
    }

    public async Task<DeleteStickerPackResult> Handle(DeleteStickerPackCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var pack = await _stickerPackRepository.GetByIdWithStickersAsync(request.PackId, cancellationToken);
            if (pack == null)
            {
                return new DeleteStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Стикерпак не найден"
                };
            }

            if (pack.CreatedByUserId != request.UserId)
            {
                return new DeleteStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Удалять стикерпак может только его создатель"
                };
            }

            foreach (var sticker in pack.Stickers)
            {
                if (!string.IsNullOrWhiteSpace(sticker.FilePath))
                {
                    await _fileService.DeleteFileAsync(NormalizeStoredPath(sticker.FilePath), cancellationToken);
                }
            }

            var packFolder = _fileService.GetFullPathForFolder($"stickers/{pack.Id}");
            if (Directory.Exists(packFolder))
            {
                try
                {
                    Directory.Delete(packFolder, recursive: true);
                }
                catch
                {
                    // Файлы уже удалены по одному; пустая папка не критична.
                }
            }

            var deleted = await _stickerPackRepository.DeletePackAsync(pack.Id, cancellationToken);
            if (!deleted)
            {
                return new DeleteStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Не удалось удалить стикерпак"
                };
            }

            return new DeleteStickerPackResult { Success = true };
        }
        catch (Exception ex)
        {
            return new DeleteStickerPackResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    private static string NormalizeStoredPath(string filePath)
    {
        var normalized = filePath.Replace("\\", "/").TrimStart('/');
        return normalized.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"uploads/{normalized}";
    }
}
