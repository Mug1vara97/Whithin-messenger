using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Application.CommandsAndQueries.Friends.AcceptFriendRequest;
using WhithinMessenger.Application.CommandsAndQueries.Friends.DeclineFriendRequest;
using WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriendRequests;
using WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriends;
using WhithinMessenger.Application.CommandsAndQueries.Friends.RemoveFriend;
using WhithinMessenger.Application.CommandsAndQueries.Friends.SendFriendRequest;

namespace WhithinMessenger.Api.Hubs;

public class FriendHub : Hub
{
    private readonly IMediator _mediator;

    public FriendHub(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task<IEnumerable<object>> GetFriends()
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new GetFriendsQuery(userId));
        return result.Friends;
    }

    public async Task<object> GetFriendRequests()
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new GetFriendRequestsQuery(userId));
        return new
        {
            pendingRequests = result.PendingRequests,
            sentRequests = result.SentRequests
        };
    }

    public async Task<object> SendFriendRequest(Guid targetUserId)
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new SendFriendRequestCommand(userId, targetUserId));
        if (!result.Success)
        {
            throw new HubException(result.ErrorMessage ?? "Не удалось отправить запрос в друзья");
        }

        return new { success = true, friendshipId = result.FriendshipId };
    }

    public async Task<object> AcceptFriendRequest(Guid friendshipId)
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new AcceptFriendRequestCommand(userId, friendshipId));
        if (!result.Success)
        {
            throw new HubException(result.ErrorMessage ?? "Не удалось принять запрос в друзья");
        }

        return new { success = true };
    }

    public async Task<object> DeclineFriendRequest(Guid friendshipId)
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new DeclineFriendRequestCommand(userId, friendshipId));
        if (!result.Success)
        {
            throw new HubException(result.ErrorMessage ?? "Не удалось отклонить запрос в друзья");
        }

        return new { success = true };
    }

    public async Task<object> RemoveFriend(Guid friendId)
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new RemoveFriendCommand(userId, friendId));
        if (!result.Success)
        {
            throw new HubException(result.ErrorMessage ?? "Не удалось удалить пользователя из друзей");
        }

        return new { success = true };
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        if (userId.HasValue)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetCurrentUserId();
        if (userId.HasValue)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
        }

        await base.OnDisconnectedAsync(exception);
    }

    private Guid GetCurrentUserIdOrThrow()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Пользователь не авторизован");
        }

        return userId.Value;
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = Context.User?.FindFirst("UserId")?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }

        var userIdFromQuery = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault();
        if (Guid.TryParse(userIdFromQuery, out var userIdFromQueryParsed))
        {
            return userIdFromQueryParsed;
        }

        return null;
    }
}
