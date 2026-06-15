using MediatR;
using System.Text.Json;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

internal static class ServerPermissionHelper
{
    public static bool HasPermission(IEnumerable<ServerRole> userRoles, Guid userId, Guid ownerId, string permission)
    {
        if (ownerId == userId)
        {
            return true;
        }

        if (userRoles.Any(role => RoleGrantsPermission(role.Permissions, permission)))
        {
            return true;
        }

        return ServerPermissionChecker.DefaultMemberPermissions.Contains(permission);
    }

    public static bool HasManageRolesPermission(IEnumerable<ServerRole> userRoles, Guid userId, Guid ownerId)
        => HasPermission(userRoles, userId, ownerId, "manageRoles");

    public static bool RoleGrantsPermission(string? permissionsJson, string permission)
    {
        if (string.IsNullOrWhiteSpace(permissionsJson))
        {
            return false;
        }

        try
        {
            var permissions = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(permissionsJson);
            if (permissions != null &&
                permissions.TryGetValue(permission, out var value) &&
                value.ValueKind == JsonValueKind.True)
            {
                return true;
            }
        }
        catch
        {
            // ignore malformed permission payloads
        }

        return false;
    }

    public static Dictionary<string, bool> MergePermissions(IEnumerable<ServerRole> roles)
    {
        var merged = new Dictionary<string, bool>();

        foreach (var role in roles)
        {
            if (string.IsNullOrWhiteSpace(role.Permissions))
            {
                continue;
            }

            try
            {
                var permissions = JsonSerializer.Deserialize<Dictionary<string, bool>>(role.Permissions);
                if (permissions == null)
                {
                    continue;
                }

                foreach (var (key, allowed) in permissions)
                {
                    if (allowed)
                    {
                        merged[key] = true;
                    }
                }
            }
            catch
            {
                // ignore malformed permission payloads
            }
        }

        return merged;
    }
}

public class DeleteCategoryCommandHandler : IRequestHandler<DeleteCategoryCommand, DeleteCategoryResult>
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public DeleteCategoryCommandHandler(
        ICategoryRepository categoryRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _categoryRepository = categoryRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<DeleteCategoryResult> Handle(DeleteCategoryCommand request, CancellationToken cancellationToken)
    {
        try
        {
            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageChannels", cancellationToken))
            {
                return new DeleteCategoryResult { Success = false, ErrorMessage = "Недостаточно прав для управления каналами" };
            }

            var category = await _categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken);
            if (category == null)
            {
                return new DeleteCategoryResult { Success = false, ErrorMessage = "Категория не найдена" };
            }

            if (category.ServerId != request.ServerId)
            {
                return new DeleteCategoryResult { Success = false, ErrorMessage = "Категория не принадлежит указанному серверу" };
            }

            await _categoryRepository.DeleteAsync(request.CategoryId, cancellationToken);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.CategoryDelete,
                AuditLogTargetTypes.Category,
                request.CategoryId,
                new { targetName = category.CategoryName },
                cancellationToken);

            return new DeleteCategoryResult { Success = true };
        }
        catch (Exception ex)
        {
            return new DeleteCategoryResult { Success = false, ErrorMessage = $"Ошибка при удалении категории: {ex.Message}" };
        }
    }
}

public class UpdateCategoryCommandHandler : IRequestHandler<UpdateCategoryCommand, UpdateCategoryResult>
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public UpdateCategoryCommandHandler(
        ICategoryRepository categoryRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _categoryRepository = categoryRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<UpdateCategoryResult> Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
    {
        try
        {
            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageChannels", cancellationToken))
            {
                return new UpdateCategoryResult { Success = false, ErrorMessage = "Недостаточно прав для управления каналами" };
            }

            var category = await _categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken);
            if (category == null)
            {
                return new UpdateCategoryResult { Success = false, ErrorMessage = "Категория не найдена" };
            }

            if (category.ServerId != request.ServerId)
            {
                return new UpdateCategoryResult { Success = false, ErrorMessage = "Категория не принадлежит указанному серверу" };
            }

            var categoryName = request.CategoryName?.Trim();
            if (string.IsNullOrWhiteSpace(categoryName))
            {
                return new UpdateCategoryResult { Success = false, ErrorMessage = "Название категории не может быть пустым" };
            }

            var duplicate = await _categoryRepository.ExistsAsync(request.ServerId, categoryName, cancellationToken);
            if (duplicate && !string.Equals(category.CategoryName, categoryName, StringComparison.OrdinalIgnoreCase))
            {
                return new UpdateCategoryResult { Success = false, ErrorMessage = "Категория с таким названием уже существует" };
            }

            var oldName = category.CategoryName;
            var wasPrivate = category.IsPrivate;
            var oldAllowedRoleIds = category.AllowedRoleIds;
            var oldAllowedUserIds = category.AllowedUserIds;

            category.CategoryName = categoryName;
            category.IsPrivate = request.IsPrivate;
            if (request.IsPrivate)
            {
                category.AllowedRoleIds = JsonSerializer.Serialize(request.AllowedRoleIds);
                category.AllowedUserIds = JsonSerializer.Serialize(request.AllowedUserIds);
            }
            else
            {
                category.AllowedRoleIds = null;
                category.AllowedUserIds = null;
            }

            var updatedCategory = await _categoryRepository.UpdateAsync(category, cancellationToken);

            var nameChanged = !string.Equals(oldName, categoryName, StringComparison.OrdinalIgnoreCase);
            var privacyChanged = wasPrivate != request.IsPrivate;
            var accessChanged = request.IsPrivate && wasPrivate && (
                category.AllowedRoleIds != oldAllowedRoleIds ||
                category.AllowedUserIds != oldAllowedUserIds);

            if (privacyChanged || accessChanged)
            {
                string detail;
                if (privacyChanged)
                {
                    detail = request.IsPrivate ? "Сделана приватной" : "Сделана публичной";
                }
                else
                {
                    detail = "Обновлён список доступа";
                }

                await _auditLog.LogAsync(
                    request.ServerId,
                    request.UserId,
                    AuditLogActionTypes.CategoryPrivacyUpdate,
                    AuditLogTargetTypes.Category,
                    updatedCategory.Id,
                    new
                    {
                        targetName = updatedCategory.CategoryName,
                        isPrivate = request.IsPrivate,
                        detail,
                    },
                    cancellationToken);
            }

            if (nameChanged)
            {
                await _auditLog.LogAsync(
                    request.ServerId,
                    request.UserId,
                    AuditLogActionTypes.CategoryUpdate,
                    AuditLogTargetTypes.Category,
                    updatedCategory.Id,
                    new { targetName = updatedCategory.CategoryName, field = "name" },
                    cancellationToken);
            }

            return new UpdateCategoryResult
            {
                Success = true,
                Category = new
                {
                    categoryId = updatedCategory.Id,
                    categoryName = updatedCategory.CategoryName,
                    serverId = updatedCategory.ServerId,
                    categoryOrder = updatedCategory.CategoryOrder,
                    isPrivate = updatedCategory.IsPrivate,
                    allowedRoleIds = updatedCategory.AllowedRoleIds,
                    allowedUserIds = updatedCategory.AllowedUserIds
                }
            };
        }
        catch (Exception ex)
        {
            return new UpdateCategoryResult { Success = false, ErrorMessage = $"Ошибка при обновлении категории: {ex.Message}" };
        }
    }
}


