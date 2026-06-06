using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.SendStickerMessage;

public record SendStickerMessageCommand(
    Guid UserId,
    Guid ChatId,
    Guid StickerId,
    Guid? RepliedToMessageId = null
) : IRequest<SendStickerMessageResult>;

public record SendStickerMessageResult
{
    public bool Success { get; init; }
    public Guid? MessageId { get; init; }
    public StickerDto? Sticker { get; init; }
    public string? ErrorMessage { get; init; }
}
