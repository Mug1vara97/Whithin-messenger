using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class ServerMemberRepository : IServerMemberRepository
{
    private readonly WithinDbContext _context;

    public ServerMemberRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<bool> IsUserMemberAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .AnyAsync(sm => sm.ServerId == serverId && sm.UserId == userId, cancellationToken);
    }

    public async Task AddAsync(ServerMember serverMember, CancellationToken cancellationToken = default)
    {
        _context.ServerMembers.Add(serverMember);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        var serverMember = await _context.ServerMembers
            .FirstOrDefaultAsync(sm => sm.ServerId == serverId && sm.UserId == userId, cancellationToken);
        
        if (serverMember != null)
        {
            _context.ServerMembers.Remove(serverMember);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<List<ServerMemberInfo>> GetServerMembersAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        var members = await _context.ServerMembers
            .Where(sm => sm.ServerId == serverId)
            .Include(sm => sm.User)
            .ThenInclude(u => u.UserProfile)
            .Include(sm => sm.User)
            .ThenInclude(u => u.UserServerRoles)
            .ThenInclude(ur => ur.Role)
            .ToListAsync(cancellationToken);

        return members.Select(sm => new ServerMemberInfo
        {
            UserId = sm.UserId,
            Nickname = sm.Nickname,
            Login = sm.User.UserName ?? string.Empty,
            Username = ServerMemberNames.Resolve(
                sm.Nickname,
                sm.User.UserProfile?.DisplayName,
                sm.User.UserName),
            Avatar = sm.User.UserProfile?.Avatar,
            AvatarColor = sm.User.UserProfile?.AvatarColor,
            Nameplate = sm.User.UserProfile?.Nameplate,
            AvatarDecoration = sm.User.UserProfile?.AvatarDecoration,
            UserStatus = sm.User.Status.ToString().ToLower(),
            LastSeen = sm.User.LastSeen.DateTime,
            JoinedAt = sm.JoinedAt.DateTime,
            Roles = sm.User.UserServerRoles
                .Where(ur => ur.Role.ServerId == serverId)
                .Select(ur => new ServerMemberRole
                {
                    RoleId = ur.Role.Id,
                    RoleName = ur.Role.RoleName,
                    Color = ur.Role.Color ?? string.Empty,
                })
                .ToList(),
        }).ToList();
    }

    public async Task<string?> GetNicknameAsync(
        Guid serverId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .AsNoTracking()
            .Where(sm => sm.ServerId == serverId && sm.UserId == userId)
            .Select(sm => sm.Nickname)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Dictionary<Guid, string?>> GetNicknamesMapAsync(
        Guid serverId,
        CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .AsNoTracking()
            .Where(sm => sm.ServerId == serverId && sm.Nickname != null && sm.Nickname != string.Empty)
            .ToDictionaryAsync(sm => sm.UserId, sm => sm.Nickname, cancellationToken);
    }

    public async Task<ServerMember?> GetByServerAndUserAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .FirstOrDefaultAsync(sm => sm.ServerId == serverId && sm.UserId == userId, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveAllMembersAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        var members = await _context.ServerMembers
            .Where(sm => sm.ServerId == serverId)
            .ToListAsync(cancellationToken);

        _context.ServerMembers.RemoveRange(members);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<ServerMember?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .FirstOrDefaultAsync(sm => sm.Id == id, cancellationToken);
    }

    public async Task<List<ServerMember>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .Where(sm => sm.ServerId == serverId)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<ServerMember>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .Where(sm => sm.UserId == userId)
            .ToListAsync(cancellationToken);
    }

    public async Task CreateAsync(ServerMember serverMember, CancellationToken cancellationToken = default)
    {
        _context.ServerMembers.Add(serverMember);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(ServerMember serverMember, CancellationToken cancellationToken = default)
    {
        _context.ServerMembers.Update(serverMember);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var serverMember = await _context.ServerMembers
            .FirstOrDefaultAsync(sm => sm.Id == id, cancellationToken);
        
        if (serverMember != null)
        {
            _context.ServerMembers.Remove(serverMember);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task DeleteByServerAndUserAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        var serverMember = await _context.ServerMembers
            .FirstOrDefaultAsync(sm => sm.ServerId == serverId && sm.UserId == userId, cancellationToken);
        
        if (serverMember != null)
        {
            _context.ServerMembers.Remove(serverMember);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task RemoveAsync(ServerMember serverMember, CancellationToken cancellationToken = default)
    {
        _context.ServerMembers.Remove(serverMember);
        await _context.SaveChangesAsync(cancellationToken);
    }
}

