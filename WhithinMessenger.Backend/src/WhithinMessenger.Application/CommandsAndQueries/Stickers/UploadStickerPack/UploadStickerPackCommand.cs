using MediatR;
using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.UploadStickerPack;

public record UploadStickerPackCommand(
    Guid UserId,
    string Title,
    IFormFile Archive
) : IRequest<UploadStickerPackResult>;

public record UploadStickerPackResult
{
    public bool Success { get; init; }
    public StickerPackDto? Pack { get; init; }
    public string? ErrorMessage { get; init; }
}