public class CreateChatCommandHandler : IRequestHandler<CreateChatCommand, CreateChatResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public CreateChatCommandHandler(
        IChatRepository chatRepository,
        ICategoryRepository categoryRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository,
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _chatRepository = chatRepository;
        _categoryRepository = categoryRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<CreateChatResult> Handle(CreateChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageChannels", cancellationToken))
            {
                return new CreateChatResult { Success = false, ErrorMessage = "Недостаточно прав для управления каналами" };
            }

            if (request.CategoryId.HasValue)
            {
                var category = await _categoryRepository.GetByIdAsync(request.CategoryId.Value, cancellationToken);
                if (category == null)
                {
                    return new CreateChatResult { Success = false, ErrorMessage = "Категория не найдена" };
                }
            }

            Guid typeId = request.ChatType switch
            {
                1 => Guid.Parse("11111111-1111-1111-1111-111111111111"), // Private
                2 => Guid.Parse("22222222-2222-2222-2222-222222222222"), // Group
                3 => Guid.Parse("33333333-3333-3333-3333-333333333333"), // TextChannel
                4 => Guid.Parse("44444444-4444-4444-4444-444444444444"), // VoiceChannel
                5 => Guid.Parse("55555555-5555-5555-5555-555555555555"), // IdeasBoard
                _ => Guid.Parse("33333333-3333-3333-3333-333333333333")  // По умолчанию TextChannel
            };

            var existingChats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var maxOrder = existingChats
                .Where(c => c.CategoryId == request.CategoryId)
                .Select(c => c.ChatOrder)
                .DefaultIfEmpty(0)
                .Max();

            var chat = new Chat
            {
                Id = Guid.NewGuid(),
                Name = request.ChatName,
                ServerId = request.ServerId,
                CategoryId = request.CategoryId,
                TypeId = typeId,
                CreatedAt = DateTime.UtcNow,
                IsPrivate = request.IsPrivate,
                ChatOrder = maxOrder + 1
            };

            await _chatRepository.CreateAsync(chat, cancellationToken);

            var memberUserIds = new List<Guid> { request.UserId };
            if (request.IsPrivate && request.MemberIds != null)
            {
                var isServerMember = await _serverRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken);
                if (!isServerMember)
                {
                    await _chatRepository.DeleteAsync(chat.Id, cancellationToken);
                    return new CreateChatResult { Success = false, ErrorMessage = "Вы не являетесь участником сервера" };
                }
                foreach (var uid in request.MemberIds)
                {
                    if (uid == request.UserId) continue;
                    var onServer = await _serverRepository.IsUserMemberAsync(request.ServerId, uid, cancellationToken);
                    if (onServer && !memberUserIds.Contains(uid))
                        memberUserIds.Add(uid);
                }
            }

            if (request.IsPrivate && memberUserIds.Count > 0)
            {
                var membersToAdd = new List<Member>();
                var chatLoaded = await _chatRepository.GetByIdAsync(chat.Id, cancellationToken);
                if (chatLoaded == null) chatLoaded = chat;

                foreach (var uid in memberUserIds)
                {
                    var appUser = await _userRepository.GetByIdAsync(uid, cancellationToken);
                    if (appUser == null) continue;
                    membersToAdd.Add(new Member
                    {
                        Id = Guid.NewGuid(),
                        ChatId = chat.Id,
                        UserId = uid,
                        JoinedAt = DateTimeOffset.UtcNow,
                        Chat = chatLoaded,
                        User = appUser
                    });
                }
                if (membersToAdd.Count > 0)
                    await _chatMemberRepository.AddRangeAsync(membersToAdd, cancellationToken);
            }
            else if (!request.IsPrivate)
            {
                // Public channels must include all current server members.
                var serverMembers = await _serverMemberRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
                var uniqueUserIds = serverMembers
                    .Select(sm => sm.UserId)
                    .Distinct()
                    .ToList();

                var membersToAdd = new List<Member>();
                var chatLoaded = await _chatRepository.GetByIdAsync(chat.Id, cancellationToken);
                if (chatLoaded == null) chatLoaded = chat;

                foreach (var uid in uniqueUserIds)
                {
                    var appUser = await _userRepository.GetByIdAsync(uid, cancellationToken);
                    if (appUser == null) continue;

                    membersToAdd.Add(new Member
                    {
                        Id = Guid.NewGuid(),
                        ChatId = chat.Id,
                        UserId = uid,
                        JoinedAt = DateTimeOffset.UtcNow,
                        Chat = chatLoaded,
                        User = appUser
                    });
                }

                if (membersToAdd.Count > 0)
                {
                    await _chatMemberRepository.AddRangeAsync(membersToAdd, cancellationToken);
                }
            }

            var result = new
            {
                chatId = chat.Id,
                name = chat.Name,
                serverId = chat.ServerId,
                categoryId = chat.CategoryId,
                typeId = chat.TypeId,
                createdAt = chat.CreatedAt,
                isPrivate = chat.IsPrivate,
                chatOrder = chat.ChatOrder,
                members = memberUserIds.Select(uid => new { userId = uid }).ToList()
            };

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.ChannelCreate,
                AuditLogTargetTypes.Channel,
                chat.Id,
                new { targetName = chat.Name, isPrivate = chat.IsPrivate, chatType = request.ChatType },
                cancellationToken);

            return new CreateChatResult
            {
                Success = true,
                Chat = result,
                NotifyUserIds = request.IsPrivate ? memberUserIds : null
            };
        }
        catch (Exception ex)
        {
            return new CreateChatResult { Success = false, ErrorMessage = $"Ошибка при создании чата: {ex.Message}" };
        }
    }
}

