using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Stickers;
using WhithinMessenger.Application.CommandsAndQueries.Stickers.GetStickerPacks;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.GetAvailableStickerPacks;

public class GetAvailableStickerPacksQueryHandler : IRequestHandler<GetAvailableStickerPacksQuery, GetStickerPacksResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;

    public GetAvailableStickerPacksQueryHandler(IStickerPackRepository stickerPackRepository)
    {
        _stickerPackRepository = stickerPackRepository;
    }

    public async Task<GetStickerPacksResult> Handle(GetAvailableStickerPacksQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var packs = await _stickerPackRepository.GetAvailablePacksForUserAsync(request.UserId, cancellationToken);
            var dtos = packs.Select(MapPack).ToList();
            return new GetStickerPacksResult
            {
                Success = true,
                Packs = dtos
            };
        }
        catch (Exception ex)
        {
            return new GetStickerPacksResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    private static StickerPackDto MapPack(Domain.Models.StickerPack pack) =>
        new()
        {
            Id = pack.Id,
            Title = pack.Title,
            CoverImagePath = pack.CoverImagePath,
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
