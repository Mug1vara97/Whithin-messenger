using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;
using WhithinMessenger.Application.CommandsAndQueries.Auth.ConfirmEmail;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Login;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Register;
using WhithinMessenger.Application.CommandsAndQueries.Auth.ResendEmailConfirmation;
using WhithinMessenger.Application.Options;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Infrastructure.Database;
using System.Security.Claims;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, QrLoginSessionState> QrLoginSessions = new();
    private static readonly TimeSpan QrLoginSessionLifetime = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan QrLoginApprovalRetention = TimeSpan.FromMinutes(1);

    private readonly IMediator _mediator;
    private readonly ITokenGenerator _tokenGenerator;
    private readonly WithinDbContext _dbContext;
    private readonly JwtSettings _jwtSettings;

    public AuthController(
        IMediator mediator,
        ITokenGenerator tokenGenerator,
        WithinDbContext dbContext,
        IOptions<JwtSettings> jwtSettings)
    {
        _mediator = mediator;
        _tokenGenerator = tokenGenerator;
        _dbContext = dbContext;
        _jwtSettings = jwtSettings.Value;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        LoginResult result;
        try
        {
            var command = new LoginCommand(request.Username, request.Password);
            result = await _mediator.Send(command);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Ошибка входа", Details = ex.Message });
        }

        if (result.IsSuccess && result.User != null)
        {
            await CleanupExpiredRefreshTokensAsync(result.User.Id);

            // Генерируем JWT токен
            var token = _tokenGenerator.GenerateAccessToken(
                result.User.Id.ToString(), 
                result.User.UserName ?? "", 
                result.User.Email ?? ""
            );

            var refreshToken = await CreateRefreshTokenAsync(result.User.Id);
            
            return Ok(new { 
                Message = "Успешный вход",
                Token = token,
                RefreshToken = refreshToken,
                User = new {
                    Id = result.User.Id,
                    Username = result.User.UserName,
                    Email = result.User.Email,
                    EmailConfirmed = result.User.EmailConfirmed,
                }
            });
        }

        return BadRequest(new
        {
            Error = result.ErrorMessage,
            RequiresEmailConfirmation = result.RequiresEmailConfirmation,
            Email = result.Email,
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var command = new RegisterCommand(request.Username, request.Password, request.Email);
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(new
            {
                UserId = result.UserId,
                Message = "Письмо с подтверждением отправлено на ваш email",
                RequiresEmailConfirmation = result.RequiresEmailConfirmation,
                Email = result.Email,
            });
        }

        return BadRequest(new { Error = result.ErrorMessage });
    }

    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            return BadRequest(new { Error = "Некорректный идентификатор пользователя" });
        }

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { Error = "Токен подтверждения обязателен" });
        }

        var result = await _mediator.Send(new ConfirmEmailCommand(userId, request.Token));
        if (result.IsSuccess)
        {
            return Ok(new { Message = "Email успешно подтверждён" });
        }

        return BadRequest(new { Error = result.ErrorMessage });
    }

    [HttpPost("resend-confirmation")]
    public async Task<IActionResult> ResendConfirmation([FromBody] ResendConfirmationRequest request)
    {
        var result = await _mediator.Send(new ResendEmailConfirmationCommand(request.Email));
        if (result.IsSuccess)
        {
            return Ok(new { Message = "Если аккаунт существует и email не подтверждён, письмо отправлено" });
        }

        return BadRequest(new { Error = result.ErrorMessage });
    }

    [HttpPost("qr/session")]
    public IActionResult CreateQrLoginSession()
    {
        CleanupExpiredQrSessions();

        var sessionId = Guid.NewGuid().ToString("N");
        var expiresAt = DateTimeOffset.UtcNow.Add(QrLoginSessionLifetime);

        var state = new QrLoginSessionState
        {
            SessionId = sessionId,
            ExpiresAt = expiresAt
        };

        QrLoginSessions[sessionId] = state;

        var qrPayload = $"within://qr-login?session={sessionId}";
        var webLink = $"{Request.Scheme}://{Request.Host}/qr-login?session={sessionId}";

        return Ok(new
        {
            SessionId = sessionId,
            QrPayload = qrPayload,
            WebLink = webLink,
            ExpiresAt = expiresAt
        });
    }

    [HttpGet("qr/session/{sessionId}")]
    public async Task<IActionResult> GetQrLoginSessionStatus([FromRoute] string sessionId)
    {
        CleanupExpiredQrSessions();

        if (!QrLoginSessions.TryGetValue(sessionId, out var session))
        {
            return NotFound(new { Status = "expired", Error = "QR session expired or not found" });
        }

        if (session.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            QrLoginSessions.TryRemove(sessionId, out _);
            return NotFound(new { Status = "expired", Error = "QR session expired" });
        }

        if (session.ApprovedByUserId is null)
        {
            return Ok(new
            {
                Status = "pending",
                ExpiresAt = session.ExpiresAt
            });
        }

        var user = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == session.ApprovedByUserId.Value);
        if (user is null)
        {
            QrLoginSessions.TryRemove(sessionId, out _);
            return BadRequest(new { Status = "failed", Error = "User not found for approved session" });
        }

        await CleanupExpiredRefreshTokensAsync(user.Id);

        var token = _tokenGenerator.GenerateAccessToken(
            user.Id.ToString(),
            user.UserName ?? string.Empty,
            user.Email ?? string.Empty
        );
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        QrLoginSessions.TryRemove(sessionId, out _);

        return Ok(new
        {
            Status = "approved",
            Token = token,
            RefreshToken = refreshToken,
            User = new
            {
                Id = user.Id,
                Username = user.UserName,
                Email = user.Email
            }
        });
    }

    [Authorize]
    [HttpPost("qr/approve")]
    public IActionResult ApproveQrLogin([FromBody] ApproveQrLoginRequest request)
    {
        CleanupExpiredQrSessions();

        if (string.IsNullOrWhiteSpace(request.SessionId))
        {
            return BadRequest(new { Error = "SessionId is required" });
        }

        if (!QrLoginSessions.TryGetValue(request.SessionId, out var session))
        {
            return NotFound(new { Error = "QR session expired or not found" });
        }

        if (session.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            QrLoginSessions.TryRemove(request.SessionId, out _);
            return NotFound(new { Error = "QR session expired" });
        }

        if (session.ApprovedByUserId.HasValue)
        {
            return Conflict(new { Error = "QR session already approved" });
        }

        var userIdClaim = User.FindFirst("UserId")?.Value;
        if (!Guid.TryParse(userIdClaim, out var approvedByUserId))
        {
            return Unauthorized(new { Error = "Invalid user token" });
        }

        session.ApprovedByUserId = approvedByUserId;
        session.ApprovedAt = DateTimeOffset.UtcNow;

        return Ok(new { Message = "QR login approved" });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(new { Error = "Refresh token is required" });
        }

        var existingRefreshToken = await _dbContext.RefreshTokens
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Token == request.RefreshToken);

        if (existingRefreshToken == null || existingRefreshToken.Expired)
        {
            return Unauthorized(new { Error = "Refresh token is invalid or expired" });
        }

        var user = existingRefreshToken.User;

        _dbContext.RefreshTokens.Remove(existingRefreshToken);
        await CleanupExpiredRefreshTokensAsync(user.Id);

        var accessToken = _tokenGenerator.GenerateAccessToken(
            user.Id.ToString(),
            user.UserName ?? string.Empty,
            user.Email ?? string.Empty
        );
        var newRefreshToken = await CreateRefreshTokenAsync(user.Id);

        return Ok(new
        {
            Token = accessToken,
            RefreshToken = newRefreshToken,
            User = new
            {
                Id = user.Id,
                Username = user.UserName,
                Email = user.Email
            }
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest? request = null)
    {
        if (!string.IsNullOrWhiteSpace(request?.RefreshToken))
        {
            var refreshToken = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(x => x.Token == request.RefreshToken);
            if (refreshToken != null)
            {
                _dbContext.RefreshTokens.Remove(refreshToken);
            }
        }

        var userId = User.FindFirst("UserId")?.Value;
        if (Guid.TryParse(userId, out var parsedUserId))
        {
            var userTokens = await _dbContext.RefreshTokens
                .Where(x => x.UserId == parsedUserId)
                .ToListAsync();
            if (userTokens.Count > 0)
            {
                _dbContext.RefreshTokens.RemoveRange(userTokens);
            }
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { Message = "Успешный выход" });
    }

    [HttpGet("status")]
    public IActionResult GetAuthStatus()
    {
        var userId = User.FindFirst("UserId")?.Value;
        var username = User.FindFirst("Username")?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(userId))
        {
            return Ok(new { 
                IsAuthenticated = false,
                Message = "Пользователь не авторизован"
            });
        }

        return Ok(new
        {
            IsAuthenticated = true,
            User = new
            {
                Id = userId,
                Username = username,
                Email = email
            }
        });
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId)
    {
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = _tokenGenerator.GenerateRefreshToken(),
            UserId = userId,
            User = null!,
            CreatedDate = DateTimeOffset.UtcNow,
            ExpirationDate = DateTimeOffset.UtcNow.AddDays(JwtSettings.RefreshTokenExpirationDays)
        };

        _dbContext.RefreshTokens.Add(refreshToken);
        await _dbContext.SaveChangesAsync();

        return refreshToken.Token;
    }

    private async Task CleanupExpiredRefreshTokensAsync(Guid userId)
    {
        var expiredTokens = await _dbContext.RefreshTokens
            .Where(x => x.UserId == userId && x.ExpirationDate <= DateTimeOffset.UtcNow)
            .ToListAsync();

        if (expiredTokens.Count == 0)
        {
            return;
        }

        _dbContext.RefreshTokens.RemoveRange(expiredTokens);
        await _dbContext.SaveChangesAsync();
    }

    private static void CleanupExpiredQrSessions()
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in QrLoginSessions)
        {
            var session = entry.Value;
            var approvedExpired = session.ApprovedAt.HasValue &&
                                  session.ApprovedAt.Value.Add(QrLoginApprovalRetention) <= now;

            if (session.ExpiresAt <= now || approvedExpired)
            {
                QrLoginSessions.TryRemove(entry.Key, out _);
            }
        }
    }

    private sealed class QrLoginSessionState
    {
        public required string SessionId { get; init; }
        public DateTimeOffset ExpiresAt { get; init; }
        public Guid? ApprovedByUserId { get; set; }
        public DateTimeOffset? ApprovedAt { get; set; }
    }
}

public record LoginRequest(string Username, string Password);
public record RegisterRequest(string Username, string Password, string Email);
public record RefreshTokenRequest(string RefreshToken);
public record LogoutRequest(string? RefreshToken);
public record ApproveQrLoginRequest(string SessionId);
public record ConfirmEmailRequest(string UserId, string Token);
public record ResendConfirmationRequest(string Email);
