using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class DeleteCategoryCommand : IRequest<DeleteCategoryResult>
{
    public Guid ServerId { get; set; }
    public Guid CategoryId { get; set; }
    public Guid UserId { get; set; }

    public DeleteCategoryCommand(Guid serverId, Guid categoryId, Guid userId)
    {
        ServerId = serverId;
        CategoryId = categoryId;
        UserId = userId;
    }
}

public class DeleteCategoryResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}


public class CreateChatCommand : IRequest<CreateChatResult>
{
    public Guid ServerId { get; set; }
    public Guid? CategoryId { get; set; }
    public string ChatName { get; set; }
    public int ChatType { get; set; }
    public Guid UserId { get; set; }
    /// <summary>Приватный канал — видят только добавленные участники.</summary>
    public bool IsPrivate { get; set; }
    /// <summary>Идентификаторы пользователей с доступом (только для приватного канала). Создатель добавляется автоматически.</summary>
    public List<Guid>? MemberIds { get; set; }

    public CreateChatCommand(Guid serverId, Guid? categoryId, string chatName, int chatType, Guid userId, bool isPrivate = false, List<Guid>? memberIds = null)
    {
        ServerId = serverId;
        CategoryId = categoryId;
        ChatName = chatName;
        ChatType = chatType;
        UserId = userId;
        IsPrivate = isPrivate;
        MemberIds = memberIds ?? new List<Guid>();
    }
}

public class CreateChatResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Chat { get; set; }
    /// <summary>Для приватного канала — кому отправить ChatCreated (только эти пользователи). Иначе null — рассылать всей группе сервера.</summary>
    public List<Guid>? NotifyUserIds { get; set; }
}

public class UpdateChatNameCommand : IRequest<UpdateChatNameResult>
{
    public Guid ServerId { get; set; }
    public Guid ChatId { get; set; }
    public string NewName { get; set; }
    public Guid UserId { get; set; }

    public UpdateChatNameCommand(Guid serverId, Guid chatId, string newName, Guid userId)
    {
        ServerId = serverId;
        ChatId = chatId;
        NewName = newName;
        UserId = userId;
    }
}

public class UpdateChatNameResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Chat { get; set; }
}

public class DeleteChatCommand : IRequest<DeleteChatResult>
{
    public Guid ServerId { get; set; }
    public Guid ChatId { get; set; }
    public Guid UserId { get; set; }

    public DeleteChatCommand(Guid serverId, Guid chatId, Guid userId)
    {
        ServerId = serverId;
        ChatId = chatId;
        UserId = userId;
    }
}

public class DeleteChatResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? CategoryId { get; set; }
}

public class GetRolesQuery : IRequest<GetRolesResult>
{
    public Guid ServerId { get; set; }
    public Guid UserId { get; set; }

    public GetRolesQuery(Guid serverId, Guid userId)
    {
        ServerId = serverId;
        UserId = userId;
    }
}

public class GetRolesResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Roles { get; set; }
}

public class CreateRoleCommand : IRequest<CreateRoleResult>
{
    public Guid ServerId { get; set; }
    public string RoleName { get; set; }
    public string Color { get; set; }
    public string Permissions { get; set; }
    public Guid UserId { get; set; }

    public CreateRoleCommand(Guid serverId, string roleName, string color, string permissions, Guid userId)
    {
        ServerId = serverId;
        RoleName = roleName;
        Color = color;
        Permissions = permissions;
        UserId = userId;
    }
}

public class CreateRoleResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Role { get; set; }
}

public class UpdateRoleCommand : IRequest<UpdateRoleResult>
{
    public Guid RoleId { get; set; }
    public string RoleName { get; set; }
    public string Color { get; set; }
    public string Permissions { get; set; }
    public Guid UserId { get; set; }

    public UpdateRoleCommand(Guid roleId, string roleName, string color, string permissions, Guid userId)
    {
        RoleId = roleId;
        RoleName = roleName;
        Color = color;
        Permissions = permissions;
        UserId = userId;
    }
}

public class UpdateRoleResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Role { get; set; }
    public Guid ServerId { get; set; }
}

public class DeleteRoleCommand : IRequest<DeleteRoleResult>
{
    public Guid RoleId { get; set; }
    public Guid UserId { get; set; }

    public DeleteRoleCommand(Guid roleId, Guid userId)
    {
        RoleId = roleId;
        UserId = userId;
    }
}

public class DeleteRoleResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid ServerId { get; set; }
}

public class GetServerMembersQuery : IRequest<GetServerMembersResult>
{
    public Guid ServerId { get; set; }
    public Guid UserId { get; set; }

