using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Utils;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/profile")]
public class ProfileController : ControllerBase
{
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IWebHostEnvironment _environment;

    public ProfileController(IUserProfileRepository userProfileRepository, IWebHostEnvironment environment)
    {
        _userProfileRepository = userProfileRepository;
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
                    Banner = null
                };
                
                await _userProfileRepository.CreateAsync(userProfile);
            }

            return Ok(new
            {
                userId = userProfile.UserId,
                avatar = userProfile.Avatar,
                avatarColor = userProfile.AvatarColor,
                description = userProfile.Description,
                banner = userProfile.Banner,
                createdAt = DateTimeOffset.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при получении профиля пользователя: " + ex.Message });
        }
    }

    [HttpPost("update-avatar")]
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

    [HttpPost("upload/avatar")]
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
