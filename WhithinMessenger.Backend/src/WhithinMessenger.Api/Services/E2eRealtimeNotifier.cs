using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.Services;

namespace WhithinMessenger.Api.Services;

public class E2eRealtimeNotifier : IE2eRealtimeNotifier
{
    private readonly IHubContext<ChatListHub> _chatListHubContext;

    public E2eRealtimeNotifier(IHubContext<ChatListHub> chatListHubContext)
    {
        _chatListHubContext = chatListHubContext;
    }

    public async Task NotifyChatKeyRewrapNeededAsync(
        Guid chatId,
        Guid userIdWithChangedKey,
        string deviceId,
        IReadOnlyList<Guid> memberUserIds,
        CancellationToken cancellationToken = default)
    {
        if (memberUserIds.Count == 0)
        {
            return;
        }

        var payload = new
        {
            chatId,
            userId = userIdWithChangedKey,
            deviceId,
        };

        var notified = new HashSet<Guid>();
        foreach (var memberId in memberUserIds)
        {
            if (!notified.Add(memberId))
            {
                continue;
            }

            await _chatListHubContext.Clients
                .Group($"user-{memberId}")
                .SendAsync("e2echatkeyrewrapneeded", payload, cancellationToken);
        }
    }
}