    public GetServerMembersQuery(Guid serverId, Guid userId)
    {
        ServerId = serverId;
        UserId = userId;
    }
}

public class GetServerMembersResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<ServerMemberInfo>? Members { get; set; }
}

public class AssignRoleCommand : IRequest<AssignRoleResult>
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public Guid CurrentUserId { get; set; }

    public AssignRoleCommand(Guid userId, Guid roleId, Guid currentUserId)
    {
        UserId = userId;
        RoleId = roleId;
        CurrentUserId = currentUserId;
    }
}

public class AssignRoleResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Role { get; set; }
    public Guid ServerId { get; set; }
}

public class RemoveRoleCommand : IRequest<RemoveRoleResult>
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public Guid CurrentUserId { get; set; }

    public RemoveRoleCommand(Guid userId, Guid roleId, Guid currentUserId)
    {
        UserId = userId;
        RoleId = roleId;
        CurrentUserId = currentUserId;
    }
}

public class RemoveRoleResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? RemainingRoles { get; set; }
    public object? MergedPermissions { get; set; }
    public Guid ServerId { get; set; }
}

public class KickMemberCommand : IRequest<KickMemberResult>
{
    public Guid ServerId { get; set; }
    public Guid UserId { get; set; }
    public Guid CurrentUserId { get; set; }

    public KickMemberCommand(Guid serverId, Guid userId, Guid currentUserId)
    {
        ServerId = serverId;
        UserId = userId;
        CurrentUserId = currentUserId;
    }
}

public class KickMemberResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}

public class GetUserRolesQuery : IRequest<GetUserRolesResult>
{
    public Guid UserId { get; set; }
    public Guid ServerId { get; set; }
    public Guid CurrentUserId { get; set; }

    public GetUserRolesQuery(Guid userId, Guid serverId, Guid currentUserId)
    {
        UserId = userId;
        ServerId = serverId;
        CurrentUserId = currentUserId;
    }
}

public class GetUserRolesResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Roles { get; set; }
}

public class UpdateServerNameCommand : IRequest<UpdateServerNameResult>
{
    public Guid ServerId { get; set; }
    public string NewName { get; set; }
    public Guid UserId { get; set; }

    public UpdateServerNameCommand(Guid serverId, string newName, Guid userId)
    {
        ServerId = serverId;
        NewName = newName;
        UserId = userId;
    }
}

public class UpdateServerNameResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}

public class GetServerInfoQuery : IRequest<GetServerInfoResult>
{
    public Guid ServerId { get; set; }
    public Guid UserId { get; set; }

    public GetServerInfoQuery(Guid serverId, Guid userId)
    {
        ServerId = serverId;
        UserId = userId;
    }
}

public class GetServerInfoResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? ServerInfo { get; set; }
}

public class GetAuditLogQuery : IRequest<GetAuditLogResult>
{
    public Guid ServerId { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public Guid UserId { get; set; }

    public GetAuditLogQuery(Guid serverId, int page, int pageSize, Guid userId)
    {
        ServerId = serverId;
        Page = page;
        PageSize = pageSize;
        UserId = userId;
    }
}

public class GetAuditLogResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? AuditLogs { get; set; }
}

/// <summary>Добавить участника в приватный канал сервера.</summary>
public class AddMemberToChannelCommand : IRequest<AddMemberToChannelResult>
{
    public Guid ServerId { get; set; }
    public Guid ChatId { get; set; }
    public Guid UserIdToAdd { get; set; }
    public Guid CurrentUserId { get; set; }

    public AddMemberToChannelCommand(Guid serverId, Guid chatId, Guid userIdToAdd, Guid currentUserId)
    {
        ServerId = serverId;
        ChatId = chatId;
        UserIdToAdd = userIdToAdd;
        CurrentUserId = currentUserId;
    }
}

public class AddMemberToChannelResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>Убрать участника из приватного канала.</summary>
public class RemoveMemberFromChannelCommand : IRequest<RemoveMemberFromChannelResult>
{
    public Guid ServerId { get; set; }
    public Guid ChatId { get; set; }
    public Guid UserIdToRemove { get; set; }
    public Guid CurrentUserId { get; set; }

    public RemoveMemberFromChannelCommand(Guid serverId, Guid chatId, Guid userIdToRemove, Guid currentUserId)
    {
        ServerId = serverId;
        ChatId = chatId;
        UserIdToRemove = userIdToRemove;
        CurrentUserId = currentUserId;
    }
}

public class RemoveMemberFromChannelResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}
