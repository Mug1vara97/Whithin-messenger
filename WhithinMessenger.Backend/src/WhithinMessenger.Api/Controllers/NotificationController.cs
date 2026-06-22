using MediatR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.DeleteNotification;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.GetNotifications;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.GetUnreadCount;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkAllAsRead;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkAsRead;
using WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkChatAsRead;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAuth]
public class NotificationController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IMessageRepository _messageRepository;
    private readonly IHubContext<ChatListHub> _chatListHub;
    private readonly IHubContext<GroupChatHub> _groupChatHub;
    private readonly IChatRepository _chatRepository;
    private readonly WhithinMessenger.Application.Services.IUserPushTokenStore _userPushTokenStore;

    public NotificationController(
        IMediator mediator,
        IMessageRepository messageRepository,
        IHubContext<ChatListHub> chatListHub,
        IHubContext<GroupChatHub> groupChatHub,
        IChatRepository chatRepository,
        WhithinMessenger.Application.Services.IUserPushTokenStore userPushTokenStore)
    {
        _mediator = mediator;
        _messageRepository = messageRepository;
        _chatListHub = chatListHub;
        _groupChatHub = groupChatHub;
        _chatRepository = chatRepository;
        _userPushTokenStore = userPushTokenStore;
    }

    [HttpPost("device-token")]
    public async Task<IActionResult> RegisterDeviceToken([FromBody] RegisterDeviceTokenRequest request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { error = "Token is required" });
        }

        var deviceId = string.IsNullOrWhiteSpace(request.DeviceId) ? "android-default" : request.DeviceId.Trim();
        await _userPushTokenStore.SaveTokenAsync(userId.Value, deviceId, request.Token.Trim());
        return Ok(new { message = "Device token registered" });
    }

    [HttpDelete("device-token/{deviceId}")]
    public async Task<IActionResult> RemoveDeviceToken(string deviceId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        await _userPushTokenStore.RemoveTokenAsync(userId.Value, deviceId);
        return Ok(new { message = "Device token removed" });
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

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var command = new MarkAllAsReadCommand(userId.Value);
        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { message = $"Marked {result.MarkedCount} notifications as read", markedCount = result.MarkedCount });
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

        var unreadCount = await _messageRepository.GetUnreadCountByChatAsync(chatId, userId.Value);
        await _chatListHub.Clients.Group($"user-{userId.Value}")
            .SendAsync("chatunreadupdated", chatId, unreadCount);

        if (result.MarkedMessages.Count > 0)
        {
            var chatMembers = await _chatRepository.GetChatMembersAsync(chatId);
            var recipientCount = Math.Max(0, chatMembers.Count - 1);
            var readAt = DateTimeOffset.UtcNow;
            var senderIds = result.MarkedMessages
                .Select(receipt => receipt.SenderUserId)
                .Distinct()
                .ToList();

            foreach (var receipt in result.MarkedMessages)
            {
                await _groupChatHub.Clients.Group(chatId.ToString())
                    .SendAsync("MessageRead", receipt.MessageId, userId.Value, readAt);
            }

            if (recipientCount > 0)
            {
                foreach (var senderId in senderIds)
                {
                    var ownMessageIds = result.MarkedMessages
                        .Where(receipt => receipt.SenderUserId == senderId)
                        .Select(receipt => receipt.MessageId)
                        .ToList();

                    var statuses = await _messageRepository.GetMessageStatusesAsync(
                        senderId,
                        ownMessageIds,
                        recipientCount);

                    foreach (var (messageId, status) in statuses)
                    {
                        await _groupChatHub.Clients.Group(chatId.ToString())
                            .SendAsync("MessageStatusChanged", messageId, status);
                    }
                }
            }
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

public class RegisterDeviceTokenRequest
{
    public string Token { get; set; } = string.Empty;
    public string? DeviceId { get; set; }
}



