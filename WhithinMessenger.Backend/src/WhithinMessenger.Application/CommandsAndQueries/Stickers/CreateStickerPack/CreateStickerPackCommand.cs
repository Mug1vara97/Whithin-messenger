using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.CreateStickerPack;

public record CreateStickerPackCommand(Guid UserId, string Title) : IRequest<CreateStickerPackResult>;

public record CreateStickerPackResult
{
    public bool Success { get; init; }
    public StickerPackDto? Pack { get; init; }
    public string? ErrorMessage { get; init; }
}
