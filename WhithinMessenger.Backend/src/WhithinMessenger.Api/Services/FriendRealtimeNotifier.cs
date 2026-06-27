using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.Services;

namespace WhithinMessenger.Api.Services;

public class FriendRealtimeNotifier : IFriendRealtimeNotifier
{
    private readonly IHubContext<FriendHub> _friendHubContext;

    public FriendRealtimeNotifier(IHubContext<FriendHub> friendHubContext)
    {
        _friendHubContext = friendHubContext;
    }

    public async Task NotifyFriendRequestReceivedAsync(
        Guid addresseeId,
        Guid requestId,
        Guid senderId,
        string senderUsername,
        CancellationToken cancellationToken = default)
    {
        await _friendHubContext.Clients.Group($"user-{addresseeId}").SendAsync(
            "FriendRequestReceived",
            new
            {
                requestId,
                senderId,
                senderUsername
            },
            cancellationToken);
    }

    public async Task NotifyFriendRequestAcceptedAsync(
        Guid requesterId,
        Guid friendId,
        string? friendUsername,
        CancellationToken cancellationToken = default)
    {
        await _friendHubContext.Clients.Group($"user-{requesterId}").SendAsync(
            "FriendRequestAccepted",
            new
            {
                friendId,
                friendUsername
            },
            cancellationToken);
    }

    public async Task NotifyFriendAddedAsync(
        Guid addresseeId,
        Guid friendId,
        string? friendUsername,
        CancellationToken cancellationToken = default)
    {
        await _friendHubContext.Clients.Group($"user-{addresseeId}").SendAsync(
            "FriendAdded",
            new
            {
                friendId,
                friendUsername
            },
            cancellationToken);
    }

    public async Task NotifyFriendRequestDeclinedAsync(
        Guid requesterId,
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        await _friendHubContext.Clients.Group($"user-{requesterId}").SendAsync(
            "FriendRequestDeclined",
            new { requestId },
            cancellationToken);
    }

    public async Task NotifyFriendRemovedAsync(
        Guid userId,
        Guid friendId,
        CancellationToken cancellationToken = default)
    {
        await _friendHubContext.Clients.Group($"user-{userId}").SendAsync(
            "FriendRemoved",
            new { friendId },
            cancellationToken);
    }

    public async Task NotifyUserBlockedAsync(
        Guid blockerId,
        Guid blockedUserId,
        CancellationToken cancellationToken = default)
    {
        await _friendHubContext.Clients.Group($"user-{blockerId}").SendAsync(
            "UserBlocked",
            new { userId = blockedUserId },
            cancellationToken);

        await _friendHubContext.Clients.Group($"user-{blockedUserId}").SendAsync(
            "BlockedByUser",
            new { userId = blockerId },
            cancellationToken);
    }

    public async Task NotifyUserUnblockedAsync(
        Guid blockerId,
        Guid unblockedUserId,
        CancellationToken cancellationToken = default)
    {
        await _friendHubContext.Clients.Group($"user-{blockerId}").SendAsync(
            "UserUnblocked",
            new { userId = unblockedUserId },
            cancellationToken);

        await _friendHubContext.Clients.Group($"user-{unblockedUserId}").SendAsync(
            "UnblockedByUser",
            new { userId = blockerId },
            cancellationToken);
    }
}
