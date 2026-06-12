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

    public async Task<bool> UserHasRoleAsync(Guid userId, Guid serverId, Guid roleId, CancellationToken cancellationToken = default)
    {
        return await _context.UserServerRoles
            .AnyAsync(ur => ur.Id == userId && ur.ServerId == serverId && ur.RoleId == roleId, cancellationToken);
    }

    public async Task AssignRoleToUserAsync(Guid userId, Guid roleId, CancellationToken cancellationToken = default)
    {
        var role = await GetByIdAsync(roleId, cancellationToken)
            ?? throw new InvalidOperationException("Роль не найдена");

        if (await UserHasRoleAsync(userId, role.ServerId, roleId, cancellationToken))
        {
            return;
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new InvalidOperationException("Пользователь не найден");
        var server = await _context.Servers.FirstOrDefaultAsync(s => s.Id == role.ServerId, cancellationToken)
            ?? throw new InvalidOperationException("Сервер не найден");

        _context.UserServerRoles.Add(new UserServerRole
        {
            Id = userId,
            ServerId = role.ServerId,
            RoleId = roleId,
            AssignedAt = DateTimeOffset.UtcNow,
            User = user,
            Server = server,
            Role = role,
        });

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveRoleFromUserAsync(Guid userId, Guid roleId, CancellationToken cancellationToken = default)
    {
        var role = await GetByIdAsync(roleId, cancellationToken);
        if (role == null)
        {
            return;
        }

        var assignment = await _context.UserServerRoles
            .FirstOrDefaultAsync(
                ur => ur.Id == userId && ur.ServerId == role.ServerId && ur.RoleId == roleId,
                cancellationToken);

        if (assignment == null)
        {
            return;
        }

        _context.UserServerRoles.Remove(assignment);
        await _context.SaveChangesAsync(cancellationToken);
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

    public async Task<List<Guid>> GetUserIdsByRoleAsync(Guid roleId, CancellationToken cancellationToken = default)
    {
        return await _context.UserServerRoles
            .Where(ur => ur.RoleId == roleId)
            .Select(ur => ur.Id)
            .Distinct()
            .ToListAsync(cancellationToken);
    }
}
