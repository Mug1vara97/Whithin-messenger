using System.Security.Cryptography;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Api.Services;
using WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;
using WhithinMessenger.Application.CommandsAndQueries.Servers.AddMember;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Utils;

namespace WhithinMessenger.Api.Controllers.Internal;

[ApiController]
[Route("api/internal/bots")]
[RequireInternalBotKey]
public class InternalBotsController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IMediator _mediator;
    private readonly IChatMessagePublisher _publisher;

    public InternalBotsController(
        UserManager<ApplicationUser> userManager,
        IUserProfileRepository userProfileRepository,
        IMediator mediator,
        IChatMessagePublisher publisher)
    {
        _userManager = userManager;
        _userProfileRepository = userProfileRepository;
        _mediator = mediator;
        _publisher = publisher;
    }

    public sealed class CreateBotUserRequest
    {
        public string Username { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
    }

    public sealed class InstallBotRequest
    {
        public Guid ServerId { get; set; }
        public Guid BotUserId { get; set; }
        public Guid InstalledByUserId { get; set; }
    }

    public sealed class SendBotMessageRequest
    {
        public Guid ChatId { get; set; }
        public Guid BotUserId { get; set; }
        public string Content { get; set; } = string.Empty;
        public Guid? ReplyToMessageId { get; set; }
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateBotUser([FromBody] CreateBotUserRequest request)
    {
        var username = (request.Username ?? string.Empty).Trim();
        if (username.Length < 3 || username.Length > 32)
        {
            return BadRequest(new { error = "Username must be 3-32 characters" });
        }

        if (await _userManager.FindByNameAsync(username) != null)
        {
            return Conflict(new { error = "Username already taken" });
        }

        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        var user = new ApplicationUser
        {
            UserName = username,
            Email = $"{Guid.NewGuid():N}@bots.whithin.local",
            EmailConfirmed = true,
            CreatedAt = DateTimeOffset.UtcNow,
            IsBot = true,
            Status = Status.Online,
        };

        var create = await _userManager.CreateAsync(user, password);
        if (!create.Succeeded)
        {
            return BadRequest(new { error = string.Join(", ", create.Errors.Select(e => e.Description)) });
        }

        var profile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim(),
            AvatarColor = AvatarColorGenerator.GenerateColor(user.Id),
        };
        await _userProfileRepository.CreateAsync(profile);

        return Ok(new
        {
            userId = user.Id,
            username = user.UserName,
            displayName = profile.DisplayName,
            isBot = true,
        });
    }

    [HttpPost("installs")]
    public async Task<IActionResult> InstallBot([FromBody] InstallBotRequest request)
    {
        var bot = await _userManager.FindByIdAsync(request.BotUserId.ToString());
        if (bot == null || !bot.IsBot)
        {
            return NotFound(new { error = "Bot user not found" });
        }

        var result = await _mediator.Send(new AddMemberCommand(
            request.ServerId,
            request.BotUserId,
            request.InstalledByUserId));

        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { success = true, serverMemberId = result.ServerMemberId });
    }

    [HttpPost("messages")]
    public async Task<IActionResult> SendMessage([FromBody] SendBotMessageRequest request)
    {
        var bot = await _userManager.FindByIdAsync(request.BotUserId.ToString());
        if (bot == null || !bot.IsBot)
        {
            return NotFound(new { error = "Bot user not found" });
        }

        var content = (request.Content ?? string.Empty).Trim();
        if (content.Length == 0)
        {
            return BadRequest(new { error = "Content is required" });
        }

        var result = await _mediator.Send(new SendMessageCommand(
            request.BotUserId,
            request.ChatId,
            content,
            request.ReplyToMessageId));

        if (!result.Success || !result.MessageId.HasValue)
        {
            return BadRequest(new { error = result.ErrorMessage ?? "Send failed" });
        }

        await _publisher.PublishTextMessageAsync(
            request.ChatId,
            request.BotUserId,
            result.MessageId.Value,
            content,
            repliedToMessageId: request.ReplyToMessageId);

        return Ok(new { messageId = result.MessageId.Value, chatId = request.ChatId });
    }
}
