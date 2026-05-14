using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class ServerRepository : IServerRepository
{
    private readonly WithinDbContext _context;

    public ServerRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<Server?> GetByIdAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _context.Servers
            .FirstOrDefaultAsync(s => s.Id == serverId, cancellationToken);
    }

    public async Task<Server?> GetByIdWithCategoriesAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _context.Servers
            .Include(s => s.ChatCategories)
                .ThenInclude(c => c.Chats)
            .Include(s => s.Chats.Where(c => c.CategoryId == null))
            .FirstOrDefaultAsync(s => s.Id == serverId, cancellationToken);
    }

    public async Task<List<Server>> GetUserServersAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var servers = await _context.Servers
            .Where(s => s.ServerMembers.Any(sm => sm.UserId == userId))
            .Include(s => s.ChatCategories)
                .ThenInclude(c => c.Chats)
            .Include(s => s.Chats.Where(c => c.CategoryId == null))
            .ToListAsync(cancellationToken);

        var orderMap = await _context.UserServerOrders
            .Where(o => o.UserId == userId)
            .ToDictionaryAsync(o => o.ServerId, o => o.Position, cancellationToken);

        return servers
            .OrderBy(s => orderMap.TryGetValue(s.Id, out var pos) ? pos : int.MaxValue)
            .ThenBy(s => s.Name)
            .ToList();
    }

    public async Task SaveUserServerOrderAsync(Guid userId, IReadOnlyList<Guid> orderedServerIds, CancellationToken cancellationToken = default)
    {
        var normalized = (orderedServerIds ?? Array.Empty<Guid>())
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        var memberServerIds = await _context.ServerMembers
            .Where(sm => sm.UserId == userId)
            .Select(sm => sm.ServerId)
            .ToListAsync(cancellationToken);

        var memberServerSet = memberServerIds.ToHashSet();
        var validOrdered = normalized.Where(memberServerSet.Contains).ToList();

        var existing = await _context.UserServerOrders
            .Where(o => o.UserId == userId)
            .ToListAsync(cancellationToken);

        // Удаляем записи порядка для серверов, в которых пользователь больше не состоит.
        var stale = existing.Where(o => !memberServerSet.Contains(o.ServerId)).ToList();
        if (stale.Count > 0)
        {
            _context.UserServerOrders.RemoveRange(stale);
        }

        var existingByServerId = existing
            .Where(o => memberServerSet.Contains(o.ServerId))
            .ToDictionary(o => o.ServerId, o => o);

        for (var i = 0; i < validOrdered.Count; i++)
        {
            var serverId = validOrdered[i];
            if (existingByServerId.TryGetValue(serverId, out var order))
            {
                order.Position = i;
            }
            else
            {
                _context.UserServerOrders.Add(new UserServerOrder
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ServerId = serverId,
                    Position = i
                });
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<Server> CreateAsync(Server server, CancellationToken cancellationToken = default)
    {
        _context.Servers.Add(server);
        await _context.SaveChangesAsync(cancellationToken);
        return server;
    }

    public async Task<Server> UpdateAsync(Server server, CancellationToken cancellationToken = default)
    {
        _context.Servers.Update(server);
        await _context.SaveChangesAsync(cancellationToken);
        return server;
    }

    public async Task DeleteAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        var server = await GetByIdAsync(serverId, cancellationToken);
        if (server != null)
        {
            _context.Servers.Remove(server);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> UserHasAccessAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Servers
            .AnyAsync(s => s.Id == serverId && s.ServerMembers.Any(sm => sm.UserId == userId), cancellationToken);
    }

    public async Task<bool> IsUserMemberAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .AnyAsync(sm => sm.ServerId == serverId && sm.UserId == userId, cancellationToken);
    }

    public async Task<List<Server>> GetPublicServersAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Servers
            .Where(s => s.IsPublic)
            .Include(s => s.ServerMembers)
            .OrderBy(s => s.Name)
            .ToListAsync(cancellationToken);
    }
}




