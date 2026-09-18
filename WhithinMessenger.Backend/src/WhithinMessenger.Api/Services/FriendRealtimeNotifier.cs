using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.Services;

namespace WhithinMessenger.Api.Services;

public class FriendRealtimeNotifier : IFriendRealtimeNotifier
{
    private readonly IHubContext<AppHub> _hub;

    public FriendRealtimeNotifier(IHubContext<AppHub> hub)
    {
        _hub = hub;
    }

    private IClientProxy User(Guid userId) => _hub.Clients.Group(HubGroups.User(userId));

    public async Task NotifyFriendRequestReceivedAsync(
        Guid addresseeId,
        Guid requestId,
        Guid senderId,
        string senderUsername,
        CancellationToken cancellationToken = default)
    {
        await User(addresseeId).SendAsync(
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
        await User(requesterId).SendAsync(
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
        await User(addresseeId).SendAsync(
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
        await User(requesterId).SendAsync(
            "FriendRequestDeclined",
            new { requestId },
            cancellationToken);
    }

    public async Task NotifyFriendRemovedAsync(
        Guid userId,
        Guid friendId,
        CancellationToken cancellationToken = default)
    {
        await User(userId).SendAsync(
            "FriendRemoved",
            new { friendId },
            cancellationToken);
    }

    public async Task NotifyUserBlockedAsync(
        Guid blockerId,
        Guid blockedUserId,
        CancellationToken cancellationToken = default)
    {
        await User(blockerId).SendAsync(
            "UserBlocked",
            new { userId = blockedUserId },
            cancellationToken);

        await User(blockedUserId).SendAsync(
            "BlockedByUser",
            new { userId = blockerId },
            cancellationToken);
    }

    public async Task NotifyUserUnblockedAsync(
        Guid blockerId,
        Guid unblockedUserId,
        CancellationToken cancellationToken = default)
    {
        await User(blockerId).SendAsync(
            "UserUnblocked",
            new { userId = unblockedUserId },
            cancellationToken);

        await User(unblockedUserId).SendAsync(
            "UnblockedByUser",
            new { userId = blockerId },
            cancellationToken);
    }
}
