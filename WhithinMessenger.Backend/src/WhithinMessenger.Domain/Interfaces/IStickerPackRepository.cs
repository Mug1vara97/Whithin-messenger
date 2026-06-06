using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IStickerPackRepository
{
    Task<List<StickerPack>> GetAllWithStickersAsync(CancellationToken cancellationToken = default);
    Task<StickerPack?> GetByIdWithStickersAsync(Guid packId, CancellationToken cancellationToken = default);
    Task<Sticker?> GetStickerByIdAsync(Guid stickerId, CancellationToken cancellationToken = default);
    Task<StickerPack> CreatePackAsync(StickerPack pack, CancellationToken cancellationToken = default);
    Task UpdatePackAsync(StickerPack pack, CancellationToken cancellationToken = default);
    Task AddStickersAsync(IEnumerable<Sticker> stickers, CancellationToken cancellationToken = default);
}
