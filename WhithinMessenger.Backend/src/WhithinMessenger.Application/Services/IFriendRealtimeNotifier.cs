namespace WhithinMessenger.Application.Services;

public interface IFriendRealtimeNotifier
{
    Task NotifyFriendRequestReceivedAsync(
        Guid addresseeId,
        Guid requestId,
        Guid senderId,
        string senderUsername,
        CancellationToken cancellationToken = default);

    Task NotifyFriendRequestAcceptedAsync(
        Guid requesterId,
        Guid friendId,
        string? friendUsername,
        CancellationToken cancellationToken = default);

    Task NotifyFriendAddedAsync(
        Guid addresseeId,
        Guid friendId,
        string? friendUsername,
        CancellationToken cancellationToken = default);

    Task NotifyFriendRequestDeclinedAsync(
        Guid requesterId,
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task NotifyFriendRemovedAsync(
        Guid userId,
        Guid friendId,
        CancellationToken cancellationToken = default);
}
