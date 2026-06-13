namespace WhithinMessenger.Application.Services;

public interface IServerAuditLogService
{
    Task LogAsync(
        Guid serverId,
        Guid actorUserId,
        string actionType,
        string targetType,
        Guid? targetId = null,
        object? changes = null,
        CancellationToken cancellationToken = default);
}
