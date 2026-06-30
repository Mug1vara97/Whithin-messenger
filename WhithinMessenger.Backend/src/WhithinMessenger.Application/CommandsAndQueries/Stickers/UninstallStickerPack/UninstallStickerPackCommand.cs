using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.UninstallStickerPack;

public record UninstallStickerPackCommand(Guid UserId, Guid PackId) : IRequest<UninstallStickerPackResult>;

public record UninstallStickerPackResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
