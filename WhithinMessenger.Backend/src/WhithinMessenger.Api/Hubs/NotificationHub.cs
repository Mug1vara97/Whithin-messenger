using Microsoft.AspNetCore.SignalR;

namespace WhithinMessenger.Api.Hubs;

public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst("UserId")?.Value;
        if (!string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var userIdGuid))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userIdGuid}");
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
}



