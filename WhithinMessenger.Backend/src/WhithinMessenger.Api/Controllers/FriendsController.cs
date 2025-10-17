using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Application.CommandsAndQueries.Friends.SendFriendRequest;
using WhithinMessenger.Application.CommandsAndQueries.Friends.AcceptFriendRequest;
using WhithinMessenger.Application.CommandsAndQueries.Friends.DeclineFriendRequest;
using WhithinMessenger.Application.CommandsAndQueries.Friends.RemoveFriend;
using WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriends;
using WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriendRequests;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAuth]
public class FriendsController : ControllerBase
{
    private readonly IMediator _mediator;

    public FriendsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetFriends()
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var query = new GetFriendsQuery(userId);
            var result = await _mediator.Send(query);
            
            return Ok(result.Friends);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при получении списка друзей: " + ex.Message });
        }
    }

    [HttpGet("requests")]
    public async Task<IActionResult> GetFriendRequests()
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var query = new GetFriendRequestsQuery(userId);
            var result = await _mediator.Send(query);
            
            return Ok(new 
            { 
                pendingRequests = result.PendingRequests,
                sentRequests = result.SentRequests
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при получении запросов в друзья: " + ex.Message });
        }
    }

    [HttpPost("send-request")]
    public async Task<IActionResult> SendFriendRequest([FromBody] SendFriendRequestRequest request)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var command = new SendFriendRequestCommand(userId, request.TargetUserId);
            var result = await _mediator.Send(command);

            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(new { success = true, friendshipId = result.FriendshipId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при отправке запроса в друзья: " + ex.Message });
        }
    }

    [HttpPost("accept-request")]
    public async Task<IActionResult> AcceptFriendRequest([FromBody] AcceptFriendRequestRequest request)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var command = new AcceptFriendRequestCommand(userId, request.FriendshipId);
            var result = await _mediator.Send(command);

            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при принятии запроса в друзья: " + ex.Message });
        }
    }

    [HttpPost("decline-request")]
    public async Task<IActionResult> DeclineFriendRequest([FromBody] DeclineFriendRequestRequest request)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var command = new DeclineFriendRequestCommand(userId, request.FriendshipId);
            var result = await _mediator.Send(command);

            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при отклонении запроса в друзья: " + ex.Message });
        }
    }

    [HttpDelete("{friendId}")]
    public async Task<IActionResult> RemoveFriend(Guid friendId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var command = new RemoveFriendCommand(userId, friendId);
            var result = await _mediator.Send(command);

            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при удалении из друзей: " + ex.Message });
        }
    }
}

public record SendFriendRequestRequest(Guid TargetUserId);
public record AcceptFriendRequestRequest(Guid FriendshipId);
public record DeclineFriendRequestRequest(Guid FriendshipId);








