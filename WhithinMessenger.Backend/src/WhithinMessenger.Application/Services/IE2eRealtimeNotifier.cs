namespace WhithinMessenger.Application.Services;

public interface IE2eRealtimeNotifier
{
    Task NotifyChatKeyRewrapNeededAsync(
        Guid chatId,
        Guid userIdWithChangedKey,
        string deviceId,
        IReadOnlyList<Guid> memberUserIds,
        CancellationToken cancellationToken = default);
}
