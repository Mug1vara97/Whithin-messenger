using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Stickers;
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
            var packs = await _stickerPackRepository.GetInstalledPacksForUserAsync(request.UserId, cancellationToken);
            var dtos = packs.Select(StickerPackMapper.ToDto).ToList();

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
