using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatKeyRecipients;
using WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatWrappedKey;
using WhithinMessenger.Application.CommandsAndQueries.E2e.GetDeviceKey;
using WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertChatWrappedKeys;
using WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertDeviceKey;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/e2e")]
[RequireAuth]
public class E2eController : ControllerBase
{
    private readonly IMediator _mediator;

    public E2eController(IMediator mediator)
    {
        _mediator = mediator;
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

        var result = await _mediator.Send(new UpsertChatWrappedKeysCommand(chatId, userId, wraps));
        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

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
}

public class ChatWrappedKeyUpload
{
    public Guid UserId { get; set; }
    public string? WrappedKeyBase64 { get; set; }
    public string? DeviceId { get; set; }
}
