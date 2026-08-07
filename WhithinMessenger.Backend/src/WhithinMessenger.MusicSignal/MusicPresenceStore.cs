namespace WhithinMessenger.MusicSignal;

public sealed class MusicPeerInfo
{
    public required string MusicUserId { get; init; }
    public required string DeviceId { get; init; }
    public required string DisplayName { get; init; }
    public required string ConnectionId { get; set; }
}

public sealed class MusicPresenceStore
{
    private readonly object _gate = new();
    // musicUserId -> deviceId -> peer
    private readonly Dictionary<string, Dictionary<string, MusicPeerInfo>> _byUser = new(StringComparer.Ordinal);

    public void Upsert(MusicPeerInfo peer)
    {
        lock (_gate)
        {
            if (!_byUser.TryGetValue(peer.MusicUserId, out var devices))
            {
                devices = new Dictionary<string, MusicPeerInfo>(StringComparer.Ordinal);
                _byUser[peer.MusicUserId] = devices;
            }

            // Drop stale connection for same device
            devices[peer.DeviceId] = peer;
        }
    }

    public MusicPeerInfo? RemoveByConnection(string connectionId)
    {
        lock (_gate)
        {
            foreach (var (userId, devices) in _byUser)
            {
                var match = devices.FirstOrDefault(kv => kv.Value.ConnectionId == connectionId);
                if (match.Value is null) continue;
                devices.Remove(match.Key);
                if (devices.Count == 0) _byUser.Remove(userId);
                return match.Value;
            }
        }
        return null;
    }

    public IReadOnlyList<MusicPeerInfo> GetPeers(string musicUserId, string? excludeDeviceId = null)
    {
        lock (_gate)
        {
            if (!_byUser.TryGetValue(musicUserId, out var devices))
                return Array.Empty<MusicPeerInfo>();
            return devices.Values
                .Where(p => excludeDeviceId is null || p.DeviceId != excludeDeviceId)
                .Select(Clone)
                .ToList();
        }
    }

    public MusicPeerInfo? Find(string musicUserId, string deviceId)
    {
        lock (_gate)
        {
            if (_byUser.TryGetValue(musicUserId, out var devices) &&
                devices.TryGetValue(deviceId, out var peer))
            {
                return Clone(peer);
            }
        }
        return null;
    }

    private static MusicPeerInfo Clone(MusicPeerInfo p) => new()
    {
        MusicUserId = p.MusicUserId,
        DeviceId = p.DeviceId,
        DisplayName = p.DisplayName,
        ConnectionId = p.ConnectionId,
    };
}
