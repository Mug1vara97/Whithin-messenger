using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class RoleRepository : IRoleRepository
{
    private readonly WithinDbContext _context;

    public RoleRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<ServerRole?> GetByIdAsync(Guid roleId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerRoles
            .FirstOrDefaultAsync(r => r.Id == roleId, cancellationToken);
    }

    public async Task<List<ServerRole>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerRoles
            .Where(r => r.ServerId == serverId)
            .OrderBy(r => r.RoleName)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<ServerRole>> GetUserRolesAsync(Guid userId, Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerRoles
            .Where(r => r.ServerId == serverId && r.UserServerRoles.Any(usr => usr.User.Id == userId))
            .ToListAsync(cancellationToken);
    }

    public async Task<ServerRole> CreateAsync(ServerRole role, CancellationToken cancellationToken = default)
    {
        _context.ServerRoles.Add(role);
        await _context.SaveChangesAsync(cancellationToken);
        return role;
    }

    public async Task<ServerRole> UpdateAsync(ServerRole role, CancellationToken cancellationToken = default)
    {
        _context.ServerRoles.Update(role);
        await _context.SaveChangesAsync(cancellationToken);
        return role;
    }

    public async Task DeleteAsync(Guid roleId, CancellationToken cancellationToken = default)
    {
        var role = await GetByIdAsync(roleId, cancellationToken);
        if (role != null)
        {
            _context.ServerRoles.Remove(role);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> ExistsAsync(Guid serverId, string roleName, CancellationToken cancellationToken = default)
    {
        return await _context.ServerRoles
            .AnyAsync(r => r.ServerId == serverId && r.RoleName == roleName, cancellationToken);
    }
}
