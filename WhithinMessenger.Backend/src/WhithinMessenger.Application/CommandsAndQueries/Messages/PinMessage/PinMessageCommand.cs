using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.PinMessage;

public record PinMessageCommand(Guid MessageId, Guid UserId) : IRequest<PinMessageResult>;

public class PinMessageResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public Guid? ChatId { get; init; }
    public DateTimeOffset? PinnedAt { get; init; }
}
