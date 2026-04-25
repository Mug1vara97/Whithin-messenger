using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Infrastructure.Database;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Users.SearchUsers;
using WhithinMessenger.Application.Interfaces;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAuth]
public class UserController : ControllerBase
{
    private readonly WithinDbContext _context;
    private readonly IMediator _mediator;
    private readonly IHubContext<NotificationHub> _notificationHub;

    public UserController(
        WithinDbContext context,
        IMediator mediator,
        IHubContext<NotificationHub> notificationHub)
    {
        _context = context;
        _mediator = mediator;
        _notificationHub = notificationHub;
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
            var userRepository = HttpContext.RequestServices.GetRequiredService<IUserRepositoryExtensions>();
            
            // Для добавления в друзья показываем всех пользователей
            var users = await userRepository.SearchAllUsersAsync(currentUserId, name ?? string.Empty);
            
            return Ok(users);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при поиске пользователей: " + ex.Message });
        }
    }

    [HttpPut("status/{userId:guid}")]
    public async Task<IActionResult> UpdateStatus(Guid userId, [FromBody] UpdateUserStatusRequest request)
    {
        var currentUserId = HttpContext.Items["UserId"] as Guid?;
        if (!currentUserId.HasValue)
        {
            return Unauthorized(new { error = "Пользователь не авторизован" });
        }

        if (currentUserId.Value != userId)
        {
            return Forbid();
        }

        if (request == null || string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest(new { error = "Статус не указан" });
        }

        if (!TryParseStatus(request.Status, out var parsedStatus))
        {
            return BadRequest(new { error = "Некорректный статус" });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return NotFound(new { error = "Пользователь не найден" });
        }

        user.Status = parsedStatus;
        user.LastSeen = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();

        var normalizedStatus = user.Status.ToString().ToLowerInvariant();
        var lastSeenIso = user.LastSeen.ToString("O");

        // Sync all sessions for current user.
        await _notificationHub.Clients.Group($"user-{userId}").SendAsync(
            "UserStatusChanged",
            new
            {
                userId,
                status = normalizedStatus,
                lastSeen = lastSeenIso
            });

        // Broadcast status updates to accepted friends.
        var friendIds = await _context.Friendships
            .Where(f => (f.RequesterId == userId || f.AddresseeId == userId) && f.Status == FriendshipStatus.Accepted)
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();

        foreach (var friendId in friendIds)
        {
            await _notificationHub.Clients.Group($"user-{friendId}").SendAsync(
                "UserStatusChanged",
                new
                {
                    userId,
                    status = normalizedStatus,
                    lastSeen = lastSeenIso
                });
        }

        return Ok(new
        {
            userId,
            status = normalizedStatus,
            lastSeen = lastSeenIso
        });
    }

    private static bool TryParseStatus(string statusValue, out Status status)
    {
        status = Status.Offline;
        if (string.IsNullOrWhiteSpace(statusValue))
        {
            return false;
        }

        var normalized = statusValue.Trim().ToLowerInvariant().Replace("_", string.Empty).Replace("-", string.Empty);
        return normalized switch
        {
            "online" => SetStatus(Status.Online, out status),
            "inactive" or "away" or "idle" => SetStatus(Status.Inactive, out status),
            "donotdisturb" or "dnd" or "busy" => SetStatus(Status.DoNotDisturb, out status),
            "offline" => SetStatus(Status.Offline, out status),
            _ => false
        };
    }

    private static bool SetStatus(Status value, out Status output)
    {
        output = value;
        return true;
    }
}

public class UpdateUserStatusRequest
{
    public string Status { get; set; } = string.Empty;
}