public class DeleteChatCommandHandler : IRequestHandler<DeleteChatCommand, DeleteChatResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public DeleteChatCommandHandler(
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<DeleteChatResult> Handle(DeleteChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new DeleteChatResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            if (chat.ServerId != request.ServerId)
            {
                return new DeleteChatResult { Success = false, ErrorMessage = "Чат не принадлежит указанному серверу" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageChannels", cancellationToken))
            {
                return new DeleteChatResult { Success = false, ErrorMessage = "Недостаточно прав для управления каналами" };
            }

            var categoryId = chat.CategoryId;

            await _chatRepository.DeleteAsync(request.ChatId, cancellationToken);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.ChannelDelete,
                AuditLogTargetTypes.Channel,
                request.ChatId,
                new { targetName = chat.Name },
                cancellationToken);

            return new DeleteChatResult { Success = true, CategoryId = categoryId };
        }
        catch (Exception ex)
        {
            return new DeleteChatResult { Success = false, ErrorMessage = $"Ошибка при удалении чата: {ex.Message}" };
        }
    }
}

public class UpdateChatNameCommandHandler : IRequestHandler<UpdateChatNameCommand, UpdateChatNameResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public UpdateChatNameCommandHandler(
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<UpdateChatNameResult> Handle(UpdateChatNameCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new UpdateChatNameResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            if (chat.ServerId != request.ServerId)
            {
                return new UpdateChatNameResult { Success = false, ErrorMessage = "Чат не принадлежит указанному серверу" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageChannels", cancellationToken))
            {
                return new UpdateChatNameResult { Success = false, ErrorMessage = "Недостаточно прав для управления каналами" };
            }

            chat.Name = request.NewName;
            await _chatRepository.UpdateAsync(chat, cancellationToken);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.ChannelUpdate,
                AuditLogTargetTypes.Channel,
                chat.Id,
                new { targetName = chat.Name, field = "name" },
                cancellationToken);

            var result = new
            {
                chatId = chat.Id,
                name = chat.Name,
                serverId = chat.ServerId,
                categoryId = chat.CategoryId,
                typeId = chat.TypeId,
                createdAt = chat.CreatedAt,
                isPrivate = chat.IsPrivate,
                chatOrder = 0
            };

            return new UpdateChatNameResult { Success = true, Chat = result };
        }
        catch (Exception ex)
        {
            return new UpdateChatNameResult { Success = false, ErrorMessage = $"Ошибка при обновлении названия чата: {ex.Message}" };
        }
    }
}

