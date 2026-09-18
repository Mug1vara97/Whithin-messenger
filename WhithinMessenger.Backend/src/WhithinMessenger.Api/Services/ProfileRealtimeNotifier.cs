using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Api.Services;

public class ProfileRealtimeNotifier : IProfileRealtimeNotifier
{
    private readonly IHubContext<AppHub> _hub;
    private readonly IProfileAudienceResolver _audienceResolver;
    private readonly IUserListCacheService _userListCache;
    private readonly WithinDbContext _context;

    public ProfileRealtimeNotifier(
        IHubContext<AppHub> hub,
        IProfileAudienceResolver audienceResolver,
        IUserListCacheService userListCache,
        WithinDbContext context)
    {
        _hub = hub;
        _audienceResolver = audienceResolver;
        _userListCache = userListCache;
        _context = context;
    }

    public async Task NotifyUserProfileUpdatedAsync(
        Guid userId,
        UserProfile profile,
        ApplicationUser? user,
        IEnumerable<string>? changedFields = null,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            userId,
            username = user?.UserName,
            displayName = profile.DisplayName,
            avatar = profile.Avatar,
            avatarColor = profile.AvatarColor,
            description = profile.Description,
            banner = profile.Banner,
            nameplate = profile.Nameplate,
            avatarDecoration = profile.AvatarDecoration,
            changedFields = changedFields?.ToArray() ?? Array.Empty<string>(),
        };

        var audience = await _audienceResolver.GetAudienceUserIdsAsync(userId, cancellationToken);
        await _userListCache.InvalidateUserChatsAsync(audience, cancellationToken);

        var notifyTasks = audience.Select(viewerId =>
            _hub.Clients
                .Group(HubGroups.User(viewerId))
                .SendAsync("UserProfileUpdated", payload, cancellationToken));

        await Task.WhenAll(notifyTasks);

        var serverIds = await _context.ServerMembers
            .AsNoTracking()
            .Where(sm => sm.UserId == userId)
            .Select(sm => sm.ServerId)
            .ToListAsync(cancellationToken);

        var serverNotifyTasks = serverIds.Select(serverId =>
            _hub.Clients
                .Group(HubGroups.Server(serverId))
                .SendAsync("MemberProfileUpdated", payload, cancellationToken));

        await Task.WhenAll(serverNotifyTasks);
    }
}
