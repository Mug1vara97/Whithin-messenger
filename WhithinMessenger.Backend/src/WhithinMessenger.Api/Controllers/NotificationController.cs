using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.DeleteNotification;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.GetNotifications;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.GetUnreadCount;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkAsRead;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkChatAsRead;
using WhithinMessenger.Api.Attributes;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAuth]
public class NotificationController : ControllerBase
{
    private readonly IMediator _mediator;

    public NotificationController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool unreadOnly = true)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var query = new GetNotificationsQuery(userId.Value, page, pageSize, unreadOnly);
        var result = await _mediator.Send(query);

        return Ok(result.Notifications);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var query = new GetUnreadCountQuery(userId.Value);
        var result = await _mediator.Send(query);

        return Ok(new { unreadCount = result.UnreadCount });
    }

    [HttpPut("{notificationId}/read")]
    public async Task<IActionResult> MarkAsRead(Guid notificationId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var command = new MarkAsReadCommand(notificationId, userId.Value);
        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { message = "Notification marked as read" });
    }

    [HttpPut("chat/{chatId}/read")]
    public async Task<IActionResult> MarkChatAsRead(Guid chatId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var command = new MarkChatAsReadCommand(chatId, userId.Value);
        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { message = $"Marked {result.MarkedCount} notifications as read" });
    }

    [HttpDelete("{notificationId}")]
    public async Task<IActionResult> DeleteNotification(Guid notificationId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var command = new DeleteNotificationCommand(notificationId, userId.Value);
        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { message = "Notification deleted" });
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User?.FindFirst("UserId")?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        return null;
    }
}



