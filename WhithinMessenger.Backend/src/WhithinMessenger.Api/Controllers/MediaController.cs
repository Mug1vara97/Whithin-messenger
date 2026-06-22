using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MediatR;
using System.Globalization;
using System.Security.Claims;
using WhithinMessenger.Application.CommandsAndQueries.Media.UploadMedia;
using WhithinMessenger.Application.CommandsAndQueries.Media.UploadMediaBatch;
using WhithinMessenger.Application.CommandsAndQueries.Media.DeleteMedia;
using WhithinMessenger.Application.CommandsAndQueries.Media.GetMediaFiles;
using WhithinMessenger.Application.CommandsAndQueries.User.GetUserProfile;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Api.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IFileService _fileService;
    private readonly IHubContext<GroupChatHub> _hubContext;
    private readonly IMessageReceiptService _messageReceiptService;
    private readonly ChatMessageNotificationService _chatMessageNotificationService;
    private readonly ILogger<MediaController> _logger;

    public MediaController(
        IMediator mediator,
        IFileService fileService,
        IHubContext<GroupChatHub> hubContext,
        IMessageReceiptService messageReceiptService,
        ChatMessageNotificationService chatMessageNotificationService,
        ILogger<MediaController> logger)
    {
        _mediator = mediator;
        _fileService = fileService;
        _hubContext = hubContext;
        _messageReceiptService = messageReceiptService;
        _chatMessageNotificationService = chatMessageNotificationService;
        _logger = logger;
    }

    [HttpPost("upload")]
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = 10737418240)] // 10 GB для загрузки файлов
    public async Task<IActionResult> UploadMedia(
        [FromForm] string? chatId,
        [FromForm] IFormFile? file,
        [FromForm] string? caption = null,
        [FromForm] string? username = null,
        [FromForm] string? isVideoNote = null,
        [FromForm] string? durationSeconds = null)
    {
        try
        {
            if (!TryParseChatId(chatId, out var parsedChatId, out var chatIdError))
            {
                return BadRequest(new { success = false, error = chatIdError });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { success = false, error = "Файл не выбран" });
            }

            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
            {
                return Unauthorized(new { success = false, error = "Пользователь не авторизован" });
            }

            if (string.IsNullOrEmpty(username))
            {
                username = GetCurrentUsername();
                _logger.LogInformation("MediaController: Retrieved username from context: {Username}", username);
            }
            else
            {
                _logger.LogInformation("MediaController: Username provided in form: {Username}", username);
            }

            var videoNote = string.Equals(isVideoNote, "true", StringComparison.OrdinalIgnoreCase);
            double? parsedDuration = null;
            if (!string.IsNullOrWhiteSpace(durationSeconds)
                && double.TryParse(
                    durationSeconds,
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out var durationValue)
                && durationValue > 0)
            {
                parsedDuration = durationValue;
            }

            var command = new UploadMediaCommand(
                userId,
                parsedChatId,
                file,
                caption,
                username,
                videoNote,
                parsedDuration);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                try
                {
                    var mediaFiles = new[]
                    {
                        new
                        {
                            id = result.MediaFileId,
                            fileName = Path.GetFileName(result.FilePath),
                            originalFileName = file.FileName,
                            filePath = result.FilePath,
                            contentType = file.ContentType,
                            fileSize = file.Length,
                            thumbnailPath = result.ThumbnailPath,
                            createdAt = DateTimeOffset.UtcNow,
                            isVideoNote = result.IsVideoNote,
                            durationSeconds = result.DurationSeconds,
                            streamingManifestPath = result.StreamingManifestPath
                        }
                    };

                    var userProfile = await _mediator.Send(new GetUserProfileQuery(userId));
                    string avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(userId);
                    string? avatarUrl = userProfile?.Avatar;

                    await _hubContext.Clients.Group(parsedChatId.ToString()).SendAsync("MessageSent", 
                        new { 
                            messageId = result.MessageId,  // Используем MessageId для корректного удаления
                            senderId = userId,
                            content = caption ?? string.Empty, 
                            username = username ?? "Unknown",
                            senderDisplayName = userProfile?.DisplayName,
                            senderLogin = username,
                            chatId = parsedChatId,
                            avatarUrl = avatarUrl,
                            avatarColor = avatarColor,
                            repliedMessage = (object?)null,
                            forwardedMessage = (object?)null,
                            mediaFiles = mediaFiles,
                            status = MessageStatusHelper.Sent
                        });

                    if (result.MessageId.HasValue)
                    {
                        await _messageReceiptService.AutoDeliverToReachableRecipientsAsync(
                            parsedChatId,
                            result.MessageId.Value,
                            userId);
                    }

                    await _chatMessageNotificationService.NotifyMediaMessageAsync(
                        parsedChatId,
                        userId,
                        username ?? "Unknown",
                        result.MessageId,
                        caption,
                        file.ContentType ?? "application/octet-stream",
                        result.IsVideoNote,
                        result.ThumbnailPath,
                        result.FilePath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send SignalR notification for media upload");
                }

                return Ok(new
                {
                    success = true,
                    messageId = result.MessageId,
                    mediaFileId = result.MediaFileId,
                    filePath = result.FilePath,
                    thumbnailPath = result.ThumbnailPath
                });
            }

            return BadRequest(new { success = false, error = result.ErrorMessage });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading media file");
            return StatusCode(500, new { success = false, error = "Внутренняя ошибка сервера" });
        }
    }

    [HttpPost("upload-batch")]
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = 10737418240)]
    public async Task<IActionResult> UploadMediaBatch(
        [FromForm] string? chatId,
        [FromForm] List<IFormFile>? files,
        [FromForm] string? caption = null,
        [FromForm] string? username = null)
    {
        try
        {
            if (!TryParseChatId(chatId, out var parsedChatId, out var chatIdError))
            {
                return BadRequest(new { success = false, error = chatIdError });
            }

            if (files == null || files.Count == 0)
            {
                return BadRequest(new { success = false, error = "Файлы не выбраны" });
            }

            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
            {
                return Unauthorized(new { success = false, error = "Пользователь не авторизован" });
            }

            if (string.IsNullOrEmpty(username))
            {
                username = GetCurrentUsername();
            }

            var command = new UploadMediaBatchCommand(userId, parsedChatId, files, caption, username);
            var result = await _mediator.Send(command);

            if (!result.Success)
            {
                return BadRequest(new { success = false, error = result.ErrorMessage });
            }

            try
            {
                var mediaFiles = result.MediaItems.Select(item => new
                {
                    id = item.MediaFileId,
                    fileName = Path.GetFileName(item.FilePath),
                    originalFileName = item.OriginalFileName,
                    filePath = item.FilePath,
                    contentType = item.ContentType,
                    fileSize = item.FileSize,
                    thumbnailPath = item.ThumbnailPath,
                    createdAt = DateTimeOffset.UtcNow,
                    isVideoNote = item.IsVideoNote
                }).ToArray();

                var userProfile = await _mediator.Send(new GetUserProfileQuery(userId));
                string avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(userId);
                string? avatarUrl = userProfile?.Avatar;

                await _hubContext.Clients.Group(parsedChatId.ToString()).SendAsync("MessageSent",
                    new
                    {
                        messageId = result.MessageId,
                        senderId = userId,
                        content = caption ?? string.Empty,
                        username = username ?? "Unknown",
                        senderDisplayName = userProfile?.DisplayName,
                        senderLogin = username,
                        chatId = parsedChatId,
                        avatarUrl = avatarUrl,
                        avatarColor = avatarColor,
                        repliedMessage = (object?)null,
                        forwardedMessage = (object?)null,
                        mediaFiles = mediaFiles,
                        status = MessageStatusHelper.Sent
                    });

                if (result.MessageId.HasValue)
                {
                    await _messageReceiptService.AutoDeliverToReachableRecipientsAsync(
                        parsedChatId,
                        result.MessageId.Value,
                        userId);
                }

                var firstMedia = result.MediaItems.FirstOrDefault();
                if (firstMedia != null)
                {
                    await _chatMessageNotificationService.NotifyMediaMessageAsync(
                        parsedChatId,
                        userId,
                        username ?? "Unknown",
                        result.MessageId,
                        caption,
                        firstMedia.ContentType ?? "application/octet-stream",
                        firstMedia.IsVideoNote,
                        firstMedia.ThumbnailPath,
                        firstMedia.FilePath);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send SignalR notification for batch media upload");
            }

            return Ok(new
            {
                success = true,
                messageId = result.MessageId,
                mediaFiles = result.MediaItems.Select(item => new
                {
                    mediaFileId = item.MediaFileId,
                    filePath = item.FilePath,
                    thumbnailPath = item.ThumbnailPath
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading media batch");
            return StatusCode(500, new { success = false, error = "Внутренняя ошибка сервера" });
        }
    }

    [HttpGet("{chatId}")]
    public async Task<IActionResult> GetMediaFiles(
        Guid chatId,
        [FromQuery] string? mediaType = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var query = new GetMediaFilesQuery(chatId, mediaType, page, pageSize);
            var result = await _mediator.Send(query);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting media files for chat {ChatId}", chatId);
            return StatusCode(500, new { success = false, error = "Внутренняя ошибка сервера" });
        }
    }

    [HttpDelete("{mediaFileId}")]
    public async Task<IActionResult> DeleteMedia(Guid mediaFileId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
            {
                return Unauthorized();
            }

            var command = new DeleteMediaCommand(userId, mediaFileId);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                return Ok(new { success = true });
            }

            return BadRequest(new { success = false, error = result.ErrorMessage });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting media file {MediaFileId}", mediaFileId);
            return StatusCode(500, new { success = false, error = "Внутренняя ошибка сервера" });
        }
    }

    [HttpGet("download")]
    public async Task<IActionResult> DownloadFile([FromQuery] string filePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(filePath))
            {
                return BadRequest("Путь к файлу не указан");
            }

            var normalizedFilePath = filePath.Trim().TrimStart('/');
            var fileData = await _fileService.GetFileAsync(normalizedFilePath);
            if (fileData == null)
            {
                return NotFound("Файл не найден");
            }

            var contentType = await _fileService.GetContentTypeAsync(normalizedFilePath);
            var fileName = Path.GetFileName(normalizedFilePath);

            return File(fileData, contentType, fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading file {FilePath}", filePath);
            return StatusCode(500, "Ошибка при загрузке файла");
        }
    }

    private static bool TryParseChatId(string? chatId, out Guid parsedChatId, out string errorMessage)
    {
        if (string.IsNullOrWhiteSpace(chatId))
        {
            parsedChatId = Guid.Empty;
            errorMessage = "Не указан идентификатор чата";
            return false;
        }

        if (Guid.TryParse(chatId.Trim(), out parsedChatId))
        {
            errorMessage = string.Empty;
            return true;
        }

        errorMessage = "Некорректный идентификатор чата";
        return false;
    }

    private Guid GetCurrentUserId()
    {
        var httpContext = HttpContext;
        if (httpContext?.Items.ContainsKey("UserId") == true)
        {
            return (Guid)httpContext.Items["UserId"];
        }
        return Guid.Empty;
    }

    private string? GetCurrentUsername()
    {
        if (HttpContext?.Items["User"] is ApplicationUser appUser
            && !string.IsNullOrWhiteSpace(appUser.UserName))
        {
            return appUser.UserName;
        }

        var fromClaims = User.FindFirst("Username")?.Value
            ?? User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.Identity?.Name;

        return string.IsNullOrWhiteSpace(fromClaims) ? null : fromClaims;
    }

    private static string GenerateAvatarColor(Guid userId) 
    {
        string[] colors = { "#5865F2", "#EB459E", "#ED4245", "#FEE75C", "#57F287", "#FAA61A" };
        int index = Math.Abs(userId.GetHashCode()) % colors.Length;
        return colors[index];
    }
}
