using MediatR;
using Microsoft.Extensions.Logging;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.UploadMediaBatch;

public class UploadMediaBatchCommandHandler : IRequestHandler<UploadMediaBatchCommand, UploadMediaBatchResult>
{
    private const int MaxBatchSize = 10;

    private readonly IFileService _fileService;
    private readonly IVideoConverterService _videoConverterService;
    private readonly IMediaFileRepository _mediaFileRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly ILogger<UploadMediaBatchCommandHandler> _logger;

    public UploadMediaBatchCommandHandler(
        IFileService fileService,
        IVideoConverterService videoConverterService,
        IMediaFileRepository mediaFileRepository,
        IMessageRepository messageRepository,
        ILogger<UploadMediaBatchCommandHandler> logger)
    {
        _fileService = fileService;
        _videoConverterService = videoConverterService;
        _mediaFileRepository = mediaFileRepository;
        _messageRepository = messageRepository;
        _logger = logger;
    }

    public async Task<UploadMediaBatchResult> Handle(UploadMediaBatchCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var files = request.Files.Where(f => f is { Length: > 0 }).ToList();
            if (files.Count == 0)
            {
                return new UploadMediaBatchResult
                {
                    Success = false,
                    ErrorMessage = "Файлы не выбраны"
                };
            }

            if (files.Count > MaxBatchSize)
            {
                return new UploadMediaBatchResult
                {
                    Success = false,
                    ErrorMessage = $"Можно отправить не больше {MaxBatchSize} файлов за раз"
                };
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
            var uploadedItems = new List<UploadMediaBatchMediaItem>(files.Count);

            foreach (var file in files)
            {
                var mediaItem = await SaveMediaFileAsync(savedMessage.Id, file, cancellationToken);
                uploadedItems.Add(mediaItem);
            }

            return new UploadMediaBatchResult
            {
                Success = true,
                MessageId = savedMessage.Id,
                MediaItems = uploadedItems
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading media batch");
            return new UploadMediaBatchResult
            {
                Success = false,
                ErrorMessage = "Ошибка при загрузке файлов"
            };
        }
    }

    private async Task<UploadMediaBatchMediaItem> SaveMediaFileAsync(
        Guid messageId,
        Microsoft.AspNetCore.Http.IFormFile file,
        CancellationToken cancellationToken)
    {
        var contentType = file.ContentType;
        var folderPath = _fileService.GetMediaFolderPath(contentType);
        var filePath = await _fileService.SaveFileAsync(file, folderPath);
        var convertedFileName = Path.GetFileName(filePath);

        if (_videoConverterService.IsVideoFile(contentType))
        {
            try
            {
                var fullFilePath = _fileService.GetFullPath(filePath);
                if (_videoConverterService.NeedsConversion(fullFilePath))
                {
                    var outputFolder = _fileService.GetFullPathForFolder(folderPath);
                    var convertedFileNameResult = await _videoConverterService.ConvertVideoToH264Async(
                        fullFilePath,
                        outputFolder,
                        cancellationToken);

                    if (!string.IsNullOrEmpty(convertedFileNameResult))
                    {
                        try
                        {
                            File.Delete(fullFilePath);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to delete original video file: {FilePath}", fullFilePath);
                        }

                        filePath = Path.Combine("uploads", folderPath, convertedFileNameResult).Replace("\\", "/");
                        convertedFileName = convertedFileNameResult;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during video conversion, using original file: {FilePath}", filePath);
            }
        }

        var finalFilePath = _fileService.GetFullPath(filePath);
        var finalFileSize = File.Exists(finalFilePath)
            ? new FileInfo(finalFilePath).Length
            : file.Length;

        var mediaFile = new MediaFile
        {
            Id = Guid.NewGuid(),
            MessageId = messageId,
            FileName = convertedFileName,
            OriginalFileName = file.FileName,
            FilePath = filePath,
            ContentType = contentType,
            FileSize = finalFileSize,
            CreatedAt = DateTimeOffset.UtcNow,
            IsVideoNote = false
        };

        if (_fileService.IsImageFile(contentType))
        {
            try
            {
                using var stream = file.OpenReadStream();
                var imageData = new byte[stream.Length];
                await stream.ReadAsync(imageData, 0, imageData.Length, cancellationToken);

                var thumbnailPath = await _fileService.SaveThumbnailAsync(
                    imageData,
                    file.FileName,
                    folderPath);
                mediaFile.ThumbnailPath = thumbnailPath;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to create thumbnail for image: {FileName}", file.FileName);
            }
        }

        var savedMediaFile = await _mediaFileRepository.AddAsync(mediaFile, cancellationToken);

        return new UploadMediaBatchMediaItem
        {
            MediaFileId = savedMediaFile.Id,
            FilePath = savedMediaFile.FilePath,
            ThumbnailPath = savedMediaFile.ThumbnailPath,
            ContentType = savedMediaFile.ContentType,
            OriginalFileName = savedMediaFile.OriginalFileName,
            FileSize = savedMediaFile.FileSize,
            IsVideoNote = savedMediaFile.IsVideoNote
        };
    }
}
