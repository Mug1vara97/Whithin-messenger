using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class ChatMemberRepository : IChatMemberRepository
{
    private readonly WithinDbContext _context;

    public ChatMemberRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<Member?> GetByIdAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .Include(m => m.User)
            .Include(m => m.Chat)
            .FirstOrDefaultAsync(m => m.Id == memberId, cancellationToken);
    }

    public async Task<List<Member>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .Where(m => m.ChatId == chatId)
            .Include(m => m.User)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<Member>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .Where(m => m.UserId == userId)
            .Include(m => m.Chat)
            .ToListAsync(cancellationToken);
    }

    public async Task<Member> CreateAsync(Member member, CancellationToken cancellationToken = default)
    {
        _context.Members.Add(member);
        await _context.SaveChangesAsync(cancellationToken);
        return member;
    }

    public async Task<Member> UpdateAsync(Member member, CancellationToken cancellationToken = default)
    {
        _context.Members.Update(member);
        await _context.SaveChangesAsync(cancellationToken);
        return member;
    }

    public async Task DeleteAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        var member = await GetByIdAsync(memberId, cancellationToken);
        if (member != null)
        {
            _context.Members.Remove(member);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> IsMemberAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .AnyAsync(m => m.ChatId == chatId && m.UserId == userId, cancellationToken);
    }

    public async Task AddRangeAsync(IEnumerable<Member> members, CancellationToken cancellationToken = default)
    {
        _context.Members.AddRange(members);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
