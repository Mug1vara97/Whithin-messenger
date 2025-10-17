using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Login;
using WhithinMessenger.Application.CommandsAndQueries.Auth.Register;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;

    public AuthController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var command = new LoginCommand(request.Username, request.Password);
        var result = await _mediator.Send(command);

        if (result.IsSuccess && result.User != null)
        {
            HttpContext.Session.SetString("UserId", result.User.Id.ToString());
            HttpContext.Session.SetString("Username", result.User.UserName ?? "");
            
            return Ok(new { 
                Message = "Успешный вход",
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
        HttpContext.Session.Clear();
        return Ok(new { Message = "Успешный выход" });
    }

    [HttpGet("status")]
    public IActionResult GetAuthStatus()
    {
        var user = HttpContext.Items["User"] as ApplicationUser;
        
        if (user == null)
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
                Id = user.Id,
                Username = user.UserName,
                Email = user.Email,
                CreatedAt = user.CreatedAt
            }
        });
    }
}

public record LoginRequest(string Username, string Password);
public record RegisterRequest(string Username, string Password, string Email);
