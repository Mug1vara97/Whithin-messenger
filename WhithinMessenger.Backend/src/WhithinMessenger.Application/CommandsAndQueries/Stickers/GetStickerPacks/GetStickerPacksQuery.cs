using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.GetStickerPacks;

public record GetStickerPacksQuery(Guid UserId) : IRequest<GetStickerPacksResult>;

public record GetStickerPacksResult
{
    public bool Success { get; init; }
    public List<StickerPackDto> Packs { get; init; } = new();
    public string? ErrorMessage { get; init; }
}
