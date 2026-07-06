using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatKeyRecipients;
using WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatWrappedKey;
using WhithinMessenger.Application.CommandsAndQueries.E2e.GetDeviceKey;
using WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertChatWrappedKeys;
using WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertDeviceKey;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/e2e")]
[RequireAuth]
public class E2eController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IChatRepository _chatRepository;
    private readonly IE2eRealtimeNotifier _e2eRealtimeNotifier;

    public E2eController(
        IMediator mediator,
        IChatRepository chatRepository,
        IE2eRealtimeNotifier e2eRealtimeNotifier)
    {
        _mediator = mediator;
        _chatRepository = chatRepository;
        _e2eRealtimeNotifier = e2eRealtimeNotifier;
    }

    [HttpPut("keys")]
    public async Task<IActionResult> UpsertDeviceKey([FromBody] UpsertE2eDeviceKeyRequest request)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var result = await _mediator.Send(new UpsertE2eDeviceKeyCommand(
            userId,
            request.DeviceId ?? "default",
            request.PublicKeyBase64 ?? string.Empty));

        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { success = true });
    }

    [HttpGet("keys/{userId:guid}")]
    public async Task<IActionResult> GetDeviceKey(Guid userId, [FromQuery] string? deviceId = null)
    {
        var result = await _mediator.Send(new GetE2eDeviceKeyQuery(userId, deviceId));
        if (!result.Success)
        {
            return NotFound(new { error = result.ErrorMessage });
        }

        return Ok(new
        {
            deviceId = result.DeviceId,
            publicKeyBase64 = result.PublicKeyBase64,
            updatedAt = result.UpdatedAt,
        });
    }

    [HttpGet("chat-keys/{chatId:guid}")]
    public async Task<IActionResult> GetChatWrappedKey(Guid chatId, [FromQuery] string? deviceId = null)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var result = await _mediator.Send(new GetChatWrappedKeyQuery(chatId, userId, deviceId ?? "default"));
        if (!result.Success)
        {
            return NotFound(new { error = result.ErrorMessage });
        }

        return Ok(new
        {
            wrappedKeyBase64 = result.WrappedKeyBase64,
            updatedAt = result.UpdatedAt,
        });
    }

    [HttpGet("chat-keys/{chatId:guid}/recipients")]
    public async Task<IActionResult> GetChatKeyRecipients(Guid chatId)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var result = await _mediator.Send(new GetChatKeyRecipientsQuery(chatId, userId));
        if (!result.Success)
        {
            // For stale/non-member channels we return an empty list so the client can gracefully skip E2E wrap sync
            // without polluting the browser console with expected 4xx noise.
            if (string.Equals(result.ErrorMessage, "Access denied", StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new { userIds = Array.Empty<Guid>() });
            }

            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { userIds = result.UserIds });
    }

    [HttpPut("chat-keys/{chatId:guid}")]
    public async Task<IActionResult> UpsertChatWrappedKeys(
        Guid chatId,
        [FromBody] UpsertChatWrappedKeysRequest request)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var wraps = (request.Wraps ?? Array.Empty<ChatWrappedKeyUpload>())
            .Select(w => new ChatWrappedKeyEntry(
                w.UserId,
                w.WrappedKeyBase64 ?? string.Empty,
                w.DeviceId ?? "default"))
            .ToList();

        var result = await _mediator.Send(new UpsertChatWrappedKeysCommand(
            chatId,
            userId,
            wraps,
            request.KeyFingerprint));
        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { success = true });
    }

    [HttpPost("chat-keys/{chatId:guid}/rewrap-request")]
    public async Task<IActionResult> RequestChatKeyRewrap(
        Guid chatId,
        [FromBody] RequestChatKeyRewrapRequest? request = null,
        CancellationToken cancellationToken = default)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;

        var isParticipant = await _chatRepository.IsUserParticipantAsync(chatId, userId, cancellationToken);
        if (!isParticipant)
        {
            return Forbid();
        }

        var members = await _chatRepository.GetChatMembersAsync(chatId, cancellationToken);
        await _e2eRealtimeNotifier.NotifyChatKeyRewrapNeededAsync(
            chatId,
            userId,
            request?.DeviceId ?? "web",
            members,
            cancellationToken);

        return Ok(new { success = true });
    }
}

public class UpsertE2eDeviceKeyRequest
{
    public string? DeviceId { get; set; }
    public string? PublicKeyBase64 { get; set; }
}

public class UpsertChatWrappedKeysRequest
{
    public ChatWrappedKeyUpload[]? Wraps { get; set; }
    public string? KeyFingerprint { get; set; }
}

public class ChatWrappedKeyUpload
{
    public Guid UserId { get; set; }
    public string? WrappedKeyBase64 { get; set; }
    public string? DeviceId { get; set; }
}

public class RequestChatKeyRewrapRequest
{
    public string? DeviceId { get; set; }
}
