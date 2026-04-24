using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Login;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Register;
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
        var command = new LoginCommand(request.Username, request.Password);
        var result = await _mediator.Send(command);

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
                    Email = result.User.Email
                }
            });
        }

        return BadRequest(new { Error = result.ErrorMessage });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var command = new RegisterCommand(request.Username, request.Password, request.Email);
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(new { UserId = result.UserId, Message = "Пользователь успешно зарегистрирован" });
        }

        return BadRequest(new { Error = result.ErrorMessage });
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
}

public record LoginRequest(string Username, string Password);
public record RegisterRequest(string Username, string Password, string Email);
public record RefreshTokenRequest(string RefreshToken);
public record LogoutRequest(string? RefreshToken);
