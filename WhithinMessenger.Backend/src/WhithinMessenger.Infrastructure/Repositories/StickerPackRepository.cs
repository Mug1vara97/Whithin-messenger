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
        return await QueryPacksWithStickers(_context.StickerPacks)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<StickerPack>> GetInstalledPacksForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var installedPackIds =
            _context.UserStickerPacks
                .Where(x => x.UserId == userId)
                .Select(x => x.StickerPackId);

        return await QueryPacksWithStickers(
                _context.StickerPacks.Where(p => installedPackIds.Contains(p.Id)))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<StickerPack>> GetAvailablePacksForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var installedPackIds =
            _context.UserStickerPacks
                .Where(x => x.UserId == userId)
                .Select(x => x.StickerPackId);

        return await QueryPacksWithStickers(
                _context.StickerPacks.Where(p => !installedPackIds.Contains(p.Id)))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> InstallPackForUserAsync(Guid userId, Guid packId, CancellationToken cancellationToken = default)
    {
        var packExists = await _context.StickerPacks.AnyAsync(p => p.Id == packId, cancellationToken);
        if (!packExists)
        {
            return false;
        }

        var alreadyInstalled = await _context.UserStickerPacks
            .AnyAsync(x => x.UserId == userId && x.StickerPackId == packId, cancellationToken);
        if (alreadyInstalled)
        {
            return true;
        }

        _context.UserStickerPacks.Add(new UserStickerPack
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StickerPackId = packId,
            InstalledAt = DateTimeOffset.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> IsPackInstalledForUserAsync(Guid userId, Guid packId, CancellationToken cancellationToken = default)
    {
        return await _context.UserStickerPacks
            .AnyAsync(x => x.UserId == userId && x.StickerPackId == packId, cancellationToken);
    }

    public async Task<bool> UninstallPackForUserAsync(Guid userId, Guid packId, CancellationToken cancellationToken = default)
    {
        var entry = await _context.UserStickerPacks
            .FirstOrDefaultAsync(x => x.UserId == userId && x.StickerPackId == packId, cancellationToken);
        if (entry == null)
        {
            return false;
        }

        _context.UserStickerPacks.Remove(entry);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static IQueryable<StickerPack> QueryPacksWithStickers(IQueryable<StickerPack> query) =>
        query.Include(p => p.Stickers.OrderBy(s => s.SortOrder));

    public async Task<StickerPack?> GetByIdWithStickersAsync(Guid packId, CancellationToken cancellationToken = default)
    {
        return await _context.StickerPacks
            .AsNoTracking()
            .Include(p => p.Stickers.OrderBy(s => s.SortOrder))
            .FirstOrDefaultAsync(p => p.Id == packId, cancellationToken);
    }

    public async Task<StickerPack?> GetByIdForEditAsync(Guid packId, CancellationToken cancellationToken = default)
    {
        return await _context.StickerPacks
            .Include(p => p.Stickers)
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
