using MediatR;
using Microsoft.Extensions.Logging;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.UploadMedia;

public class UploadMediaCommandHandler : IRequestHandler<UploadMediaCommand, UploadMediaResult>
{
    private readonly IFileService _fileService;
    private readonly IMediaFileRepository _mediaFileRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly ILogger<UploadMediaCommandHandler> _logger;

    public UploadMediaCommandHandler(
        IFileService fileService,
        IMediaFileRepository mediaFileRepository,
        IMessageRepository messageRepository,
        ILogger<UploadMediaCommandHandler> logger)
    {
        _fileService = fileService;
        _mediaFileRepository = mediaFileRepository;
        _messageRepository = messageRepository;
        _logger = logger;
    }

    public async Task<UploadMediaResult> Handle(UploadMediaCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Проверяем размер файла (максимум 50MB)
            if (request.File.Length > 50 * 1024 * 1024)
            {
                return new UploadMediaResult
                {
                    Success = false,
                    ErrorMessage = "Файл слишком большой. Максимальный размер: 50MB"
                };
            }

            // Определяем тип медиафайла
            var contentType = request.File.ContentType;
            var folderPath = _fileService.GetMediaFolderPath(contentType);

            // Сохраняем файл
            var filePath = await _fileService.SaveFileAsync(request.File, folderPath);

            // Создаем сообщение с медиафайлом
            var message = new Message
            {
                Id = Guid.NewGuid(),
                ChatId = request.ChatId,
                UserId = request.UserId,
                Content = request.Caption ?? string.Empty,
                CreatedAt = DateTimeOffset.UtcNow,
                ContentType = "media"
            };

            var savedMessage = await _messageRepository.AddAsync(message, cancellationToken);

            // Создаем запись о медиафайле
            var mediaFile = new MediaFile
            {
                Id = Guid.NewGuid(),
                MessageId = savedMessage.Id,
                FileName = Path.GetFileName(filePath),
                OriginalFileName = request.File.FileName,
                FilePath = filePath,
                ContentType = contentType,
                FileSize = request.File.Length,
                CreatedAt = DateTimeOffset.UtcNow
            };

            // Создаем превью для изображений
            if (_fileService.IsImageFile(contentType))
            {
                try
                {
                    using var stream = request.File.OpenReadStream();
                    var imageData = new byte[stream.Length];
                    await stream.ReadAsync(imageData, 0, imageData.Length, cancellationToken);
                    
                    var thumbnailPath = await _fileService.SaveThumbnailAsync(
                        imageData, 
                        request.File.FileName, 
                        folderPath
                    );
                    mediaFile.ThumbnailPath = thumbnailPath;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to create thumbnail for image: {FileName}", request.File.FileName);
                }
            }

            var savedMediaFile = await _mediaFileRepository.AddAsync(mediaFile, cancellationToken);

            return new UploadMediaResult
            {
                Success = true,
                MediaFileId = savedMediaFile.Id,
                FilePath = savedMediaFile.FilePath,
                ThumbnailPath = savedMediaFile.ThumbnailPath
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading media file: {FileName}", request.File.FileName);
            return new UploadMediaResult
            {
                Success = false,
                ErrorMessage = "Ошибка при загрузке файла"
            };
        }
    }
}
