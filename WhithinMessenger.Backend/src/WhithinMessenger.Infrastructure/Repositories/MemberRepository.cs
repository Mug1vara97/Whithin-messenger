using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class MemberRepository : IMemberRepository
{
    private readonly WithinDbContext _context;

    public MemberRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<ServerMember?> GetByIdAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .Include(sm => sm.User)
            .Include(sm => sm.Server)
            .FirstOrDefaultAsync(sm => sm.Id == memberId, cancellationToken);
    }

    public async Task<List<ServerMember>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .Where(sm => sm.ServerId == serverId)
            .Include(sm => sm.User)
                .ThenInclude(u => u.UserProfile)
            .Include(sm => sm.User)
                .ThenInclude(u => u.UserServerRoles)
                    .ThenInclude(usr => usr.Role)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<ServerMember>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .Where(sm => sm.UserId == userId)
            .Include(sm => sm.Server)
            .ToListAsync(cancellationToken);
    }

    public async Task<ServerMember> CreateAsync(ServerMember member, CancellationToken cancellationToken = default)
    {
        _context.ServerMembers.Add(member);
        await _context.SaveChangesAsync(cancellationToken);
        return member;
    }

    public async Task<ServerMember> UpdateAsync(ServerMember member, CancellationToken cancellationToken = default)
    {
        _context.ServerMembers.Update(member);
        await _context.SaveChangesAsync(cancellationToken);
        return member;
    }

    public async Task DeleteAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        var member = await GetByIdAsync(memberId, cancellationToken);
        if (member != null)
        {
            _context.ServerMembers.Remove(member);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> IsMemberAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.ServerMembers
            .AnyAsync(sm => sm.ServerId == serverId && sm.UserId == userId, cancellationToken);
    }
}
