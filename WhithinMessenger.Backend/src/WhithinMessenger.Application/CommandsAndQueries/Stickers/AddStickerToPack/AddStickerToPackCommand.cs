using MediatR;
using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.AddStickerToPack;

public record AddStickerToPackCommand(
    Guid UserId,
    Guid PackId,
    IFormFile File
) : IRequest<AddStickerToPackResult>;

public record AddStickerToPackResult
{
    public bool Success { get; init; }
    public StickerPackDto? Pack { get; init; }
    public StickerDto? Sticker { get; init; }
    public string? ErrorMessage { get; init; }
}
