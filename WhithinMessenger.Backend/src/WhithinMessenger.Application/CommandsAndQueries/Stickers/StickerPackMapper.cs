using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers;

internal static class StickerPackMapper
{
    public static StickerPackDto ToDto(StickerPack pack) =>
        new()
        {
            Id = pack.Id,
            Title = pack.Title,
            CoverImagePath = pack.CoverImagePath,
            CreatedByUserId = pack.CreatedByUserId,
            CreatedAt = pack.CreatedAt,
            Stickers = pack.Stickers
                .OrderBy(s => s.SortOrder)
                .Select(s => new StickerDto
                {
                    Id = s.Id,
                    StickerPackId = s.StickerPackId,
                    FilePath = s.FilePath,
                    ContentType = s.ContentType,
                    SortOrder = s.SortOrder
                })
                .ToList()
        };
}
