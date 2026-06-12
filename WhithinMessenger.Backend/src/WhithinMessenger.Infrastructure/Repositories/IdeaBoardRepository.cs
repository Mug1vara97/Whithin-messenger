using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class IdeaBoardRepository : IIdeaBoardRepository
{
    private readonly WithinDbContext _context;

    public IdeaBoardRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<List<IdeaBoardCard>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default)
    {
        return await _context.IdeaBoardCards
            .AsNoTracking()
            .Include(c => c.Author)
            .ThenInclude(u => u.UserProfile)
            .Where(c => c.ChatId == chatId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IdeaBoardCard?> GetByIdAsync(Guid cardId, CancellationToken cancellationToken = default)
    {
        return await _context.IdeaBoardCards
            .Include(c => c.Chat)
            .Include(c => c.Author)
            .ThenInclude(u => u.UserProfile)
            .FirstOrDefaultAsync(c => c.Id == cardId, cancellationToken);
    }

    public async Task CreateAsync(IdeaBoardCard card, CancellationToken cancellationToken = default)
    {
        _context.IdeaBoardCards.Add(card);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(IdeaBoardCard card, CancellationToken cancellationToken = default)
    {
        _context.IdeaBoardCards.Update(card);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid cardId, CancellationToken cancellationToken = default)
    {
        var card = await _context.IdeaBoardCards.FirstOrDefaultAsync(c => c.Id == cardId, cancellationToken);
        if (card == null)
        {
            return;
        }

        _context.IdeaBoardCards.Remove(card);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
