using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IServerEventRepository
{
    Task<List<ServerEvent>> GetByServerAsync(
        Guid serverId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default);

    Task<ServerEvent?> GetByIdAsync(Guid eventId, CancellationToken cancellationToken = default);

    Task CreateAsync(ServerEvent serverEvent, CancellationToken cancellationToken = default);

    Task UpdateAsync(ServerEvent serverEvent, CancellationToken cancellationToken = default);

    Task SetRsvpAsync(
        Guid eventId,
        Guid userId,
        ServerEventInterest? interest,
        CancellationToken cancellationToken = default);

    Task<(int Interested, int Going, ServerEventInterest? MyInterest)> GetRsvpStatsAsync(
        Guid eventId,
        Guid userId,
        CancellationToken cancellationToken = default);
}
