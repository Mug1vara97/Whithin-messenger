using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.InstallStickerPack;

public record InstallStickerPackCommand(Guid UserId, Guid PackId) : IRequest<InstallStickerPackResult>;

public record InstallStickerPackResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
