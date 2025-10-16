using Microsoft.AspNetCore.SignalR;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using WhithinMessenger.Application.CommandsAndQueries.Servers;
using WhithinMessenger.Application.CommandsAndQueries.Servers.AddMember;
using WhithinMessenger.Application.CommandsAndQueries.Servers.LeaveServer;
using WhithinMessenger.Application.CommandsAndQueries.Servers.DeleteServer;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Hubs;

public class ServerHub : Hub
{
    private readonly IMediator _mediator;

    public ServerHub(IMediator mediator)
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

    public async Task JoinServerGroup(string serverId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, serverId);
    }

    public async Task LeaveServerGroup(string serverId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, serverId);
    }

    // Управление категориями
    public async Task MoveCategory(Guid serverId, Guid categoryId, int newPosition)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new MoveCategoryCommand(serverId, categoryId, newPosition, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("CategoriesReordered", result.Categories);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при перемещении категории: {ex.Message}");
        }
    }

    public async Task CreateCategory(Guid serverId, string categoryName)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new CreateCategoryCommand(serverId, categoryName, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("CategoryCreated", result.Category);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при создании категории: {ex.Message}");
        }
    }

    public async Task CreatePrivateCategory(Guid serverId, string categoryName, List<Guid> allowedRoleIds, List<Guid> allowedUserIds)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new CreatePrivateCategoryCommand(serverId, categoryName, allowedRoleIds, allowedUserIds, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("CategoryCreated", result.Category);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при создании приватной категории: {ex.Message}");
        }
    }

    public async Task DeleteCategory(Guid serverId, Guid categoryId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new DeleteCategoryCommand(serverId, categoryId, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("CategoryDeleted", categoryId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при удалении категории: {ex.Message}");
        }
    }

    // Управление чатами
    public async Task MoveChat(Guid serverId, Guid chatId, Guid? sourceCategoryId, Guid? targetCategoryId, int newPosition)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new MoveChatCommand(serverId, chatId, sourceCategoryId, targetCategoryId, newPosition, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("ChatsReordered", result.Categories);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при перемещении чата: {ex.Message}");
        }
    }

    public async Task CreateChat(Guid serverId, Guid? categoryId, string chatName, int chatType)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new CreateChatCommand(serverId, categoryId, chatName, chatType, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("ChatCreated", result.Chat, categoryId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при создании чата: {ex.Message}");
        }
    }


    public async Task UpdateChatName(Guid serverId, Guid chatId, string newName)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new UpdateChatNameCommand(serverId, chatId, newName, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("ChatUpdated", result.Chat);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при обновлении названия чата: {ex.Message}");
        }
    }

    public async Task DeleteChat(Guid serverId, Guid chatId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new DeleteChatCommand(serverId, chatId, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("ChatDeleted", chatId, result.CategoryId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при удалении чата: {ex.Message}");
        }
    }

    // Управление ролями
    public async Task GetRoles(Guid serverId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var query = new GetRolesQuery(serverId, userId.Value);
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                await Clients.Caller.SendAsync("RolesLoaded", result.Roles);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при получении ролей: {ex.Message}");
        }
    }

    public async Task CreateRole(Guid serverId, string roleName, string color, string permissions)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new CreateRoleCommand(serverId, roleName, color, permissions, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("RoleCreated", result.Role);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при создании роли: {ex.Message}");
        }
    }

    public async Task UpdateRole(Guid roleId, string roleName, string color, string permissions)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new UpdateRoleCommand(roleId, roleName, color, permissions, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(result.ServerId.ToString()).SendAsync("RoleUpdated", result.Role);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при обновлении роли: {ex.Message}");
        }
    }

    public async Task DeleteRole(Guid roleId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new DeleteRoleCommand(roleId, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(result.ServerId.ToString()).SendAsync("RoleDeleted", roleId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при удалении роли: {ex.Message}");
        }
    }

    // Управление участниками
    public async Task GetServerMembers(Guid serverId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var query = new GetServerMembersQuery(serverId, userId.Value);
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                await Clients.Caller.SendAsync("ServerMembersLoaded", result.Members);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при получении участников: {ex.Message}");
        }
    }

    public async Task AssignRole(Guid userId, Guid roleId)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new AssignRoleCommand(userId, roleId, currentUserId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(result.ServerId.ToString()).SendAsync("RoleAssigned", userId, result.Role);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при назначении роли: {ex.Message}");
        }
    }

    public async Task RemoveRole(Guid userId, Guid roleId)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new RemoveRoleCommand(userId, roleId, currentUserId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(result.ServerId.ToString()).SendAsync("RoleRemoved", userId, roleId);
                await Clients.User(userId.ToString()).SendAsync("UserRolesLoaded", result.RemainingRoles);
                await Clients.User(userId.ToString()).SendAsync("UserPermissionsUpdated", userId, result.MergedPermissions);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при удалении роли: {ex.Message}");
        }
    }

    public async Task KickMember(Guid serverId, Guid userId)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new KickMemberCommand(serverId, userId, currentUserId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("MemberKicked", userId);
                await Clients.User(userId.ToString()).SendAsync("YouWereKicked", serverId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при удалении участника: {ex.Message}");
        }
    }

    public async Task AddMember(Guid serverId, Guid userId)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new AddMemberCommand(serverId, userId);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                // Уведомляем всех участников сервера о добавлении нового участника
                await Clients.Group(serverId.ToString()).SendAsync("MemberAdded", new
                {
                    serverId,
                    userId,
                    serverMemberId = result.ServerMemberId,
                    addedBy = currentUserId.Value
                });

                // Уведомляем добавленного пользователя через ServerListHub
                Console.WriteLine($"ServerHub: Sending YouWereAddedToServer to user {userId} via ServerListHub");
                var serverListHubContext = Context.GetHttpContext()?.RequestServices?.GetRequiredService<IHubContext<ServerListHub>>();
                if (serverListHubContext != null)
                {
                    await serverListHubContext.Clients.User(userId.ToString()).SendAsync("YouWereAddedToServer", new
                    {
                        serverId,
                        addedBy = currentUserId.Value
                    });
                    Console.WriteLine($"ServerHub: YouWereAddedToServer sent successfully to user {userId} via ServerListHub");
                }
                else
                {
                    Console.WriteLine($"ServerHub: Failed to get ServerListHub context");
                }
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при добавлении участника: {ex.Message}");
        }
    }

    public async Task GetUserRoles(Guid userId, Guid serverId)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var query = new GetUserRolesQuery(userId, serverId, currentUserId.Value);
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                await Clients.Caller.SendAsync("UserRolesLoaded", result.Roles);
            }
            else
            {
                await Clients.Caller.SendAsync("UserRolesError", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("UserRolesError", ex.Message);
        }
    }

    // Управление сервером
    public async Task UpdateServerName(Guid serverId, string newName)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new UpdateServerNameCommand(serverId, newName, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Group(serverId.ToString()).SendAsync("ServerNameUpdated", serverId, newName);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при обновлении имени сервера: {ex.Message}");
        }
    }

    public async Task<object?> GetServerInfo(Guid serverId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return null;
            }

            var query = new GetServerInfoQuery(serverId, userId.Value);
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                return result.ServerInfo;
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                return null;
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при получении информации о сервере: {ex.Message}");
            return null;
        }
    }

    // Журнал аудита
    public async Task GetAuditLog(Guid serverId, int page = 1, int pageSize = 50)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var query = new GetAuditLogQuery(serverId, page, pageSize, userId.Value);
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                await Clients.Caller.SendAsync("AuditLogLoaded", result.AuditLogs);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при получении журнала аудита: {ex.Message}");
        }
    }

    // Создание сервера
    public async Task CreateServer(string serverName, bool isPublic = false, string? description = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new CreateServerCommand(serverName, userId.Value, isPublic, description);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                await Clients.Caller.SendAsync("ServerCreated", result.Server);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при создании сервера: {ex.Message}");
        }
    }

    // Получение списка серверов пользователя
    public async Task GetUserServers()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var query = new GetUserServersQuery(userId.Value);
            var result = await _mediator.Send(query);

            if (result.Success)
            {
                await Clients.Caller.SendAsync("UserServersLoaded", result.Servers);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при получении списка серверов: {ex.Message}");
        }
    }

    // Покинуть сервер
    public async Task LeaveServer(Guid serverId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            var command = new LeaveServerCommand(serverId, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                // Уведомляем всех участников сервера о том, что пользователь покинул сервер
                await Clients.Group(serverId.ToString()).SendAsync("MemberLeft", new
                {
                    serverId = serverId,
                    userId = userId.Value
                });

                // Уведомляем покинувшего пользователя
                await Clients.Caller.SendAsync("ServerLeft", serverId);
                
                // Также уведомляем через ServerListHub для обновления списка серверов
                var serverListHubContext = Context.GetHttpContext()?.RequestServices?.GetRequiredService<IHubContext<ServerListHub>>();
                if (serverListHubContext != null)
                {
                    await serverListHubContext.Clients.User(userId.Value.ToString()).SendAsync("ServerLeft", serverId);
                }
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при покидании сервера: {ex.Message}");
        }
    }

    // Удалить сервер
    public async Task DeleteServer(Guid serverId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                return;
            }

            // Получаем список участников сервера ПЕРЕД удалением сервера
            var serverMembers = await GetServerMembersList(serverId);
            Console.WriteLine($"ServerHub: Found {serverMembers?.Count ?? 0} server members to notify before deletion");
            if (serverMembers != null && serverMembers.Any())
            {
                foreach (var member in serverMembers)
                {
                    Console.WriteLine($"ServerHub: Member to notify: {member.UserId}");
                }
            }

            var command = new DeleteServerCommand(serverId, userId.Value);
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                Console.WriteLine($"ServerHub: Server {serverId} deleted successfully, sending notifications");
                
                // Уведомляем всех участников сервера о том, что сервер удален
                await Clients.Group(serverId.ToString()).SendAsync("ServerDeleted", serverId);
                Console.WriteLine($"ServerHub: Sent ServerDeleted to group {serverId}");

                // Уведомляем владельца
                await Clients.Caller.SendAsync("ServerDeleted", serverId);
                Console.WriteLine($"ServerHub: Sent ServerDeleted to caller");
                
                // Также уведомляем через ServerListHub для обновления списка серверов
                var serverListHubContext = Context.GetHttpContext()?.RequestServices?.GetRequiredService<IHubContext<ServerListHub>>();
                if (serverListHubContext != null)
                {
                    // Уведомляем создателя сервера
                    await serverListHubContext.Clients.User(userId.Value.ToString()).SendAsync("ServerDeleted", serverId);
                    Console.WriteLine($"ServerHub: Sent ServerDeleted to ServerListHub for user {userId}");
                    
                    // Уведомляем всех участников сервера через ServerListHub
                    if (serverMembers != null && serverMembers.Any())
                    {
                        Console.WriteLine($"ServerHub: Notifying {serverMembers.Count} members via ServerListHub");
                        foreach (var member in serverMembers)
                        {
                            if (member.UserId != userId.Value) // Не уведомляем создателя дважды
                            {
                                Console.WriteLine($"ServerHub: Sending ServerDeleted to ServerListHub for member {member.UserId}");
                                await serverListHubContext.Clients.User(member.UserId.ToString()).SendAsync("ServerDeleted", serverId);
                                Console.WriteLine($"ServerHub: Sent ServerDeleted to ServerListHub for member {member.UserId}");
                            }
                        }
                    }
                    else
                    {
                        Console.WriteLine($"ServerHub: No server members found to notify via ServerListHub");
                    }
                }
                else
                {
                    Console.WriteLine($"ServerHub: ServerListHub context is null");
                }
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Ошибка при удалении сервера: {ex.Message}");
        }
    }

    // Приватный метод для получения списка участников сервера
    private async Task<List<ServerMemberInfo>?> GetServerMembersList(Guid serverId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                Console.WriteLine($"ServerHub: Cannot get current user ID for server members query");
                return null;
            }

            var query = new GetServerMembersQuery(serverId, userId.Value);
            var result = await _mediator.Send(query);
            
            if (result.Success)
            {
                Console.WriteLine($"ServerHub: Successfully retrieved {result.Members?.Count ?? 0} server members");
                return result.Members;
            }
            else
            {
                Console.WriteLine($"ServerHub: Failed to get server members: {result.ErrorMessage}");
                return null;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ServerHub: Error getting server members: {ex.Message}");
            return null;
        }
    }
}
