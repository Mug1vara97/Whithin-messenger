using WhithinMessenger.Application.CommandsAndQueries.Servers;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public class ServerPermissionChecker
{
    public static readonly string[] AllPermissionKeys =
    [
        "viewChannels",
        "manageChannels",
        "manageRoles",
        "manageServer",
        "createInvites",
        "changeOwnNickname",
        "manageNicknames",
        "kickMembers",
        "muteMembers",
        "banMembers",
        "sendMessages",
        "attachFiles",
        "mentionEveryone",
        "manageMessages",
        "sendVoiceMessages",
    ];

    public static readonly string[] DefaultMemberPermissions =
    [
        "viewChannels",
        "sendMessages",
        "attachFiles",
        "changeOwnNickname",
    ];

    private readonly IRoleRepository _roleRepository;
    private readonly IServerRepository _serverRepository;

    public ServerPermissionChecker(IRoleRepository roleRepository, IServerRepository serverRepository)
    {
        _roleRepository = roleRepository;
        _serverRepository = serverRepository;
    }

    public async Task<Server?> GetServerAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _serverRepository.GetByIdAsync(serverId, cancellationToken);
    }

    public async Task<bool> IsOwnerAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        var server = await GetServerAsync(serverId, cancellationToken);
        return server != null && server.OwnerId == userId;
    }

    public async Task<bool> HasPermissionAsync(
        Guid serverId,
        Guid userId,
        string permission,
        CancellationToken cancellationToken = default)
    {
        var server = await GetServerAsync(serverId, cancellationToken);
        if (server == null)
        {
            return false;
        }

        if (server.OwnerId == userId)
        {
            return true;
        }

        var roles = await _roleRepository.GetUserRolesAsync(userId, serverId, cancellationToken);
        if (roles.Any(role => ServerPermissionHelper.RoleGrantsPermission(role.Permissions, permission)))
        {
            return true;
        }

        return DefaultMemberPermissions.Contains(permission);
    }

    public async Task<Dictionary<string, bool>> GetMergedPermissionsAsync(
        Guid serverId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var server = await GetServerAsync(serverId, cancellationToken);
        if (server == null)
        {
            return new Dictionary<string, bool>();
        }

        if (server.OwnerId == userId)
        {
            return AllPermissionKeys.ToDictionary(key => key, _ => true);
        }

        var roles = await _roleRepository.GetUserRolesAsync(userId, serverId, cancellationToken);
        var merged = ServerPermissionHelper.MergePermissions(roles);

        foreach (var permission in DefaultMemberPermissions)
        {
            merged.TryAdd(permission, true);
        }

        return merged;
    }

    public static bool IsAudioContentType(string contentType) =>
        contentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase);

    public async Task<(bool Allowed, string? ErrorMessage)> ValidateMediaUploadAsync(
        Guid? serverId,
        Guid userId,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        if (!serverId.HasValue)
        {
            return (true, null);
        }

        if (!await HasPermissionAsync(serverId.Value, userId, "sendMessages", cancellationToken))
        {
            return (false, "Недостаточно прав для отправки сообщений");
        }

        var attachmentPermission = IsAudioContentType(contentType) ? "sendVoiceMessages" : "attachFiles";
        if (!await HasPermissionAsync(serverId.Value, userId, attachmentPermission, cancellationToken))
        {
            return attachmentPermission == "sendVoiceMessages"
                ? (false, "Недостаточно прав для отправки голосовых сообщений")
                : (false, "Недостаточно прав для прикрепления файлов");
        }

        return (true, null);
    }

    public async Task<(bool Allowed, string? ErrorMessage)> ValidateMessageModerationAsync(
        Guid? serverId,
        Guid actorUserId,
        Guid messageAuthorId,
        CancellationToken cancellationToken = default)
    {
        if (actorUserId == messageAuthorId)
        {
            return (true, null);
        }

        if (!serverId.HasValue)
        {
            return (false, "User not authorized to modify this message");
        }

        if (!await HasPermissionAsync(serverId.Value, actorUserId, "manageMessages", cancellationToken))
        {
            return (false, "Недостаточно прав для управления сообщениями");
        }

        return (true, null);
    }
}
