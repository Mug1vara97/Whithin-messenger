using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.UnpinMessage;

public record UnpinMessageCommand(Guid MessageId, Guid UserId) : IRequest<UnpinMessageResult>;

public class UnpinMessageResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public Guid? ChatId { get; init; }
}
