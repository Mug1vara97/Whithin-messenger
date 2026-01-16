using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.UploadMedia;

public class UploadMediaCommandHandler : IRequestHandler<UploadMediaCommand, UploadMediaResult>
{
    private readonly IFileService _fileService;
    private readonly IVideoConverterService _videoConverterService;
    private readonly IMediaFileRepository _mediaFileRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly ILogger<UploadMediaCommandHandler> _logger;
    private readonly IWebHostEnvironment _environment;

    public UploadMediaCommandHandler(
        IFileService fileService,
        IVideoConverterService videoConverterService,
        IMediaFileRepository mediaFileRepository,
        IMessageRepository messageRepository,
        ILogger<UploadMediaCommandHandler> logger,
        IWebHostEnvironment environment)
    {
        _fileService = fileService;
        _videoConverterService = videoConverterService;
        _mediaFileRepository = mediaFileRepository;
        _messageRepository = messageRepository;
        _logger = logger;
        _environment = environment;
    }

    public async Task<UploadMediaResult> Handle(UploadMediaCommand request, CancellationToken cancellationToken)
    {
        try
        {
            if (request.File.Length > 50 * 1024 * 1024)
            {
                return new UploadMediaResult
                {
                    Success = false,
                    ErrorMessage = "Файл слишком большой. Максимальный размер: 50MB"
                };
            }

            var contentType = request.File.ContentType;
            var folderPath = _fileService.GetMediaFolderPath(contentType);

            var filePath = await _fileService.SaveFileAsync(request.File, folderPath);
            var originalFilePath = filePath;
            var convertedFileName = Path.GetFileName(filePath);

            // Конвертируем видео в H.264 если нужно
            if (_videoConverterService.IsVideoFile(contentType))
            {
                try
                {
                    var fullFilePath = Path.Combine(_environment.WebRootPath, filePath);
                    if (_videoConverterService.NeedsConversion(fullFilePath))
                    {
                        _logger.LogInformation("Video needs conversion, starting conversion: {FilePath}", fullFilePath);
                        
                        var outputFolder = Path.Combine(_environment.WebRootPath, "uploads", folderPath);
                        var convertedFileNameResult = await _videoConverterService.ConvertVideoToH264Async(
                            fullFilePath, 
                            outputFolder, 
                            cancellationToken);

                        if (!string.IsNullOrEmpty(convertedFileNameResult))
                        {
                            // Удаляем оригинальный файл
                            try
                            {
                                File.Delete(fullFilePath);
                                _logger.LogInformation("Original video file deleted: {FilePath}", fullFilePath);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to delete original video file: {FilePath}", fullFilePath);
                            }

                            // Используем конвертированный файл
                            filePath = Path.Combine("uploads", folderPath, convertedFileNameResult).Replace("\\", "/");
                            convertedFileName = convertedFileNameResult;
                            _logger.LogInformation("Video converted successfully: {OriginalPath} -> {ConvertedPath}", originalFilePath, filePath);
                        }
                        else
                        {
                            _logger.LogWarning("Video conversion failed, using original file: {FilePath}", fullFilePath);
                        }
                    }
                    else
                    {
                        _logger.LogInformation("Video does not need conversion: {FilePath}", fullFilePath);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during video conversion, using original file: {FilePath}", filePath);
                    // Продолжаем с оригинальным файлом в случае ошибки
                }
            }

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

            // Получаем размер файла (может измениться после конвертации)
            var finalFilePath = Path.Combine(_environment.WebRootPath, filePath);
            var finalFileSize = File.Exists(finalFilePath) 
                ? new FileInfo(finalFilePath).Length 
                : request.File.Length;

            var mediaFile = new MediaFile
            {
                Id = Guid.NewGuid(),
                MessageId = savedMessage.Id,
                FileName = convertedFileName,
                OriginalFileName = request.File.FileName,
                FilePath = filePath,
                ContentType = contentType,
                FileSize = finalFileSize,
                CreatedAt = DateTimeOffset.UtcNow
            };

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
                MessageId = savedMessage.Id,  // ID сообщения для удаления/редактирования
                MediaFileId = savedMediaFile.Id,  // ID медиафайла
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
