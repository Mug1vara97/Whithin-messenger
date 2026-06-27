using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Api.Services;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Api.Hubs;

public class NotificationHub : Hub
{
    private static readonly ConcurrentDictionary<Guid, int> ActiveConnections = new();

    public static bool HasActiveConnection(Guid userId) =>
        ActiveConnections.TryGetValue(userId, out var count) && count > 0;
    private readonly WithinDbContext _context;
    private readonly IMessageReceiptService _messageReceiptService;
    private readonly IUserBlockService _userBlockService;

    public NotificationHub(
        WithinDbContext context,
        IMessageReceiptService messageReceiptService,
        IUserBlockService userBlockService)
    {
        _context = context;
        _messageReceiptService = messageReceiptService;
        _userBlockService = userBlockService;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst("UserId")?.Value;
        if (!string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var userIdGuid))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userIdGuid}");
            ActiveConnections.AddOrUpdate(userIdGuid, 1, (_, current) => current + 1);
            await MarkUserOnlineIfOfflineAsync(userIdGuid);

            try
            {
                await _messageReceiptService.AcknowledgePendingDeliveriesForUserAsync(userIdGuid);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to acknowledge pending deliveries for user {userId}: {ex.Message}");
            }

            Console.WriteLine($"User {userId} connected to NotificationHub");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirst("UserId")?.Value;
        if (!string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var userIdGuid))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userIdGuid}");
            var hasOtherConnections = DecrementConnectionCount(userIdGuid);
            if (!hasOtherConnections)
            {
                await MarkUserOfflineAsync(userIdGuid);
            }
            Console.WriteLine($"User {userId} disconnected from NotificationHub");
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinUserGroup(Guid userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
    }

    public async Task LeaveUserGroup(Guid userId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
    }

    public async Task NotifyMessageRead(Guid userId, Guid chatId, Guid messageId)
    {
        await Clients.Group($"user-{userId}").SendAsync("MessageRead", chatId, messageId);
    }

    private bool DecrementConnectionCount(Guid userId)
    {
        if (!ActiveConnections.TryGetValue(userId, out var current))
        {
            return false;
        }

        if (current <= 1)
        {
            ActiveConnections.TryRemove(userId, out _);
            return false;
        }

        ActiveConnections.TryUpdate(userId, current - 1, current);
        return true;
    }

    private async Task MarkUserOnlineIfOfflineAsync(Guid userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return;
        }

        if (user.Status == Status.Offline)
        {
            user.Status = Status.Online;
            user.LastSeen = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
            await BroadcastUserStatusChangedAsync(userId, user.Status, user.LastSeen);
        }
    }

    private async Task MarkUserOfflineAsync(Guid userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return;
        }

        if (user.Status != Status.Offline)
        {
            user.Status = Status.Offline;
            user.LastSeen = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
        }

        await BroadcastUserStatusChangedAsync(userId, user.Status, user.LastSeen);
    }

    private async Task BroadcastUserStatusChangedAsync(Guid userId, Status status, DateTimeOffset lastSeen)
    {
        var normalizedStatus = status.ToString().ToLowerInvariant();
        var lastSeenIso = lastSeen.ToString("O");
        var payload = new
        {
            userId,
            status = normalizedStatus,
            lastSeen = lastSeenIso
        };

        await Clients.Group($"user-{userId}").SendAsync("UserStatusChanged", payload);

        var friendIds = await _context.Friendships
            .Where(f => (f.RequesterId == userId || f.AddresseeId == userId) && f.Status == FriendshipStatus.Accepted)
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();

        foreach (var friendId in friendIds)
        {
            if (await _userBlockService.ShouldHidePresenceAsync(friendId, userId, CancellationToken.None))
            {
                continue;
            }

            await Clients.Group($"user-{friendId}").SendAsync("UserStatusChanged", payload);
        }
    }
}



