using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class StickerPackRepository : IStickerPackRepository
{
    private readonly WithinDbContext _context;

    public StickerPackRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<List<StickerPack>> GetAllWithStickersAsync(CancellationToken cancellationToken = default)
    {
        return await _context.StickerPacks
            .Include(p => p.Stickers.OrderBy(s => s.SortOrder))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<StickerPack?> GetByIdWithStickersAsync(Guid packId, CancellationToken cancellationToken = default)
    {
        return await _context.StickerPacks
            .Include(p => p.Stickers.OrderBy(s => s.SortOrder))
            .FirstOrDefaultAsync(p => p.Id == packId, cancellationToken);
    }

    public async Task<Sticker?> GetStickerByIdAsync(Guid stickerId, CancellationToken cancellationToken = default)
    {
        return await _context.Stickers
            .Include(s => s.StickerPack)
            .FirstOrDefaultAsync(s => s.Id == stickerId, cancellationToken);
    }

    public async Task<StickerPack> CreatePackAsync(StickerPack pack, CancellationToken cancellationToken = default)
    {
        _context.StickerPacks.Add(pack);
        await _context.SaveChangesAsync(cancellationToken);
        return pack;
    }

    public async Task UpdatePackAsync(StickerPack pack, CancellationToken cancellationToken = default)
    {
        _context.StickerPacks.Update(pack);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddStickersAsync(IEnumerable<Sticker> stickers, CancellationToken cancellationToken = default)
    {
        _context.Stickers.AddRange(stickers);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> DeletePackAsync(Guid packId, CancellationToken cancellationToken = default)
    {
        var pack = await _context.StickerPacks
            .Include(p => p.Stickers)
            .FirstOrDefaultAsync(p => p.Id == packId, cancellationToken);
        if (pack == null)
        {
            return false;
        }

        _context.StickerPacks.Remove(pack);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
