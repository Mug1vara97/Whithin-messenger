using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IAuditLogRepository
{
    Task<AuditLog> CreateAsync(AuditLog auditLog, CancellationToken cancellationToken = default);

    Task<(List<AuditLog> Items, int TotalCount)> GetByServerIdAsync(
        Guid serverId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
