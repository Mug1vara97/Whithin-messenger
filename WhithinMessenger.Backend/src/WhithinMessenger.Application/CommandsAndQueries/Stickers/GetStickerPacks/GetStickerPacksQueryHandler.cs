using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.GetStickerPacks;

public class GetStickerPacksQueryHandler : IRequestHandler<GetStickerPacksQuery, GetStickerPacksResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;

    public GetStickerPacksQueryHandler(IStickerPackRepository stickerPackRepository)
    {
        _stickerPackRepository = stickerPackRepository;
    }

    public async Task<GetStickerPacksResult> Handle(GetStickerPacksQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var packs = await _stickerPackRepository.GetAllWithStickersAsync(cancellationToken);
            var dtos = packs.Select(p => new StickerPackDto
            {
                Id = p.Id,
                Title = p.Title,
                CoverImagePath = p.CoverImagePath,
                CreatedAt = p.CreatedAt,
                Stickers = p.Stickers
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
            }).ToList();

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
}
