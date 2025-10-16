using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Infrastructure.Database;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Users.SearchUsers;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAuth] // Требует авторизации через сессии
public class UserController : ControllerBase
{
    private readonly WithinDbContext _context;
    private readonly IMediator _mediator;

    public UserController(WithinDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        var user = HttpContext.Items["User"] as ApplicationUser;
        var userId = HttpContext.Items["UserId"] as Guid?;

        if (user == null)
        {
            return Unauthorized(new { Error = "Пользователь не авторизован. Выполните вход." });
        }

        return Ok(new
        {
            Id = user.Id,
            Username = user.UserName,
            Email = user.Email,
            CreatedAt = user.CreatedAt
        });
    }

    [HttpGet("protected")]
    public IActionResult GetProtectedData()
    {
        var userId = HttpContext.Items["UserId"] as Guid?;
        
        return Ok(new
        {
            Message = "Это защищенные данные",
            UserId = userId,
            Timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchUsers([FromQuery] string name)
    {
        try
        {
            var currentUserId = (Guid)HttpContext.Items["UserId"]!;
            var query = new SearchUsersQuery(currentUserId, name);
            var result = await _mediator.Send(query);
            
            return Ok(result.Users);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при поиске пользователей: " + ex.Message });
        }
    }
}
