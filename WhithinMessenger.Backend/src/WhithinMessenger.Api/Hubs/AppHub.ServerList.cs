using Microsoft.AspNetCore.SignalR;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using WhithinMessenger.Application.CommandsAndQueries.Servers;
using WhithinMessenger.Domain.Interfaces;
using System.Security.Claims;

namespace WhithinMessenger.Api.Hubs;

/// <summary>
/// ServerList-домен единого хаба (бывший ServerListHub): список серверов пользователя,
/// создание/вступление, порядок. Группы: HubGroups.ServerList(userId).
/// </summary>
public partial class AppHub
{
    public async Task JoinServerListGroup()
    {
        var userId = GetCurrentUserId();
        if (userId != null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, HubGroups.ServerList(userId.Value));
        }
    }

    public async Task LeaveServerListGroup()
    {
        var userId = GetCurrentUserId();
        if (userId != null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroups.ServerList(userId.Value));
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
                await Clients.Group(HubGroups.ServerList(userId.Value)).SendAsync("ServerListUpdated");
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при уведомлении об обновлении списка: {ex.Message}");
        }
    }

    public async Task ReorderServers(List<Guid> serverIds)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            if (serverIds == null || serverIds.Count == 0)
            {
                return;
            }

            await _serverRepository.SaveUserServerOrderAsync(userId.Value, serverIds, Context.ConnectionAborted);

            // Синхронизируем все вкладки/устройства текущего пользователя.
            await Clients.Group(HubGroups.ServerList(userId.Value)).SendAsync("ServerListUpdated");
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при сохранении порядка серверов: {ex.Message}");
        }
    }

}
