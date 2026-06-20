namespace WhithinMessenger.Application.Services;

public static class AuditLogActionTypes
{
    public const string ChannelCreate = "channel_create";
    public const string ChannelUpdate = "channel_update";
    public const string ChannelPrivacyUpdate = "channel_privacy_update";
    public const string ChannelDelete = "channel_delete";
    public const string ChannelMove = "channel_move";

    public const string CategoryCreate = "category_create";
    public const string CategoryUpdate = "category_update";
    public const string CategoryPrivacyUpdate = "category_privacy_update";
    public const string CategoryDelete = "category_delete";
    public const string CategoryMove = "category_move";

    public const string ChannelMemberAdd = "channel_member_add";
    public const string ChannelMemberRemove = "channel_member_remove";

    public const string RoleCreate = "role_create";
    public const string RoleUpdate = "role_update";
    public const string RoleDelete = "role_delete";

    public const string MemberRoleAdd = "member_role_add";
    public const string MemberRoleRemove = "member_role_remove";

    public const string MemberKick = "member_kick";
    public const string MemberAdd = "member_add";
    public const string MemberNicknameUpdate = "member_nickname_update";

    public const string ServerUpdate = "server_update";
    public const string ServerPrivacyUpdate = "server_privacy_update";
    public const string MessageDelete = "message_delete";
}

public static class AuditLogTargetTypes
{
    public const string Channel = "channel";
    public const string Category = "category";
    public const string Role = "role";
    public const string Member = "member";
    public const string Server = "server";
    public const string Message = "message";
}

public static class AuditLogLabels
{
    private static readonly Dictionary<string, string> Labels = new(StringComparer.Ordinal)
    {
        [AuditLogActionTypes.ChannelCreate] = "Создание канала",
        [AuditLogActionTypes.ChannelUpdate] = "Обновление канала",
        [AuditLogActionTypes.ChannelPrivacyUpdate] = "Изменение приватности канала",
        [AuditLogActionTypes.ChannelDelete] = "Удаление канала",
        [AuditLogActionTypes.ChannelMove] = "Перемещение канала",
        [AuditLogActionTypes.CategoryCreate] = "Создание категории",
        [AuditLogActionTypes.CategoryUpdate] = "Обновление категории",
        [AuditLogActionTypes.CategoryPrivacyUpdate] = "Изменение приватности категории",
        [AuditLogActionTypes.CategoryDelete] = "Удаление категории",
        [AuditLogActionTypes.CategoryMove] = "Перемещение категории",
        [AuditLogActionTypes.ChannelMemberAdd] = "Доступ к каналу выдан",
        [AuditLogActionTypes.ChannelMemberRemove] = "Доступ к каналу снят",
        [AuditLogActionTypes.RoleCreate] = "Создание роли",
        [AuditLogActionTypes.RoleUpdate] = "Обновление роли",
        [AuditLogActionTypes.RoleDelete] = "Удаление роли",
        [AuditLogActionTypes.MemberRoleAdd] = "Роль выдана участнику",
        [AuditLogActionTypes.MemberRoleRemove] = "Роль снята с участника",
        [AuditLogActionTypes.MemberKick] = "Участник исключён",
        [AuditLogActionTypes.MemberAdd] = "Участник добавлен",
        [AuditLogActionTypes.MemberNicknameUpdate] = "Изменён серверный ник",
        [AuditLogActionTypes.ServerUpdate] = "Обновление сервера",
        [AuditLogActionTypes.ServerPrivacyUpdate] = "Изменение приватности сервера",
        [AuditLogActionTypes.MessageDelete] = "Удаление сообщения",
    };

    public static string Get(string actionType)
        => Labels.TryGetValue(actionType, out var label) ? label : actionType;
}
