using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.DeleteStickerPack;

public record DeleteStickerPackCommand(Guid UserId, Guid PackId) : IRequest<DeleteStickerPackResult>;

public record DeleteStickerPackResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
