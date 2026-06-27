using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Application.Services;
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
    private const int MaxDisplayNameLength = UserDisplayNames.MaxLength;

    private readonly IUserProfileRepository _userProfileRepository;
    private readonly WithinDbContext _context;
    private readonly IWebHostEnvironment _environment;
    private readonly IProfileRealtimeNotifier _profileRealtimeNotifier;

    private static readonly HashSet<string> AvatarDecorationAllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".apng", ".gif", ".webp", ".webm", ".mp4", ".mov", ".mkv", ".avi",
    };

    public ProfileController(
        IUserProfileRepository userProfileRepository,
        WithinDbContext context,
        IWebHostEnvironment environment,
        IProfileRealtimeNotifier profileRealtimeNotifier)
    {
        _userProfileRepository = userProfileRepository;
        _context = context;
        _environment = environment;
        _profileRealtimeNotifier = profileRealtimeNotifier;
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
                displayName = userProfile.DisplayName,
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
            await NotifyProfileUpdatedAsync(request.UserId, "avatar");

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
            await NotifyProfileUpdatedAsync(request.UserId, "banner");

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
            await NotifyProfileUpdatedAsync(request.UserId, "description");

            return Ok(new { description = userProfile.Description });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении описания: " + ex.Message });
        }
    }

    [HttpPost("update-display-name")]
    [RequireAuth]
    public async Task<IActionResult> UpdateDisplayName([FromBody] UpdateDisplayNameRequest request)
    {
        try
        {
            if (!EnsureOwnProfile(request.UserId, out var forbidResult))
            {
                return forbidResult!;
            }

            var displayName = UserDisplayNames.Normalize(request.DisplayName);
            if (displayName != null && displayName.Length > MaxDisplayNameLength)
            {
                return BadRequest(new { error = $"Ник не может быть длиннее {MaxDisplayNameLength} символов" });
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.DisplayName = displayName;
            await _userProfileRepository.UpdateAsync(userProfile);
            await NotifyProfileUpdatedAsync(request.UserId, "displayName");

            var user = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == request.UserId);

            return Ok(new
            {
                username = user?.UserName,
                displayName = userProfile.DisplayName,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при обновлении ника: " + ex.Message });
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

            if (!string.IsNullOrWhiteSpace(request.Nameplate) && !IsAllowedNameplatePath(request.Nameplate))
            {
                return BadRequest(new { error = "Табличка: статичные PNG/JPEG или анимированный WebP." });
            }

            var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId);
            if (userProfile == null)
            {
                return NotFound(new { error = "Профиль пользователя не найден" });
            }

            userProfile.Nameplate = string.IsNullOrWhiteSpace(request.Nameplate) ? null : request.Nameplate.Trim();
            await _userProfileRepository.UpdateAsync(userProfile);
            await NotifyProfileUpdatedAsync(request.UserId, "nameplate");

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
            await NotifyProfileUpdatedAsync(request.UserId, "avatarDecoration");

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
            await NotifyProfileUpdatedAsync(request.UserId, "avatarDecoration");

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
            await NotifyProfileUpdatedAsync(request.UserId, "nameplate");

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
            await NotifyProfileUpdatedAsync(request.UserId, "avatarColor");

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
            await NotifyProfileUpdatedAsync(request.UserId, "avatar");

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
            await NotifyProfileUpdatedAsync(request.UserId, "banner");

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

            var claimedExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".webp" };
            if (!allowedExtensions.Contains(claimedExtension))
            {
                return BadRequest(new { error = "Допустимы PNG, JPEG или WebP. Анимация — только WebP." });
            }

            var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
            var allowedTypes = new[] { "image/png", "image/jpeg", "image/jpg", "image/pjpeg", "image/webp", "application/octet-stream" };
            if (!string.IsNullOrEmpty(contentType) && !allowedTypes.Contains(contentType))
            {
                return BadRequest(new { error = "Неподдерживаемый тип файла" });
            }

            var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads", "nameplates");
            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
            }

            await using var input = file.OpenReadStream();
            var header = new byte[12];
            var headerLength = await input.ReadAsync(header.AsMemory(0, header.Length));
            var extension = ResolveNameplateExtension(header.AsSpan(0, headerLength), claimedExtension);
            if (extension == ".webm")
            {
                return BadRequest(new { error = "WebM не поддерживается. Загрузите WebP для анимации или PNG/JPEG для статичной таблички." });
            }

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsPath, fileName);
            var relativePath = $"/uploads/nameplates/{fileName}";

            await using (var output = new FileStream(filePath, FileMode.Create))
            {
                if (headerLength > 0)
                {
                    await output.WriteAsync(header.AsMemory(0, headerLength));
                }

                await input.CopyToAsync(output);
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

    private static readonly HashSet<string> AllowedNameplateExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp",
    };

    private static bool IsAllowedNameplatePath(string path)
    {
        var normalized = path.Split('?', '#')[0];
        var extension = Path.GetExtension(normalized);
        return AllowedNameplateExtensions.Contains(extension);
    }

    private static string ResolveNameplateExtension(ReadOnlySpan<byte> header, string claimedExtension)
    {
        if (header.Length >= 4
            && header[0] == 0x1A
            && header[1] == 0x45
            && header[2] == 0xDF
            && header[3] == 0xA3)
        {
            return ".webm";
        }

        if (header.Length >= 12
            && header[0] == (byte)'R'
            && header[1] == (byte)'I'
            && header[2] == (byte)'F'
            && header[3] == (byte)'F'
            && header[8] == (byte)'W'
            && header[9] == (byte)'E'
            && header[10] == (byte)'B'
            && header[11] == (byte)'P')
        {
            return ".webp";
        }

        if (header.Length >= 8
            && header[0] == 0x89
            && header[1] == (byte)'P'
            && header[2] == (byte)'N'
            && header[3] == (byte)'G')
        {
            return ".png";
        }

        if (header.Length >= 3
            && header[0] == 0xFF
            && header[1] == 0xD8
            && header[2] == 0xFF)
        {
            return claimedExtension is ".jpeg" or ".jpg" ? claimedExtension : ".jpg";
        }

        return claimedExtension;
    }

    private async Task NotifyProfileUpdatedAsync(Guid userId, params string[] changedFields)
    {
        var userProfile = await _userProfileRepository.GetByUserIdAsync(userId);
        if (userProfile == null)
        {
            return;
        }

        var user = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        await _profileRealtimeNotifier.NotifyUserProfileUpdatedAsync(
            userId,
            userProfile,
            user,
            changedFields);
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

public class UpdateDisplayNameRequest
{
    public Guid UserId { get; set; }
    public string? DisplayName { get; set; }
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
