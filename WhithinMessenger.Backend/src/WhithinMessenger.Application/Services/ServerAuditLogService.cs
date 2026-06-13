using System.Text.Json;
using Microsoft.Extensions.Logging;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public class ServerAuditLogService : IServerAuditLogService
{
    private readonly IAuditLogRepository _auditLogRepository;
    private readonly ILogger<ServerAuditLogService> _logger;

    public ServerAuditLogService(IAuditLogRepository auditLogRepository, ILogger<ServerAuditLogService> logger)
    {
        _auditLogRepository = auditLogRepository;
        _logger = logger;
    }

    public async Task LogAsync(
        Guid serverId,
        Guid actorUserId,
        string actionType,
        string targetType,
        Guid? targetId = null,
        object? changes = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                UserId = actorUserId,
                ActionType = actionType,
                TargetType = targetType,
                TargetId = targetId,
                Changes = changes == null ? null : JsonSerializer.Serialize(changes),
                CreatedAt = DateTimeOffset.UtcNow,
            };

            await _auditLogRepository.CreateAsync(auditLog, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write audit log {ActionType} for server {ServerId}", actionType, serverId);
        }
    }
}
