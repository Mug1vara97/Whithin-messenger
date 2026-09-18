using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Application.CommandsAndQueries.Friends.AcceptFriendRequest;
using WhithinMessenger.Application.CommandsAndQueries.Friends.DeclineFriendRequest;
using WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriendRequests;
using WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriends;
using WhithinMessenger.Application.CommandsAndQueries.Friends.RemoveFriend;
using WhithinMessenger.Application.CommandsAndQueries.Friends.BlockUser;
using WhithinMessenger.Application.CommandsAndQueries.Friends.UnblockUser;
using WhithinMessenger.Application.CommandsAndQueries.Friends.GetBlockedUsers;
using WhithinMessenger.Application.CommandsAndQueries.Friends.SendFriendRequest;

namespace WhithinMessenger.Api.Hubs;

/// <summary>
/// Friend-домен единого хаба (бывший FriendHub). Push-события (FriendRequestReceived, FriendAdded, ...)
/// шлёт FriendRealtimeNotifier через IHubContext&lt;AppHub&gt; в группу HubGroups.User(userId).
/// </summary>
public partial class AppHub
{
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

    public async Task<object> GetBlockedUsers()
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new GetBlockedUsersQuery(userId));
        return new
        {
            blockedUsers = result.BlockedUsers,
            blockedByUserIds = result.BlockedByUserIds,
        };
    }

    public async Task<object> BlockUser(Guid targetUserId)
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new BlockUserCommand(userId, targetUserId));
        if (!result.Success)
        {
            throw new HubException(result.ErrorMessage ?? "Не удалось заблокировать пользователя");
        }

        return new { success = true };
    }

    public async Task<object> UnblockUser(Guid targetUserId)
    {
        var userId = GetCurrentUserIdOrThrow();
        var result = await _mediator.Send(new UnblockUserCommand(userId, targetUserId));
        if (!result.Success)
        {
            throw new HubException(result.ErrorMessage ?? "Не удалось разблокировать пользователя");
        }

        return new { success = true };
    }
}
