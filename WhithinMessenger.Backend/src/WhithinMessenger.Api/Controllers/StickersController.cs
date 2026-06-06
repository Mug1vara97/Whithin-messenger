using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Api.Services;
using WhithinMessenger.Application.CommandsAndQueries.Stickers.GetStickerPacks;
using WhithinMessenger.Application.CommandsAndQueries.Stickers.SendStickerMessage;
using WhithinMessenger.Application.CommandsAndQueries.Stickers.UploadStickerPack;
using WhithinMessenger.Application.CommandsAndQueries.User.GetUserProfile;
using WhithinMessenger.Application.Stickers;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/stickers")]
[RequireAuth]
public class StickersController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IHubContext<GroupChatHub> _hubContext;
    private readonly IMessageReceiptService _messageReceiptService;
    private readonly IMessageRepository _messageRepository;
    private readonly ILogger<StickersController> _logger;

    public StickersController(
        IMediator mediator,
        IHubContext<GroupChatHub> hubContext,
        IMessageReceiptService messageReceiptService,
        IMessageRepository messageRepository,
        ILogger<StickersController> logger)
    {
        _mediator = mediator;
        _hubContext = hubContext;
        _messageReceiptService = messageReceiptService;
        _messageRepository = messageRepository;
        _logger = logger;
    }

    [HttpGet("packs")]
    public async Task<IActionResult> GetStickerPacks()
    {
        try
        {
            var result = await _mediator.Send(new GetStickerPacksQuery());
            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(result.Packs);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при получении стикерпаков: " + ex.Message });
        }
    }

    [HttpPost("packs/upload")]
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = 104857600)]
    public async Task<IActionResult> UploadStickerPack(
        [FromForm] string title,
        [FromForm] IFormFile archive)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            if (userId != StickerPackAdmin.AllowedUploaderUserId)
            {
                return Forbid();
            }

            var command = new UploadStickerPackCommand(userId, title, archive);
            var result = await _mediator.Send(command);
            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(result.Pack);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sticker pack upload failed");
            return StatusCode(500, new { error = "Ошибка при загрузке стикерпака: " + ex.Message });
        }
    }

    [HttpPost("chats/{chatId:guid}/send/{stickerId:guid}")]
    public async Task<IActionResult> SendSticker(
        Guid chatId,
        Guid stickerId,
        [FromBody] SendStickerRequest? request = null)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            Guid? repliedToMessageId = null;
            if (request?.RepliedToMessageId is { } replyRaw &&
                Guid.TryParse(replyRaw, out var parsedReply))
            {
                repliedToMessageId = parsedReply;
            }

            var command = new SendStickerMessageCommand(userId, chatId, stickerId, repliedToMessageId);
            var result = await _mediator.Send(command);
            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            try
            {
                var userProfile = await _mediator.Send(new GetUserProfileQuery(userId));
                var avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(userId);
                var avatarUrl = userProfile?.Avatar;
                var username = (HttpContext.Items["User"] as ApplicationUser)?.UserName ?? "Unknown";

                object? repliedMessage = null;
                if (repliedToMessageId.HasValue)
                {
                    var replied = await _messageRepository.GetByIdAsync(repliedToMessageId.Value);
                    if (replied != null)
                    {
                        repliedMessage = new
                        {
                            messageId = replied.Id,
                            content = replied.Content,
                            senderUsername = replied.User?.UserName ?? "Unknown"
                        };
                    }
                }

                await _hubContext.Clients.Group(chatId.ToString()).SendAsync("MessageSent",
                    new
                    {
                        messageId = result.MessageId,
                        senderId = userId,
                        content = string.Empty,
                        contentType = "sticker",
                        username,
                        chatId,
                        avatarUrl,
                        avatarColor,
                        repliedMessage,
                        forwardedMessage = (object?)null,
                        mediaFiles = Array.Empty<object>(),
                        sticker = result.Sticker == null
                            ? null
                            : new
                            {
                                id = result.Sticker.Id,
                                stickerPackId = result.Sticker.StickerPackId,
                                filePath = result.Sticker.FilePath,
                                contentType = result.Sticker.ContentType,
                                sortOrder = result.Sticker.SortOrder
                            },
                        status = MessageStatusHelper.Sent
                    });

                if (result.MessageId.HasValue)
                {
                    await _messageReceiptService.AutoDeliverToReachableRecipientsAsync(
                        chatId,
                        result.MessageId.Value,
                        userId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast sticker message");
            }

            return Ok(new { success = true, messageId = result.MessageId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Send sticker failed");
            return StatusCode(500, new { error = "Ошибка при отправке стикера: " + ex.Message });
        }
    }

    private static string GenerateAvatarColor(Guid userId)
    {
        var hash = userId.GetHashCode();
        var colors = new[] { "#5865F2", "#57F287", "#FEE75C", "#EB459E", "#ED4245", "#FAA61A" };
        return colors[Math.Abs(hash) % colors.Length];
    }
}

public record SendStickerRequest(string? RepliedToMessageId = null);
