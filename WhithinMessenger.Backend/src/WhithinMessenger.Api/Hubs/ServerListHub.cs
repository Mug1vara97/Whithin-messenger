using Microsoft.AspNetCore.SignalR;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using WhithinMessenger.Application.CommandsAndQueries.Servers;
using System.Security.Claims;

namespace WhithinMessenger.Api.Hubs;

public class ServerListHub : Hub
{
    private readonly IMediator _mediator;

    public ServerListHub(IMediator mediator)
    {
        _mediator = mediator;
    }

    private Guid? GetCurrentUserId()
    {
        // Сначала пробуем получить из JWT claims
        var userIdClaim = Context.User?.FindFirst("UserId")?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }

        // Fallback на query parameter (для совместимости)
        var userIdFromQuery = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault();
        if (Guid.TryParse(userIdFromQuery, out var userIdFromQueryParsed))
        {
            return userIdFromQueryParsed;
        }

        return null;
    }

    public async Task JoinServerListGroup()
    {
        var userId = GetCurrentUserId();
        if (userId != null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"serverlist_{userId}");
        }
    }

    public async Task LeaveServerListGroup()
    {
        var userId = GetCurrentUserId();
        if (userId != null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"serverlist_{userId}");
        }
    }

    public async Task<object?> GetUserServers()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return null;
            }

            var query = new GetUserServersQuery(userId.Value);
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                return result.Servers;
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                return null;
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при получении списка серверов: {ex.Message}");
            return null;
        }
    }

    public async Task<object?> CreateServer(string serverName, bool isPublic = false, string? description = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return null;
            }

            var command = new CreateServerCommand(serverName, userId.Value, isPublic, description);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Caller.SendAsync("ServerCreated", result.Server);
                return result.Server;
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                return null;
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при создании сервера: {ex.Message}");
            return null;
        }
    }

    public async Task<object?> GetPublicServers()
    {
        try
        {
            var query = new GetPublicServersQuery();
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                return result.Servers;
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                return null;
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при получении публичных серверов: {ex.Message}");
            return null;
        }
    }

    public async Task<object?> JoinServer(Guid serverId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return null;
            }

            var command = new JoinServerCommand(serverId, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                var updatedServers = await GetUserServers();
                
                await Clients.Caller.SendAsync("ServerListUpdated");
                
                return new { message = "Успешно присоединились к серверу" };
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                return null;
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при присоединении к серверу: {ex.Message}");
            return null;
        }
    }

    public async Task NotifyServerListUpdated()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId != null)
            {
                await Clients.Group($"serverlist_{userId}").SendAsync("ServerListUpdated");
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при уведомлении об обновлении списка: {ex.Message}");
        }
    }

    public async Task NotifyUserAddedToServer(Guid userId, Guid serverId, Guid addedBy)
    {
        try
        {
            Console.WriteLine($"ServerListHub: Notifying user {userId} that they were added to server {serverId}");
            await Clients.User(userId.ToString()).SendAsync("YouWereAddedToServer", new
            {
                serverId,
                addedBy
            });
            Console.WriteLine($"ServerListHub: YouWereAddedToServer sent successfully to user {userId}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ServerListHub: Error sending YouWereAddedToServer to user {userId}: {ex.Message}");
        }
    }

    public static async Task NotifyUserAddedToServer(IServiceProvider? serviceProvider, Guid userId, Guid serverId, Guid addedBy)
    {
        try
        {
            Console.WriteLine($"ServerListHub: Static method - Notifying user {userId} that they were added to server {serverId}");
            if (serviceProvider != null)
            {
                var hubContext = serviceProvider.GetRequiredService<IHubContext<ServerListHub>>();
                await hubContext.Clients.User(userId.ToString()).SendAsync("YouWereAddedToServer", new
                {
                    serverId,
                    addedBy
                });
                Console.WriteLine($"ServerListHub: Static method - YouWereAddedToServer sent successfully to user {userId}");
            }
            else
            {
                Console.WriteLine($"ServerListHub: Static method - ServiceProvider is null");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ServerListHub: Static method - Error sending YouWereAddedToServer to user {userId}: {ex.Message}");
        }
    }
}
