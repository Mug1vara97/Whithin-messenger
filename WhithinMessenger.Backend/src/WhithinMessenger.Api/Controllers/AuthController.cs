using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Login;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Register;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.Services;
using System.Security.Claims;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ITokenGenerator _tokenGenerator;

    public AuthController(IMediator mediator, ITokenGenerator tokenGenerator)
    {
        _mediator = mediator;
        _tokenGenerator = tokenGenerator;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var command = new LoginCommand(request.Username, request.Password);
        var result = await _mediator.Send(command);

        if (result.IsSuccess && result.User != null)
        {
            // Генерируем JWT токен
            var token = _tokenGenerator.GenerateAccessToken(
                result.User.Id.ToString(), 
                result.User.UserName ?? "", 
                result.User.Email ?? ""
            );
            
            return Ok(new { 
                Message = "Успешный вход",
                Token = token,
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

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // JWT токены не требуют очистки на сервере
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
}

public record LoginRequest(string Username, string Password);
public record RegisterRequest(string Username, string Password, string Email);
