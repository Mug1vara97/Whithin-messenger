using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Media.UploadMedia;
using WhithinMessenger.Application.CommandsAndQueries.Media.DeleteMedia;
using WhithinMessenger.Application.CommandsAndQueries.Media.GetMediaFiles;
using WhithinMessenger.Application.CommandsAndQueries.User.GetUserProfile;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Api.Hubs;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IFileService _fileService;
    private readonly IHubContext<GroupChatHub> _hubContext;
    private readonly ILogger<MediaController> _logger;

    public MediaController(
        IMediator mediator,
        IFileService fileService,
        IHubContext<GroupChatHub> hubContext,
        ILogger<MediaController> logger)
    {
        _mediator = mediator;
        _fileService = fileService;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadMedia(
        [FromForm] Guid chatId,
        [FromForm] IFormFile file,
        [FromForm] string? caption = null,
        [FromForm] Guid? userId = null,
        [FromForm] string? username = null)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("Файл не выбран");
            }

            if (userId == null || userId == Guid.Empty)
            {
                userId = GetCurrentUserId();
                if (userId == Guid.Empty)
                {
                    return Unauthorized("Пользователь не авторизован");
                }
            }

        if (string.IsNullOrEmpty(username))
        {
            username = GetCurrentUsername();
            _logger.LogInformation($"MediaController: Retrieved username from context: {username}");
        }
        else
        {
            _logger.LogInformation($"MediaController: Username provided in form: {username}");
        }

            var command = new UploadMediaCommand(userId.Value, chatId, file, caption, username);
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
                            createdAt = DateTimeOffset.UtcNow
                        }
                    };

                    var userProfile = await _mediator.Send(new GetUserProfileQuery(userId.Value));
                    string avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(userId.Value);
                    string? avatarUrl = userProfile?.Avatar;

                    await _hubContext.Clients.Group(chatId.ToString()).SendAsync("MessageSent", 
                        new { 
                            messageId = result.MessageId,  // Используем MessageId для корректного удаления
                            content = caption ?? string.Empty, 
                            username = username ?? "Unknown",
                            chatId = chatId,
                            avatarUrl = avatarUrl,
                            avatarColor = avatarColor,
                            repliedMessage = (object?)null,
                            forwardedMessage = (object?)null,
                            mediaFiles = mediaFiles
                        });
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

    [HttpGet("download/{filePath}")]
    public async Task<IActionResult> DownloadFile(string filePath)
    {
        try
        {
            var fileData = await _fileService.GetFileAsync(filePath);
            if (fileData == null)
            {
                return NotFound("Файл не найден");
            }

            var contentType = await _fileService.GetContentTypeAsync(filePath);
            var fileName = Path.GetFileName(filePath);

            return File(fileData, contentType, fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading file {FilePath}", filePath);
            return StatusCode(500, "Ошибка при загрузке файла");
        }
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
        var httpContext = HttpContext;
        _logger.LogInformation($"GetCurrentUsername: HttpContext is null: {httpContext == null}");
        
        if (httpContext?.Items.ContainsKey("User") == true)
        {
            var user = httpContext.Items["User"] as Microsoft.AspNetCore.Identity.IdentityUser;
            _logger.LogInformation($"GetCurrentUsername: User found in context: {user?.UserName}");
            return user?.UserName;
        }
        
        _logger.LogWarning("GetCurrentUsername: No User found in HttpContext.Items");
        return null;
    }

    private static string GenerateAvatarColor(Guid userId) 
    {
        string[] colors = { "#5865F2", "#EB459E", "#ED4245", "#FEE75C", "#57F287", "#FAA61A" };
        int index = Math.Abs(userId.GetHashCode()) % colors.Length;
        return colors[index];
    }
}
