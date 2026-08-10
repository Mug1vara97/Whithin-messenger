using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Services;

public interface IUserPresenceBroadcastService
{
    Task BroadcastStatusChangedAsync(
        Guid userId,
        Status status,
        DateTimeOffset lastSeen,
        CancellationToken cancellationToken = default);
}

public sealed class UserPresenceBroadcastService : IUserPresenceBroadcastService
{
    private readonly IHubContext<NotificationHub> _notificationHub;
    private readonly IProfileAudienceResolver _audienceResolver;
    private readonly IUserBlockService _userBlockService;

    public UserPresenceBroadcastService(
        IHubContext<NotificationHub> notificationHub,
        IProfileAudienceResolver audienceResolver,
        IUserBlockService userBlockService)
    {
        _notificationHub = notificationHub;
        _audienceResolver = audienceResolver;
        _userBlockService = userBlockService;
    }

    public async Task BroadcastStatusChangedAsync(
        Guid userId,
        Status status,
        DateTimeOffset lastSeen,
        CancellationToken cancellationToken = default)
    {
        var normalizedStatus = status.ToString().ToLowerInvariant();
        var lastSeenIso = lastSeen.ToString("O");
        var payload = new
        {
            userId,
            status = normalizedStatus,
            lastSeen = lastSeenIso
        };

        var audience = await _audienceResolver.GetAudienceUserIdsAsync(userId, cancellationToken);
        var notifyTasks = new List<Task>();

        foreach (var viewerId in audience)
        {
            if (viewerId != userId
                && await _userBlockService.ShouldHidePresenceAsync(viewerId, userId, cancellationToken))
            {
                continue;
            }

            notifyTasks.Add(
                _notificationHub.Clients
                    .Group($"user-{viewerId}")
                    .SendAsync("UserStatusChanged", payload, cancellationToken));
        }

        await Task.WhenAll(notifyTasks);
    }
}
