using Microsoft.AspNetCore.SignalR;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using WhithinMessenger.Application.CommandsAndQueries.Servers;

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
        // Сначала пытаемся получить из query параметра
        var userIdFromQuery = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault();
        if (Guid.TryParse(userIdFromQuery, out var userIdFromQueryParsed))
        {
            return userIdFromQueryParsed;
        }

        // Если не найден в query, пытаемся получить из claims
        var userIdClaim = Context.User?.FindFirst("userId")?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
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

    // Получение списка серверов пользователя
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

    // Создание нового сервера
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
                // Отправляем событие ServerCreated для обновления списка серверов
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

    // Получение публичных серверов
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

    // Присоединение к публичному серверу
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
                // Обновляем список серверов пользователя
                var updatedServers = await GetUserServers();
                
                // Уведомляем пользователя об обновлении списка
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

    // Обновление списка серверов для всех пользователей
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

    // Метод для уведомления пользователя о том, что его добавили на сервер
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

    // Статический метод для уведомления пользователя о том, что его добавили на сервер
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
