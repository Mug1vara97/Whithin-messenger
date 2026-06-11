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
}
