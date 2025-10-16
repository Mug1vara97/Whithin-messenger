using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Application.CommandsAndQueries.Chats.UpdateChatAvatar;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.UploadChatAvatar;

public class UploadChatAvatarCommandHandler : IRequestHandler<UploadChatAvatarCommand, UploadChatAvatarResult>
{
    private readonly IFileService _fileService;
    private readonly IMediator _mediator;

    public UploadChatAvatarCommandHandler(IFileService fileService, IMediator mediator)
    {
        _fileService = fileService;
        _mediator = mediator;
    }

    public async Task<UploadChatAvatarResult> Handle(UploadChatAvatarCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Валидация файла
            if (request.File == null || request.File.Length == 0)
            {
                return new UploadChatAvatarResult
                {
                    Success = false,
                    ErrorMessage = "Файл не выбран"
                };
            }

            // Проверяем тип файла
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(request.File.ContentType))
            {
                return new UploadChatAvatarResult
                {
                    Success = false,
                    ErrorMessage = "Неподдерживаемый тип файла. Разрешены: JPEG, PNG, GIF, WebP"
                };
            }

            // Проверяем размер файла (максимум 5MB)
            if (request.File.Length > 5 * 1024 * 1024)
            {
                return new UploadChatAvatarResult
                {
                    Success = false,
                    ErrorMessage = "Размер файла не должен превышать 5MB"
                };
            }

            // Сохраняем файл
            var avatarUrl = await _fileService.SaveChatAvatarAsync(request.File, cancellationToken);
            
            if (string.IsNullOrEmpty(avatarUrl))
            {
                return new UploadChatAvatarResult
                {
                    Success = false,
                    ErrorMessage = "Ошибка при сохранении файла"
                };
            }

            // Обновляем аватар чата в базе данных
            var updateCommand = new UpdateChatAvatarCommand(request.ChatId, request.UserId, avatarUrl);
            var updateResult = await _mediator.Send(updateCommand, cancellationToken);

            if (!updateResult.Success)
            {
                // Удаляем файл если не удалось сохранить в БД
                await _fileService.DeleteFileAsync(avatarUrl, cancellationToken);
                
                return new UploadChatAvatarResult
                {
                    Success = false,
                    ErrorMessage = updateResult.ErrorMessage
                };
            }

            return new UploadChatAvatarResult
            {
                Success = true,
                AvatarUrl = avatarUrl
            };
        }
        catch (Exception ex)
        {
            return new UploadChatAvatarResult
            {
                Success = false,
                ErrorMessage = "Произошла ошибка при загрузке аватара чата: " + ex.Message
            };
        }
    }
}

