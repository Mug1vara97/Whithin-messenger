using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Utils;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/profile")]
public class ProfileController : ControllerBase
{
    private const int MaxDescriptionLength = 190;

    private readonly IUserProfileRepository _userProfileRepository;
    private readonly WithinDbContext _context;
    private readonly IWebHostEnvironment _environment;

    private static readonly HashSet<string> AvatarDecorationAllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".apng", ".gif", ".webp", ".webm", ".mp4", ".mov", ".mkv", ".avi",
    };

    public ProfileController(
        IUserProfileRepository userProfileRepository,
        WithinDbContext context,
        IWebHostEnvironment environment)
    {
        _userProfileRepository = userProfileRepository;
        _context = context;
        _environment = environment;
    }

    [HttpGet("{userId}/profile")]
    public async Task<IActionResult> GetUserProfile(Guid userId)
    {
        try
        {
            var userProfile = await _userProfileRepository.GetByUserIdAsync(userId);
            
            if (userProfile == null)
            {
                userProfile = new UserProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    AvatarColor = AvatarColorGenerator.GenerateColor(userId),
                    Description = null,
                    Avatar = null,
                    Banner = null,
                    Nameplate = null,
                    AvatarDecoration = null
                };
                
                await _userProfileRepository.CreateAsync(userProfile);
            }

            var user = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);

            return Ok(new
            {
                userId = userProfile.UserId,
                username = user?.UserName,
                avatar = userProfile.Avatar,
                avatarColor = userProfile.AvatarColor,
                description = userProfile.Description,
                banner = userProfile.Banner,
                nameplate = userProfile.Nameplate,
                avatarDecoration = userProfile.AvatarDecoration,
                status = user?.Status.ToString().ToLowerInvariant(),
                createdAt = user?.CreatedAt ?? DateTimeOffset.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при получении профиля пользователя: " + ex.Message });
        }
    }

    [HttpPost("update-avatar")]
    [RequireAuth]
    public async Task<IActionResult> UpdateAvatar([FromBody] UpdateAvatarRequest request)
    {
        try
        {
            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Avatar = request.Avatar;
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { Avatar = userProfile.Avatar });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении аватара: " + ex.Message });
        }
    }

    [HttpPost("update-banner")]
    [RequireAuth]
    public async Task<IActionResult> UpdateBanner([FromBody] UpdateBannerRequest request)
    {
        try
        {
            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Banner = request.Banner;
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { Banner = userProfile.Banner });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении баннера: " + ex.Message });
        }
    }

    [HttpPost("update-description")]
    [RequireAuth]
    public async Task<IActionResult> UpdateDescription([FromBody] UpdateDescriptionRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var description = request.Description?.Trim();
            if (description != null && description.Length > MaxDescriptionLength)
            {
                return BadRequest(new { error = $"Описание не может быть длиннее {MaxDescriptionLength} символов" });
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Description = string.IsNullOrWhiteSpace(description) ? null : description;
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { description = userProfile.Description });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении описания: " + ex.Message });
        }
    }

    [HttpPost("update-nameplate")]
    [RequireAuth]
    public async Task<IActionResult> UpdateNameplate([FromBody] UpdateNameplateRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Nameplate = string.IsNullOrWhiteSpace(request.Nameplate) ? null : request.Nameplate.Trim();
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { nameplate = userProfile.Nameplate });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении таблички: " + ex.Message });
        }
    }

    [HttpPost("update-avatar-decoration")]
    [RequireAuth]
    public async Task<IActionResult> UpdateAvatarDecoration([FromBody] UpdateAvatarDecorationRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.AvatarDecoration = string.IsNullOrWhiteSpace(request.AvatarDecoration)
                ? null
                : request.AvatarDecoration.Trim();
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { avatarDecoration = userProfile.AvatarDecoration });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении рамки аватара: " + ex.Message });
        }
    }

    [HttpPost("remove-avatar-decoration")]
    [RequireAuth]
    public async Task<IActionResult> RemoveAvatarDecoration([FromBody] ProfileUserRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.AvatarDecoration = null;
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { avatarDecoration = userProfile.AvatarDecoration });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при удалении рамки аватара: " + ex.Message });
        }
    }

    [HttpPost("remove-nameplate")]
    [RequireAuth]
    public async Task<IActionResult> RemoveNameplate([FromBody] ProfileUserRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Nameplate = null;
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { nameplate = userProfile.Nameplate });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при удалении таблички: " + ex.Message });
        }
    }

    [HttpPost("update-avatar-color")]
    [RequireAuth]
    public async Task<IActionResult> UpdateAvatarColor([FromBody] UpdateAvatarColorRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            if (string.IsNullOrWhiteSpace(request.AvatarColor))
            {
                return BadRequest(new { error = "Цвет не указан" });
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.AvatarColor = request.AvatarColor.Trim();
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { avatarColor = userProfile.AvatarColor });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении цвета: " + ex.Message });
        }
    }

    [HttpPost("remove-avatar")]
    [RequireAuth]
    public async Task<IActionResult> RemoveAvatar([FromBody] ProfileUserRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Avatar = null;
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { avatar = userProfile.Avatar });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при удалении аватара: " + ex.Message });
        }
    }

    [HttpPost("remove-banner")]
    [RequireAuth]
    public async Task<IActionResult> RemoveBanner([FromBody] ProfileUserRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Banner = null;
            await _userProfileRepository.UpdateAsync(userProfile);

            return Ok(new { banner = userProfile.Banner });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при удалении баннера: " + ex.Message });
        }
    }

    [HttpPost("upload/avatar")]
    [RequireAuth]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "Файл не выбран" });
            }

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType))
            {
                return BadRequest(new { error = "Неподдерживаемый тип файла" });
            }

            if (file.Length > 5 * 1024 * 1024)
            {
                return BadRequest(new { error = "Файл слишком большой (максимум 5MB)" });
            }

            var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads", "avatars");
            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
            }

            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploadsPath, fileName);
            var relativePath = $"/uploads/avatars/{fileName}";

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { url = relativePath });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при загрузке файла: " + ex.Message });
        }
    }

    [HttpPost("upload/banner")]
    [RequireAuth]
    public async Task<IActionResult> UploadBanner(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "Файл не выбран" });
            }

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType))
            {
                return BadRequest(new { error = "Неподдерживаемый тип файла" });
            }

            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { error = "Файл слишком большой (максимум 10MB)" });
            }

            var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads", "banners");
            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
            }

            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploadsPath, fileName);
            var relativePath = $"/uploads/banners/{fileName}";

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { url = relativePath });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при загрузке файла: " + ex.Message });
        }
    }

    [HttpPost("upload/nameplate")]
    [RequireAuth]
    public async Task<IActionResult> UploadNameplate(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "Файл не выбран" });
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".webm", ".png", ".webp" };
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { error = "Допустимы файлы WebM, PNG или WebP" });
            }

            var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
            var allowedTypes = new[] { "video/webm", "image/png", "image/webp", "application/octet-stream" };
            if (!string.IsNullOrEmpty(contentType) && !allowedTypes.Contains(contentType))
            {
                return BadRequest(new { error = "Неподдерживаемый тип файла" });
            }

            if (file.Length > 3 * 1024 * 1024)
            {
                return BadRequest(new { error = "Файл слишком большой (максимум 3MB)" });
            }

            var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads", "nameplates");
            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
            }

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsPath, fileName);
            var relativePath = $"/uploads/nameplates/{fileName}";

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { url = relativePath });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при загрузке таблички: " + ex.Message });
        }
    }

    [HttpPost("upload/avatar-decoration")]
    [RequireAuth]
    public async Task<IActionResult> UploadAvatarDecoration(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "Файл не выбран" });
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AvatarDecorationAllowedExtensions.Contains(extension))
            {
                return BadRequest(new { error = "Допустимы MP4, WebM, PNG/APNG, GIF или WebP (.mp4, .webm, .png, .apng, .gif, .webp)" });
            }

            var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
            var allowedTypes = new[]
            {
                "image/png", "image/gif", "image/webp", "video/webm", "video/mp4",
                "video/quicktime", "video/x-matroska", "application/octet-stream",
            };
            if (!string.IsNullOrEmpty(contentType) && !allowedTypes.Contains(contentType))
            {
                return BadRequest(new { error = "Неподдерживаемый тип файла" });
            }

            var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads", "avatar-decorations");
            Directory.CreateDirectory(uploadsPath);

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsPath, fileName);
            var relativePath = $"/uploads/avatar-decorations/{fileName}";

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { url = relativePath });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при загрузке рамки аватара: " + ex.Message });
        }
    }

    private bool EnsureOwnProfile(Guid targetUserId, out IActionResult? forbidResult)
    {
        var userId = HttpContext.Items["UserId"] as Guid?;
        if (!userId.HasValue)
        {
            forbidResult = Unauthorized(new { error = "Требуется авторизация" });
            return false;
        }

        if (userId.Value != targetUserId)
        {
            forbidResult = Forbid();
            return false;
        }

        forbidResult = null;
        return true;
    }
}

public class UpdateAvatarRequest
{
    public Guid UserId { get; set; }
    public string Avatar { get; set; } = string.Empty;
}

public class UpdateBannerRequest
{
    public Guid UserId { get; set; }
    public string Banner { get; set; } = string.Empty;
}

public class UpdateDescriptionRequest
{
    public Guid UserId { get; set; }
    public string? Description { get; set; }
}

public class UpdateAvatarColorRequest
{
    public Guid UserId { get; set; }
    public string AvatarColor { get; set; } = string.Empty;
}

public class UpdateNameplateRequest
{
    public Guid UserId { get; set; }
    public string? Nameplate { get; set; }
}

public class UpdateAvatarDecorationRequest
{
    public Guid UserId { get; set; }
    public string? AvatarDecoration { get; set; }
}

public class ProfileUserRequest
{
    public Guid UserId { get; set; }
}