public class UpdateChatPrivacyCommandHandler : IRequestHandler<UpdateChatPrivacyCommand, UpdateChatPrivacyResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly IServerRepository _serverRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public UpdateChatPrivacyCommandHandler(
        IChatRepository chatRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository,
        IServerRepository serverRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _chatRepository = chatRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
        _serverRepository = serverRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<UpdateChatPrivacyResult> Handle(UpdateChatPrivacyCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new UpdateChatPrivacyResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            if (chat.ServerId != request.ServerId)
            {
                return new UpdateChatPrivacyResult { Success = false, ErrorMessage = "Чат не принадлежит указанному серверу" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageChannels", cancellationToken))
            {
                return new UpdateChatPrivacyResult { Success = false, ErrorMessage = "Недостаточно прав для управления каналами" };
            }

            var wasPrivate = chat.IsPrivate;
            var oldAllowedRoleIds = chat.AllowedRoleIds;

            if (wasPrivate == request.IsPrivate && request.IsPrivate)
            {
                chat.AllowedRoleIds = JsonSerializer.Serialize(request.AllowedRoleIds ?? new List<Guid>());
                await _chatRepository.UpdateAsync(chat, cancellationToken);

                var existingMembers = await _chatMemberRepository.GetByChatIdAsync(chat.Id, cancellationToken);
                if (oldAllowedRoleIds != chat.AllowedRoleIds)
                {
                    await _auditLog.LogAsync(
                        request.ServerId,
                        request.UserId,
                        AuditLogActionTypes.ChannelPrivacyUpdate,
                        AuditLogTargetTypes.Channel,
                        chat.Id,
                        new
                        {
                            targetName = chat.Name,
                            isPrivate = true,
                            detail = "Обновлён список доступа",
                        },
                        cancellationToken);
                }

                return new UpdateChatPrivacyResult
                {
                    Success = true,
                    Chat = BuildChatResult(chat, existingMembers)
                };
            }

            chat.IsPrivate = request.IsPrivate;
            if (request.IsPrivate)
            {
                chat.AllowedRoleIds = JsonSerializer.Serialize(request.AllowedRoleIds ?? new List<Guid>());
            }
            else
            {
                chat.AllowedRoleIds = null;
            }

            await _chatRepository.UpdateAsync(chat, cancellationToken);

            if (!request.IsPrivate)
            {
                var membersToRemove = await _chatMemberRepository.GetByChatIdAsync(chat.Id, cancellationToken);
                foreach (var member in membersToRemove)
                {
                    await _chatMemberRepository.DeleteAsync(member.Id, cancellationToken);
                }
            }
            else if (request.IsPrivate)
            {
                var memberUserIds = new List<Guid> { request.UserId };
                foreach (var uid in request.MemberIds ?? new List<Guid>())
                {
                    if (uid == request.UserId) continue;
                    var onServer = await _serverRepository.IsUserMemberAsync(request.ServerId, uid, cancellationToken);
                    if (onServer && !memberUserIds.Contains(uid))
                    {
                        memberUserIds.Add(uid);
                    }
                }

                var chatLoaded = await _chatRepository.GetByIdAsync(chat.Id, cancellationToken) ?? chat;
                var membersToAdd = new List<Member>();

                foreach (var uid in memberUserIds)
                {
                    if (await _chatMemberRepository.IsMemberAsync(chat.Id, uid, cancellationToken))
                    {
                        continue;
                    }

                    var appUser = await _userRepository.GetByIdAsync(uid, cancellationToken);
                    if (appUser == null) continue;

                    membersToAdd.Add(new Member
                    {
                        Id = Guid.NewGuid(),
                        ChatId = chat.Id,
                        UserId = uid,
                        JoinedAt = DateTimeOffset.UtcNow,
                        Chat = chatLoaded,
                        User = appUser
                    });
                }

                if (membersToAdd.Count > 0)
                {
                    await _chatMemberRepository.AddRangeAsync(membersToAdd, cancellationToken);
                }
            }

            if (wasPrivate != request.IsPrivate)
            {
                await _auditLog.LogAsync(
                    request.ServerId,
                    request.UserId,
                    AuditLogActionTypes.ChannelPrivacyUpdate,
                    AuditLogTargetTypes.Channel,
                    chat.Id,
                    new
                    {
                        targetName = chat.Name,
                        isPrivate = request.IsPrivate,
                        detail = request.IsPrivate ? "Сделан приватным" : "Сделан публичным",
                    },
                    cancellationToken);
            }

            var members = await _chatMemberRepository.GetByChatIdAsync(chat.Id, cancellationToken);
            return new UpdateChatPrivacyResult
            {
                Success = true,
                Chat = BuildChatResult(chat, members)
            };
        }
        catch (Exception ex)
        {
            return new UpdateChatPrivacyResult { Success = false, ErrorMessage = $"Ошибка при обновлении приватности канала: {ex.Message}" };
        }
    }

    private static object BuildChatResult(Chat chat, List<Member> members) => new
    {
        chatId = chat.Id,
        name = chat.Name,
        serverId = chat.ServerId,
        categoryId = chat.CategoryId,
        typeId = chat.TypeId,
        createdAt = chat.CreatedAt,
        isPrivate = chat.IsPrivate,
        chatOrder = chat.ChatOrder,
        allowedRoleIds = chat.AllowedRoleIds,
        members = members.Select(m => new { userId = m.UserId }).ToList()
    };
}


public class GetRolesQueryHandler : IRequestHandler<GetRolesQuery, GetRolesResult>
{
    private readonly IRoleRepository _roleRepository;

    public GetRolesQueryHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public async Task<GetRolesResult> Handle(GetRolesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var roles = await _roleRepository.GetByServerIdAsync(request.ServerId, cancellationToken);

            var mappedRoles = roles.Select(role => new
            {
                roleId = role.Id,
                serverId = role.ServerId,
                roleName = role.RoleName,
                color = role.Color,
                permissions = role.Permissions,
                createdAt = role.CreatedAt
            }).ToList();

            return new GetRolesResult { Success = true, Roles = mappedRoles };
        }
        catch (Exception ex)
        {
            return new GetRolesResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class CreateRoleCommandHandler : IRequestHandler<CreateRoleCommand, CreateRoleResult>
{
    private readonly IRoleRepository _roleRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public CreateRoleCommandHandler(
        IRoleRepository roleRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _roleRepository = roleRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<CreateRoleResult> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageRoles", cancellationToken))
            {
                return new CreateRoleResult { Success = false, ErrorMessage = "Недостаточно прав для управления ролями" };
            }

            var roleName = request.RoleName?.Trim();
            if (string.IsNullOrWhiteSpace(roleName))
            {
                return new CreateRoleResult { Success = false, ErrorMessage = "Название роли не может быть пустым" };
            }

            var exists = await _roleRepository.ExistsAsync(request.ServerId, roleName, cancellationToken);
            if (exists)
            {
                return new CreateRoleResult { Success = false, ErrorMessage = "Роль с таким названием уже существует" };
            }

            var createdRole = await _roleRepository.CreateAsync(new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = request.ServerId,
                RoleName = roleName,
                Color = request.Color,
                Permissions = request.Permissions ?? "{}",
                CreatedAt = DateTimeOffset.UtcNow
            }, cancellationToken);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.RoleCreate,
                AuditLogTargetTypes.Role,
                createdRole.Id,
                new { targetName = createdRole.RoleName, color = createdRole.Color },
                cancellationToken);

            return new CreateRoleResult
            {
                Success = true,
                Role = new
                {
                    roleId = createdRole.Id,
                    serverId = createdRole.ServerId,
                    roleName = createdRole.RoleName,
                    color = createdRole.Color,
                    permissions = createdRole.Permissions,
                    createdAt = createdRole.CreatedAt
                }
            };
        }
        catch (Exception ex)
        {
            return new CreateRoleResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class UpdateRoleCommandHandler : IRequestHandler<UpdateRoleCommand, UpdateRoleResult>
{
    private readonly IRoleRepository _roleRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public UpdateRoleCommandHandler(
        IRoleRepository roleRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _roleRepository = roleRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<UpdateRoleResult> Handle(UpdateRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var existingRole = await _roleRepository.GetByIdAsync(request.RoleId, cancellationToken);
            if (existingRole == null)
            {
                return new UpdateRoleResult { Success = false, ErrorMessage = "Роль не найдена" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    existingRole.ServerId, request.UserId, "manageRoles", cancellationToken))
            {
                return new UpdateRoleResult { Success = false, ErrorMessage = "Недостаточно прав для управления ролями" };
            }

            var roleName = request.RoleName?.Trim();
            if (string.IsNullOrWhiteSpace(roleName))
            {
                return new UpdateRoleResult { Success = false, ErrorMessage = "Название роли не может быть пустым" };
            }

            existingRole.RoleName = roleName;
            existingRole.Color = request.Color;
            existingRole.Permissions = request.Permissions ?? "{}";

            var updatedRole = await _roleRepository.UpdateAsync(existingRole, cancellationToken);

            var affectedUserIds = await _roleRepository.GetUserIdsByRoleAsync(request.RoleId, cancellationToken);
            var affectedUserPermissions = new List<AffectedUserPermissions>();
            foreach (var affectedUserId in affectedUserIds)
            {
                var mergedPermissions = await _permissionChecker.GetMergedPermissionsAsync(
                    updatedRole.ServerId,
                    affectedUserId,
                    cancellationToken);
                affectedUserPermissions.Add(new AffectedUserPermissions
                {
                    UserId = affectedUserId,
                    Permissions = mergedPermissions,
                });
            }

            await _auditLog.LogAsync(
                updatedRole.ServerId,
                request.UserId,
                AuditLogActionTypes.RoleUpdate,
                AuditLogTargetTypes.Role,
                updatedRole.Id,
                new { targetName = updatedRole.RoleName, color = updatedRole.Color },
                cancellationToken);

            return new UpdateRoleResult
            {
                Success = true,
                ServerId = updatedRole.ServerId,
                Role = new
                {
                    roleId = updatedRole.Id,
                    serverId = updatedRole.ServerId,
                    roleName = updatedRole.RoleName,
                    color = updatedRole.Color,
                    permissions = updatedRole.Permissions,
                    createdAt = updatedRole.CreatedAt
                },
                AffectedUserPermissions = affectedUserPermissions,
            };
        }
        catch (Exception ex)
        {
            return new UpdateRoleResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class DeleteRoleCommandHandler : IRequestHandler<DeleteRoleCommand, DeleteRoleResult>
{
    private readonly IRoleRepository _roleRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public DeleteRoleCommandHandler(
        IRoleRepository roleRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _roleRepository = roleRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<DeleteRoleResult> Handle(DeleteRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var existingRole = await _roleRepository.GetByIdAsync(request.RoleId, cancellationToken);
            if (existingRole == null)
            {
                return new DeleteRoleResult { Success = false, ErrorMessage = "Роль не найдена" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    existingRole.ServerId, request.UserId, "manageRoles", cancellationToken))
            {
                return new DeleteRoleResult { Success = false, ErrorMessage = "Недостаточно прав для управления ролями" };
            }

            await _roleRepository.DeleteAsync(request.RoleId, cancellationToken);

            await _auditLog.LogAsync(
                existingRole.ServerId,
                request.UserId,
                AuditLogActionTypes.RoleDelete,
                AuditLogTargetTypes.Role,
                existingRole.Id,
                new { targetName = existingRole.RoleName },
                cancellationToken);

            return new DeleteRoleResult { Success = true, ServerId = existingRole.ServerId };
        }
        catch (Exception ex)
        {
            return new DeleteRoleResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class GetServerMembersQueryHandler : IRequestHandler<GetServerMembersQuery, GetServerMembersResult>
{
    private readonly IServerMemberRepository _serverMemberRepository;

    public GetServerMembersQueryHandler(IServerMemberRepository serverMemberRepository)
    {
        _serverMemberRepository = serverMemberRepository;
    }

    public async Task<GetServerMembersResult> Handle(GetServerMembersQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var isMember = await _serverMemberRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken);
            if (!isMember)
            {
                return new GetServerMembersResult
                {
                    Success = false,
                    ErrorMessage = "Вы не являетесь участником этого сервера"
                };
            }

            var members = await _serverMemberRepository.GetServerMembersAsync(request.ServerId, cancellationToken);

            return new GetServerMembersResult
            {
                Success = true,
                Members = members
            };
        }
        catch (Exception ex)
        {
            return new GetServerMembersResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}

public class AssignRoleCommandHandler : IRequestHandler<AssignRoleCommand, AssignRoleResult>
{
    private readonly IRoleRepository _roleRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public AssignRoleCommandHandler(
        IRoleRepository roleRepository,
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository,
        IUserRepository userRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _roleRepository = roleRepository;
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
        _userRepository = userRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<AssignRoleResult> Handle(AssignRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var role = await _roleRepository.GetByIdAsync(request.RoleId, cancellationToken);
            if (role == null)
            {
                return new AssignRoleResult { Success = false, ErrorMessage = "Роль не найдена" };
            }

            var server = await _serverRepository.GetByIdAsync(role.ServerId, cancellationToken);
            if (server == null)
            {
                return new AssignRoleResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    role.ServerId, request.CurrentUserId, "manageRoles", cancellationToken))
            {
                return new AssignRoleResult { Success = false, ErrorMessage = "Недостаточно прав для назначения ролей" };
            }

            if (!await _serverMemberRepository.IsUserMemberAsync(role.ServerId, request.UserId, cancellationToken))
            {
                return new AssignRoleResult { Success = false, ErrorMessage = "Пользователь не является участником сервера" };
            }

            if (!await _roleRepository.UserHasRoleAsync(request.UserId, role.ServerId, request.RoleId, cancellationToken))
            {
                await _roleRepository.AssignRoleToUserAsync(request.UserId, request.RoleId, cancellationToken);

                var targetUser = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
                await _auditLog.LogAsync(
                    role.ServerId,
                    request.CurrentUserId,
                    AuditLogActionTypes.MemberRoleAdd,
                    AuditLogTargetTypes.Member,
                    request.UserId,
                    new
                    {
                        targetName = targetUser?.UserName ?? request.UserId.ToString(),
                        detail = role.RoleName,
                    },
                    cancellationToken);
            }

            var targetPermissions = await _permissionChecker.GetMergedPermissionsAsync(
                role.ServerId,
                request.UserId,
                cancellationToken);

            return new AssignRoleResult
            {
                Success = true,
                ServerId = role.ServerId,
                TargetUserPermissions = targetPermissions,
                Role = new
                {
                    roleId = role.Id,
                    roleName = role.RoleName,
                    color = role.Color,
                },
            };
        }
        catch (Exception ex)
        {
            return new AssignRoleResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class RemoveRoleCommandHandler : IRequestHandler<RemoveRoleCommand, RemoveRoleResult>
{
    private readonly IRoleRepository _roleRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IUserRepository _userRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public RemoveRoleCommandHandler(
        IRoleRepository roleRepository,
        IServerRepository serverRepository,
        IUserRepository userRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _roleRepository = roleRepository;
        _serverRepository = serverRepository;
        _userRepository = userRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<RemoveRoleResult> Handle(RemoveRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var role = await _roleRepository.GetByIdAsync(request.RoleId, cancellationToken);
            if (role == null)
            {
                return new RemoveRoleResult { Success = false, ErrorMessage = "Роль не найдена" };
            }

            var server = await _serverRepository.GetByIdAsync(role.ServerId, cancellationToken);
            if (server == null)
            {
                return new RemoveRoleResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    role.ServerId, request.CurrentUserId, "manageRoles", cancellationToken))
            {
                return new RemoveRoleResult { Success = false, ErrorMessage = "Недостаточно прав для управления ролями" };
            }

            await _roleRepository.RemoveRoleFromUserAsync(request.UserId, request.RoleId, cancellationToken);

            var targetUser = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
            await _auditLog.LogAsync(
                role.ServerId,
                request.CurrentUserId,
                AuditLogActionTypes.MemberRoleRemove,
                AuditLogTargetTypes.Member,
                request.UserId,
                new
                {
                    targetName = targetUser?.UserName ?? request.UserId.ToString(),
                    detail = role.RoleName,
                },
                cancellationToken);

            var remainingRoles = await _roleRepository.GetUserRolesAsync(
                request.UserId,
                role.ServerId,
                cancellationToken);

            var mergedPermissions = await _permissionChecker.GetMergedPermissionsAsync(
                role.ServerId,
                request.UserId,
                cancellationToken);

            return new RemoveRoleResult
            {
                Success = true,
                ServerId = role.ServerId,
                RemainingRoles = remainingRoles
                    .Select(r => new
                    {
                        roleId = r.Id,
                        roleName = r.RoleName,
                        color = r.Color,
                    })
                    .ToList(),
                MergedPermissions = mergedPermissions,
            };
        }
        catch (Exception ex)
        {
            return new RemoveRoleResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class KickMemberCommandHandler : IRequestHandler<KickMemberCommand, KickMemberResult>
{
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IUserRepository _userRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public KickMemberCommandHandler(
        IServerMemberRepository serverMemberRepository,
        IServerRepository serverRepository,
        IUserRepository userRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _serverMemberRepository = serverMemberRepository;
        _serverRepository = serverRepository;
        _userRepository = userRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<KickMemberResult> Handle(KickMemberCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new KickMemberResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (server.OwnerId == request.UserId)
            {
                return new KickMemberResult { Success = false, ErrorMessage = "Нельзя исключить владельца сервера" };
            }

            if (request.UserId == request.CurrentUserId)
            {
                return new KickMemberResult { Success = false, ErrorMessage = "Нельзя исключить самого себя" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.CurrentUserId, "kickMembers", cancellationToken))
            {
                return new KickMemberResult { Success = false, ErrorMessage = "Недостаточно прав для исключения участников" };
            }

            if (!await _serverMemberRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken))
            {
                return new KickMemberResult { Success = false, ErrorMessage = "Пользователь не является участником сервера" };
            }

            await _serverMemberRepository.DeleteByServerAndUserAsync(
                request.ServerId, request.UserId, cancellationToken);

            var kickedUser = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
            await _auditLog.LogAsync(
                request.ServerId,
                request.CurrentUserId,
                AuditLogActionTypes.MemberKick,
                AuditLogTargetTypes.Member,
                request.UserId,
                new { targetName = kickedUser?.UserName ?? request.UserId.ToString() },
                cancellationToken);

            return new KickMemberResult { Success = true };
        }
        catch (Exception ex)
        {
            return new KickMemberResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class GetUserRolesQueryHandler : IRequestHandler<GetUserRolesQuery, GetUserRolesResult>
{
    private readonly IRoleRepository _roleRepository;

    public GetUserRolesQueryHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public async Task<GetUserRolesResult> Handle(GetUserRolesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var roles = await _roleRepository.GetUserRolesAsync(
                request.UserId,
                request.ServerId,
                cancellationToken);

            var mappedRoles = roles
                .Select(role => new
                {
                    roleId = role.Id,
                    roleName = role.RoleName,
                    color = role.Color,
                    permissions = role.Permissions,
                })
                .ToList<object>();

            return new GetUserRolesResult { Success = true, Roles = mappedRoles };
        }
        catch (Exception ex)
        {
            return new GetUserRolesResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class UpdateServerNameCommandHandler : IRequestHandler<UpdateServerNameCommand, UpdateServerNameResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public UpdateServerNameCommandHandler(
        IServerRepository serverRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _serverRepository = serverRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<UpdateServerNameResult> Handle(UpdateServerNameCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId);
            if (server == null)
            {
                return new UpdateServerNameResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageServer", cancellationToken))
            {
                return new UpdateServerNameResult { Success = false, ErrorMessage = "Недостаточно прав для управления сервером" };
            }

            server.Name = request.NewName;
            await _serverRepository.UpdateAsync(server);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.ServerUpdate,
                AuditLogTargetTypes.Server,
                request.ServerId,
                new { targetName = server.Name, field = "name" },
                cancellationToken);

            return new UpdateServerNameResult { Success = true };
        }
        catch (Exception ex)
        {
            return new UpdateServerNameResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class UpdateServerDescriptionCommandHandler : IRequestHandler<UpdateServerDescriptionCommand, UpdateServerDescriptionResult>
{
    private const int MaxDescriptionLength = 500;
    private readonly IServerRepository _serverRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public UpdateServerDescriptionCommandHandler(
        IServerRepository serverRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _serverRepository = serverRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<UpdateServerDescriptionResult> Handle(UpdateServerDescriptionCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId);
            if (server == null)
            {
                return new UpdateServerDescriptionResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageServer", cancellationToken))
            {
                return new UpdateServerDescriptionResult { Success = false, ErrorMessage = "Недостаточно прав для управления сервером" };
            }

            var description = request.Description?.Trim();
            if (string.IsNullOrEmpty(description))
            {
                description = null;
            }
            else if (description.Length > MaxDescriptionLength)
            {
                return new UpdateServerDescriptionResult
                {
                    Success = false,
                    ErrorMessage = $"Описание не должно превышать {MaxDescriptionLength} символов",
                };
            }

            server.Description = description;
            await _serverRepository.UpdateAsync(server);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.ServerUpdate,
                AuditLogTargetTypes.Server,
                request.ServerId,
                new { targetName = server.Name, field = "description" },
                cancellationToken);

            return new UpdateServerDescriptionResult { Success = true };
        }
        catch (Exception ex)
        {
            return new UpdateServerDescriptionResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class UpdateServerPrivacyCommandHandler : IRequestHandler<UpdateServerPrivacyCommand, UpdateServerPrivacyResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public UpdateServerPrivacyCommandHandler(
        IServerRepository serverRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _serverRepository = serverRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<UpdateServerPrivacyResult> Handle(UpdateServerPrivacyCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new UpdateServerPrivacyResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageServer", cancellationToken))
            {
                return new UpdateServerPrivacyResult { Success = false, ErrorMessage = "Недостаточно прав для управления сервером" };
            }

            if (server.IsPublic == request.IsPublic)
            {
                return new UpdateServerPrivacyResult { Success = true };
            }

            server.IsPublic = request.IsPublic;
            await _serverRepository.UpdateAsync(server, cancellationToken);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.ServerPrivacyUpdate,
                AuditLogTargetTypes.Server,
                request.ServerId,
                new
                {
                    targetName = server.Name,
                    isPublic = request.IsPublic,
                    detail = request.IsPublic ? "Сделан публичным" : "Сделан приватным",
                },
                cancellationToken);

            return new UpdateServerPrivacyResult { Success = true };
        }
        catch (Exception ex)
        {
            return new UpdateServerPrivacyResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class GetServerInfoQueryHandler : IRequestHandler<GetServerInfoQuery, GetServerInfoResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public GetServerInfoQueryHandler(IServerRepository serverRepository, ServerPermissionChecker permissionChecker)
    {
        _serverRepository = serverRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<GetServerInfoResult> Handle(GetServerInfoQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId);
            if (server == null)
            {
                return new GetServerInfoResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (!await _serverRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken))
            {
                return new GetServerInfoResult { Success = false, ErrorMessage = "У вас нет доступа к этому серверу" };
            }

            var permissions = await _permissionChecker.GetMergedPermissionsAsync(
                request.ServerId,
                request.UserId,
                cancellationToken);

            var serverInfo = new
            {
                serverId = server.Id,
                name = server.Name,
                ownerId = server.OwnerId,
                createdAt = server.CreatedAt,
                isPublic = server.IsPublic,
                description = server.Description,
                avatar = server.Avatar,
                banner = server.Banner,
                bannerColor = server.BannerColor,
                permissions,
            };

            return new GetServerInfoResult { Success = true, ServerInfo = serverInfo };
        }
        catch (Exception ex)
        {
            return new GetServerInfoResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class GetAuditLogQueryHandler : IRequestHandler<GetAuditLogQuery, GetAuditLogResult>
{
    private readonly IAuditLogRepository _auditLogRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public GetAuditLogQueryHandler(
        IAuditLogRepository auditLogRepository,
        ServerPermissionChecker permissionChecker)
    {
        _auditLogRepository = auditLogRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<GetAuditLogResult> Handle(GetAuditLogQuery request, CancellationToken cancellationToken)
    {
        try
        {
            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageServer", cancellationToken))
            {
                return new GetAuditLogResult
                {
                    Success = false,
                    ErrorMessage = "Недостаточно прав для просмотра журнала аудита",
                };
            }

            var (items, totalCount) = await _auditLogRepository.GetByServerIdAsync(
                request.ServerId,
                request.Page,
                request.PageSize,
                cancellationToken);

            var entries = items.Select(item =>
            {
                object? changes = null;
                string? targetName = null;
                string? detail = null;

                if (!string.IsNullOrWhiteSpace(item.Changes))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(item.Changes);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("targetName", out var targetNameEl) && targetNameEl.ValueKind == JsonValueKind.String)
                        {
                            targetName = targetNameEl.GetString();
                        }
                        else if (root.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
                        {
                            targetName = nameEl.GetString();
                        }

                        if (root.TryGetProperty("detail", out var detailEl) && detailEl.ValueKind == JsonValueKind.String)
                        {
                            detail = detailEl.GetString();
                        }

                        changes = JsonSerializer.Deserialize<object>(item.Changes);
                    }
                    catch
                    {
                        changes = item.Changes;
                    }
                }

                return new
                {
                    id = item.Id,
                    actionType = item.ActionType,
                    actionLabel = AuditLogLabels.Get(item.ActionType),
                    targetType = item.TargetType,
                    targetId = item.TargetId,
                    targetName,
                    detail,
                    changes,
                    userId = item.UserId,
                    username = item.User?.UserName ?? "Unknown",
                    avatar = item.User?.UserProfile?.Avatar,
                    avatarColor = item.User?.UserProfile?.AvatarColor,
                    createdAt = item.CreatedAt,
                };
            }).ToList<object>();

            return new GetAuditLogResult
            {
                Success = true,
                AuditLogs = new
                {
                    entries,
                    totalCount,
                    page = Math.Max(1, request.Page),
                    pageSize = Math.Clamp(request.PageSize, 1, 100),
                },
            };
        }
        catch (Exception ex)
        {
            return new GetAuditLogResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class AddMemberToChannelCommandHandler : IRequestHandler<AddMemberToChannelCommand, AddMemberToChannelResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IServerAuditLogService _auditLog;

    public AddMemberToChannelCommandHandler(
        IChatRepository chatRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository,
        IServerRepository serverRepository,
        IServerAuditLogService auditLog)
    {
        _chatRepository = chatRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
        _serverRepository = serverRepository;
        _auditLog = auditLog;
    }

    public async Task<AddMemberToChannelResult> Handle(AddMemberToChannelCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null || chat.ServerId != request.ServerId)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Канал не найден" };
            }
            if (!chat.IsPrivate)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Канал не является приватным" };
            }

            var currentUserIsMember = await _serverRepository.IsUserMemberAsync(request.ServerId, request.CurrentUserId, cancellationToken);
            if (!currentUserIsMember)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Вы не являетесь участником сервера" };
            }
            var currentUserInChannel = await _chatMemberRepository.IsMemberAsync(request.ChatId, request.CurrentUserId, cancellationToken);
            if (!currentUserInChannel)
            {
                var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
                if (server == null || server.OwnerId != request.CurrentUserId)
                {
                    return new AddMemberToChannelResult { Success = false, ErrorMessage = "Нет прав для добавления в этот канал" };
                }
            }

            var userToAddIsOnServer = await _serverRepository.IsUserMemberAsync(request.ServerId, request.UserIdToAdd, cancellationToken);
            if (!userToAddIsOnServer)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Пользователь не является участником сервера" };
            }
            var alreadyInChannel = await _chatMemberRepository.IsMemberAsync(request.ChatId, request.UserIdToAdd, cancellationToken);
            if (alreadyInChannel)
            {
                return new AddMemberToChannelResult { Success = true };
            }

            var appUser = await _userRepository.GetByIdAsync(request.UserIdToAdd, cancellationToken);
            if (appUser == null)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Пользователь не найден" };
            }

            await _chatMemberRepository.CreateAsync(new Member
            {
                Id = Guid.NewGuid(),
                ChatId = request.ChatId,
                UserId = request.UserIdToAdd,
                JoinedAt = DateTimeOffset.UtcNow,
                Chat = chat,
                User = appUser
            }, cancellationToken);

            await _auditLog.LogAsync(
                request.ServerId,
                request.CurrentUserId,
                AuditLogActionTypes.ChannelMemberAdd,
                AuditLogTargetTypes.Channel,
                request.ChatId,
                new
                {
                    targetName = chat.Name,
                    detail = appUser.UserName,
                    memberId = request.UserIdToAdd,
                },
                cancellationToken);

            return new AddMemberToChannelResult { Success = true };
        }
        catch (Exception ex)
        {
            return new AddMemberToChannelResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class RemoveMemberFromChannelCommandHandler : IRequestHandler<RemoveMemberFromChannelCommand, RemoveMemberFromChannelResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IUserRepository _userRepository;
    private readonly IServerAuditLogService _auditLog;

    public RemoveMemberFromChannelCommandHandler(
        IChatRepository chatRepository,
        IChatMemberRepository chatMemberRepository,
        IServerRepository serverRepository,
        IUserRepository userRepository,
        IServerAuditLogService auditLog)
    {
        _chatRepository = chatRepository;
        _chatMemberRepository = chatMemberRepository;
        _serverRepository = serverRepository;
        _userRepository = userRepository;
        _auditLog = auditLog;
    }

    public async Task<RemoveMemberFromChannelResult> Handle(RemoveMemberFromChannelCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null || chat.ServerId != request.ServerId)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Канал не найден" };
            }
            if (!chat.IsPrivate)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Канал не является приватным" };
            }

            var currentUserIsMember = await _serverRepository.IsUserMemberAsync(request.ServerId, request.CurrentUserId, cancellationToken);
            if (!currentUserIsMember)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Вы не являетесь участником сервера" };
            }

            if (request.UserIdToRemove == request.CurrentUserId)
            {
                var channelMembers = await _chatMemberRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
                var member = channelMembers.FirstOrDefault(m => m.UserId == request.CurrentUserId);
                if (member != null)
                {
                    await _chatMemberRepository.DeleteAsync(member.Id, cancellationToken);
                    var selfUser = await _userRepository.GetByIdAsync(request.CurrentUserId, cancellationToken);
                    await _auditLog.LogAsync(
                        request.ServerId,
                        request.CurrentUserId,
                        AuditLogActionTypes.ChannelMemberRemove,
                        AuditLogTargetTypes.Channel,
                        request.ChatId,
                        new { targetName = chat.Name, detail = selfUser?.UserName, memberId = request.CurrentUserId },
                        cancellationToken);
                }
                return new RemoveMemberFromChannelResult { Success = true };
            }

            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            var currentUserInChannel = await _chatMemberRepository.IsMemberAsync(request.ChatId, request.CurrentUserId, cancellationToken);
            if (server?.OwnerId != request.CurrentUserId && !currentUserInChannel)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Нет прав для удаления из канала" };
            }

            var channelMembersToRemove = await _chatMemberRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
            var toRemove = channelMembersToRemove.FirstOrDefault(m => m.UserId == request.UserIdToRemove);
            if (toRemove == null)
            {
                return new RemoveMemberFromChannelResult { Success = true };
            }
            await _chatMemberRepository.DeleteAsync(toRemove.Id, cancellationToken);

            var removedUser = await _userRepository.GetByIdAsync(request.UserIdToRemove, cancellationToken);
            await _auditLog.LogAsync(
                request.ServerId,
                request.CurrentUserId,
                AuditLogActionTypes.ChannelMemberRemove,
                AuditLogTargetTypes.Channel,
                request.ChatId,
                new
                {
                    targetName = chat.Name,
                    detail = removedUser?.UserName,
                    memberId = request.UserIdToRemove,
                },
                cancellationToken);

            return new RemoveMemberFromChannelResult { Success = true };
        }
        catch (Exception ex)
        {
            return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}
