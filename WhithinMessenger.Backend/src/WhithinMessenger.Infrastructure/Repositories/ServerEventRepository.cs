using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class ServerEventRepository : IServerEventRepository
{
    private readonly WithinDbContext _context;

    public ServerEventRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<List<ServerEvent>> GetByServerAsync(
        Guid serverId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default)
    {
        return await _context.ServerEvents
            .AsNoTracking()
            .Include(e => e.Channel)
            .Include(e => e.CreatedBy)
            .Include(e => e.Rsvps)
            .Where(e => e.ServerId == serverId && e.StartsAt >= from && e.StartsAt <= to)
            .OrderBy(e => e.StartsAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<ServerEvent?> GetByIdAsync(Guid eventId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerEvents
            .Include(e => e.Channel)
            .Include(e => e.CreatedBy)
            .Include(e => e.Rsvps)
            .FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken);
    }

    public async Task CreateAsync(ServerEvent serverEvent, CancellationToken cancellationToken = default)
    {
        _context.ServerEvents.Add(serverEvent);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(ServerEvent serverEvent, CancellationToken cancellationToken = default)
    {
        _context.ServerEvents.Update(serverEvent);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task SetRsvpAsync(
        Guid eventId,
        Guid userId,
        ServerEventInterest? interest,
        CancellationToken cancellationToken = default)
    {
        var existing = await _context.ServerEventRsvps
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId, cancellationToken);

        if (interest == null)
        {
            if (existing != null)
            {
                _context.ServerEventRsvps.Remove(existing);
                await _context.SaveChangesAsync(cancellationToken);
            }

            return;
        }

        if (existing == null)
        {
            _context.ServerEventRsvps.Add(new ServerEventRsvp
            {
                EventId = eventId,
                UserId = userId,
                Interest = interest.Value,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            existing.Interest = interest.Value;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<(int Interested, int Going, ServerEventInterest? MyInterest)> GetRsvpStatsAsync(
        Guid eventId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var rsvps = await _context.ServerEventRsvps
            .AsNoTracking()
            .Where(r => r.EventId == eventId)
            .ToListAsync(cancellationToken);

        var interested = rsvps.Count(r => r.Interest == ServerEventInterest.Interested);
        var going = rsvps.Count(r => r.Interest == ServerEventInterest.Going);
        var mine = rsvps.FirstOrDefault(r => r.UserId == userId)?.Interest;
        return (interested, going, mine);
    }
}
