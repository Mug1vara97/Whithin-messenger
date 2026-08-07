using Microsoft.AspNetCore.SignalR;

namespace WhithinMessenger.MusicSignal;

public sealed class MusicSyncHub : Hub
{
    private readonly MusicPresenceStore _presence;

    public MusicSyncHub(MusicPresenceStore presence)
    {
        _presence = presence;
    }

    private string? MusicUserId =>
        Context.GetHttpContext()?.Request.Query["musicUserId"].FirstOrDefault()
        ?? Context.Items["musicUserId"] as string;

    public override async Task OnConnectedAsync()
    {
        var userId = MusicUserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            Context.Abort();
            return;
        }

        Context.Items["musicUserId"] = userId.Trim();
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(userId));
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var removed = _presence.RemoveByConnection(Context.ConnectionId);
        if (removed is not null)
        {
            await Clients.Group(GroupName(removed.MusicUserId))
                .SendAsync("PeersChanged", _presence.GetPeers(removed.MusicUserId));
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task Register(string deviceId, string displayName)
    {
        var userId = Context.Items["musicUserId"] as string ?? MusicUserId;
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(deviceId))
            throw new HubException("musicUserId and deviceId required");

        userId = userId.Trim();
        deviceId = deviceId.Trim();

        _presence.Upsert(new MusicPeerInfo
        {
            MusicUserId = userId,
            DeviceId = deviceId,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? deviceId : displayName.Trim(),
            ConnectionId = Context.ConnectionId,
        });

        Context.Items["deviceId"] = deviceId;
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(userId));

        var peers = _presence.GetPeers(userId);
        await Clients.Group(GroupName(userId)).SendAsync("PeersChanged", peers);
    }

    public Task<object> GetPeers()
    {
        var userId = Context.Items["musicUserId"] as string ?? MusicUserId
            ?? throw new HubException("not registered");
        var selfDevice = Context.Items["deviceId"] as string;
        return Task.FromResult<object>(_presence.GetPeers(userId, selfDevice));
    }

    public async Task SendSignal(string toDeviceId, string type, string payload)
    {
        var userId = Context.Items["musicUserId"] as string ?? MusicUserId
            ?? throw new HubException("not registered");
        var fromDevice = Context.Items["deviceId"] as string
            ?? throw new HubException("call Register first");

        var target = _presence.Find(userId, toDeviceId)
            ?? throw new HubException("peer offline");

        await Clients.Client(target.ConnectionId).SendAsync("ReceiveSignal", new
        {
            fromDeviceId = fromDevice,
            type,
            payload,
        });
    }

    private static string GroupName(string musicUserId) => $"music-{musicUserId}";
}
