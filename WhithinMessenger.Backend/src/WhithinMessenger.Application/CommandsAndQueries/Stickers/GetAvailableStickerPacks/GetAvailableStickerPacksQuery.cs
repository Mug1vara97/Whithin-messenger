using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Stickers.GetStickerPacks;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.GetAvailableStickerPacks;

public record GetAvailableStickerPacksQuery(Guid UserId) : IRequest<GetStickerPacksResult>;
