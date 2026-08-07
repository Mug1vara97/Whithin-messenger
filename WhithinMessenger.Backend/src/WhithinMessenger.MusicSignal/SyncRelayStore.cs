using System.Collections.Concurrent;

namespace WhithinMessenger.MusicSignal;

/// <summary>Ephemeral file relay for remote sync when WebRTC DataChannel is unavailable (e.g. Qt MVP).</summary>
public sealed class SyncRelayStore
{
    private readonly ConcurrentDictionary<string, RelaySession> _sessions = new(StringComparer.Ordinal);

    public string CreateSession(string musicUserId, string fromDevice, string toDevice)
    {
        var id = Guid.NewGuid().ToString("N");
        _sessions[id] = new RelaySession(musicUserId, fromDevice, toDevice);
        return id;
    }

    public bool PutFile(string sessionId, string hash, string fileName, string metaJson, byte[] data)
    {
        if (!_sessions.TryGetValue(sessionId, out var session)) return false;
        session.Files[hash] = new RelayFile(fileName, metaJson, data);
        return true;
    }

    public RelayFile? GetFile(string sessionId, string hash)
    {
        if (!_sessions.TryGetValue(sessionId, out var session)) return null;
        return session.Files.TryGetValue(hash, out var file) ? file : null;
    }

    public IReadOnlyCollection<string> ListHashes(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session)) return Array.Empty<string>();
        return session.Files.Keys.ToList();
    }

    public void Complete(string sessionId) => _sessions.TryRemove(sessionId, out _);

    public sealed record RelayFile(string FileName, string MetaJson, byte[] Data);

    private sealed class RelaySession(string musicUserId, string fromDevice, string toDevice)
    {
        public string MusicUserId { get; } = musicUserId;
        public string FromDevice { get; } = fromDevice;
        public string ToDevice { get; } = toDevice;
        public ConcurrentDictionary<string, RelayFile> Files { get; } = new(StringComparer.Ordinal);
        public DateTime CreatedUtc { get; } = DateTime.UtcNow;
    }
}
