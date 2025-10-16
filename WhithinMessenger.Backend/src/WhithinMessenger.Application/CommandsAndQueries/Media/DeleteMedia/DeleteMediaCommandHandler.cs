using MediatR;
using Microsoft.Extensions.Logging;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.DeleteMedia;

public class DeleteMediaCommandHandler : IRequestHandler<DeleteMediaCommand, DeleteMediaResult>
{
    private readonly IMediaFileRepository _mediaFileRepository;
    private readonly IFileService _fileService;
    private readonly ILogger<DeleteMediaCommandHandler> _logger;

    public DeleteMediaCommandHandler(
        IMediaFileRepository mediaFileRepository,
        IFileService fileService,
        ILogger<DeleteMediaCommandHandler> logger)
    {
        _mediaFileRepository = mediaFileRepository;
        _fileService = fileService;
        _logger = logger;
    }

    public async Task<DeleteMediaResult> Handle(DeleteMediaCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var mediaFile = await _mediaFileRepository.GetByIdAsync(request.MediaFileId, cancellationToken);
            if (mediaFile == null)
            {
                return new DeleteMediaResult
                {
                    Success = false,
                    ErrorMessage = "Медиафайл не найден"
                };
            }

            // Проверяем права доступа (пользователь может удалять только свои файлы)
            if (mediaFile.Message.UserId != request.UserId)
            {
                return new DeleteMediaResult
                {
                    Success = false,
                    ErrorMessage = "У вас нет прав для удаления этого файла"
                };
            }

            // Удаляем физический файл
            await _fileService.DeleteFileAsync(mediaFile.FilePath);
            
            // Удаляем превью, если есть
            if (!string.IsNullOrEmpty(mediaFile.ThumbnailPath))
            {
                await _fileService.DeleteFileAsync(mediaFile.ThumbnailPath);
            }

            // Помечаем файл как удаленный в базе данных
            await _mediaFileRepository.DeleteAsync(request.MediaFileId, cancellationToken);

            return new DeleteMediaResult
            {
                Success = true
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting media file: {MediaFileId}", request.MediaFileId);
            return new DeleteMediaResult
            {
                Success = false,
                ErrorMessage = "Ошибка при удалении файла"
            };
        }
    }
}
