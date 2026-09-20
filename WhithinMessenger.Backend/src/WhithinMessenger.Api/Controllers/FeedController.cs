using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Application.CommandsAndQueries.Feed;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/feed")]
[RequireAuth]
public class FeedController : ControllerBase
{
    private readonly IMediator _mediator;

    public FeedController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("friends")]
    public async Task<IActionResult> GetFriendsFeed([FromQuery] int take = 50)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var result = await _mediator.Send(new GetFriendsFeedQuery(userId, take));
        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(result.Posts);
    }

    [HttpGet("servers")]
    public async Task<IActionResult> GetServerFeed([FromQuery] int take = 50)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var result = await _mediator.Send(new GetServerFeedQuery(userId, take));
        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(result.Posts);
    }

    [HttpGet("user/{authorUserId:guid}")]
    public async Task<IActionResult> GetUserPosts(Guid authorUserId, [FromQuery] int take = 50)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var result = await _mediator.Send(new GetUserFeedPostsQuery(userId, authorUserId, take));
        if (!result.Success)
        {
            return StatusCode(403, new { error = result.ErrorMessage ?? "Нет доступа" });
        }

        return Ok(result.Posts);
    }

    [HttpPost]
    public async Task<IActionResult> CreatePost([FromBody] CreateFeedPostRequest request)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var scope = string.Equals(request.Scope, "server", StringComparison.OrdinalIgnoreCase)
            ? FeedPostScope.Server
            : FeedPostScope.Friend;

        var result = await _mediator.Send(new CreateFeedPostCommand(
            userId,
            request.Text ?? string.Empty,
            scope,
            request.ServerId));

        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(result.Post);
    }

    [HttpDelete("{postId:guid}")]
    public async Task<IActionResult> DeletePost(Guid postId)
    {
        var userId = (Guid)HttpContext.Items["UserId"]!;
        var result = await _mediator.Send(new DeleteFeedPostCommand(userId, postId));
        if (!result.Success)
        {
            return BadRequest(new { error = result.ErrorMessage });
        }

        return Ok(new { success = true });
    }
}

public class CreateFeedPostRequest
{
    public string? Text { get; set; }
    public string? Scope { get; set; }
    public Guid? ServerId { get; set; }
}
