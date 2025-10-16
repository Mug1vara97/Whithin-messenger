using MediatR;
using System.Text.Json;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class GetServerQueryHandler : IRequestHandler<GetServerQuery, GetServerResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IRoleRepository _roleRepository;

    public GetServerQueryHandler(
        IServerRepository serverRepository,
        ICategoryRepository categoryRepository,
        IChatRepository chatRepository,
        IRoleRepository roleRepository)
    {
        _serverRepository = serverRepository;
        _categoryRepository = categoryRepository;
        _chatRepository = chatRepository;
        _roleRepository = roleRepository;
    }

    public async Task<GetServerResult> Handle(GetServerQuery request, CancellationToken cancellationToken)
    {
        try
        {
            // Получаем сервер
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new GetServerResult
                {
                    Success = false,
                    ErrorMessage = "Сервер не найден"
                };
            }

            // Проверяем доступ пользователя к серверу
            var userServers = await _serverRepository.GetUserServersAsync(request.UserId, cancellationToken);
            if (!userServers.Any(s => s.Id == request.ServerId))
            {
                return new GetServerResult
                {
                    Success = false,
                    ErrorMessage = "У вас нет доступа к этому серверу"
                };
            }

            // Получаем роли пользователя на сервере
            var userRoles = await _roleRepository.GetUserRolesAsync(request.UserId, request.ServerId, cancellationToken);
            var userRoleIds = userRoles.Select(r => r.Id).ToList();

            // Получаем категории сервера
            var categories = await _categoryRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var orderedCategories = categories.OrderBy(c => c.CategoryOrder).ToList();

            // Получаем чаты сервера
            var chats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var orderedChats = chats.OrderBy(c => c.ChatOrder).ToList();

            // Фильтруем категории по доступу
            var filteredCategories = orderedCategories
                .Where(category => HasAccessToCategory(category, request.UserId, userRoleIds, server.OwnerId))
                .Select(category => new
                {
                    categoryId = category.Id,
                    categoryName = category.CategoryName,
                    categoryOrder = category.CategoryOrder,
                    isPrivate = category.IsPrivate,
                    allowedRoleIds = category.AllowedRoleIds,
                    allowedUserIds = category.AllowedUserIds,
                    chats = orderedChats
                        .Where(c => c.CategoryId == category.Id)
                        .Where(chat => HasAccessToChat(chat, request.UserId, userRoleIds, server.OwnerId))
                        .OrderBy(c => c.ChatOrder)
                        .Select(c => new
                        {
                            chatId = c.Id,
                            name = c.Name,
                            typeId = c.TypeId,
                            chatOrder = c.ChatOrder,
                            isPrivate = c.IsPrivate,
                            allowedRoleIds = c.AllowedRoleIds,
                            members = c.Members.Select(m => new { userId = m.UserId }).ToList()
                        })
                        .ToList()
                })
                .ToList();

            // Получаем чаты без категории
            var uncategorizedChats = orderedChats
                .Where(c => c.CategoryId == null)
                .Where(chat => HasAccessToChat(chat, request.UserId, userRoleIds, server.OwnerId))
                .OrderBy(c => c.ChatOrder)
                .Select(c => new
                {
                    chatId = c.Id,
                    name = c.Name,
                    typeId = c.TypeId,
                    chatOrder = c.ChatOrder,
                    isPrivate = c.IsPrivate,
                    allowedRoleIds = c.AllowedRoleIds,
                    members = c.Members.Select(m => new { userId = m.UserId }).ToList()
                })
                .ToList();

            var resultCategories = new List<object>();
            resultCategories.AddRange(filteredCategories);

            if (uncategorizedChats.Any())
            {
                resultCategories.Add(new
                {
                    categoryId = (Guid?)null,
                    categoryName = (string?)null,
                    categoryOrder = -1,
                    isPrivate = false,
                    allowedRoleIds = (string?)null,
                    allowedUserIds = (string?)null,
                    chats = uncategorizedChats
                });
            }

            var result = new
            {
                ServerId = server.Id,
                server.Name,
                Categories = resultCategories,
                OwnerId = server.OwnerId,
                UserRoles = userRoleIds
            };

            return new GetServerResult
            {
                Success = true,
                Server = result
            };
        }
        catch (Exception ex)
        {
            return new GetServerResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    private bool HasAccessToCategory(ChatCategory category, Guid userId, List<Guid> userRoleIds, Guid ownerId)
    {
        // Владелец сервера имеет доступ ко всем категориям
        if (ownerId == userId)
        {
            return true;
        }

        // Публичные категории доступны всем
        if (!category.IsPrivate)
        {
            return true;
        }

        // Проверяем доступ по ролям
        if (!string.IsNullOrEmpty(category.AllowedRoleIds))
        {
            try
            {
                var allowedRoles = JsonSerializer.Deserialize<List<Guid>>(category.AllowedRoleIds);
                if (allowedRoles?.Any(roleId => userRoleIds.Contains(roleId)) == true)
                {
                    return true;
                }
            }
            catch
            {
                // Fallback для старых форматов
                var roleIdStr = category.AllowedRoleIds.Trim('[', ']', ' ');
                if (Guid.TryParse(roleIdStr, out Guid roleId))
                {
                    if (userRoleIds.Contains(roleId))
                    {
                        return true;
                    }
                }
            }
        }

        // Проверяем доступ по пользователям
        if (!string.IsNullOrEmpty(category.AllowedUserIds))
        {
            try
            {
                var allowedUsers = JsonSerializer.Deserialize<List<Guid>>(category.AllowedUserIds);
                if (allowedUsers?.Contains(userId) == true)
                {
                    return true;
                }
            }
            catch
            {
                // Fallback для старых форматов
                var userIdStr = category.AllowedUserIds.Trim('[', ']', ' ');
                if (Guid.TryParse(userIdStr, out Guid allowedUserId))
                {
                    if (allowedUserId == userId)
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private bool HasAccessToChat(Chat chat, Guid userId, List<Guid> userRoleIds, Guid ownerId)
    {
        // Владелец сервера имеет доступ ко всем чатам
        if (ownerId == userId)
        {
            return true;
        }

        // Публичные чаты доступны всем
        if (!chat.IsPrivate)
        {
            return true;
        }

        // Проверяем доступ по ролям
        if (!string.IsNullOrEmpty(chat.AllowedRoleIds))
        {
            try
            {
                var allowedRoles = JsonSerializer.Deserialize<List<Guid>>(chat.AllowedRoleIds);
                if (allowedRoles?.Any(roleId => userRoleIds.Contains(roleId)) == true)
                {
                    return true;
                }
            }
            catch
            {
                // Fallback для старых форматов
                var roleIdStr = chat.AllowedRoleIds.Trim('[', ']', ' ');
                if (Guid.TryParse(roleIdStr, out Guid roleId))
                {
                    if (userRoleIds.Contains(roleId))
                    {
                        return true;
                    }
                }
            }
        }

        // Проверяем доступ по участникам чата
        return chat.Members.Any(m => m.UserId == userId);
    }
}
