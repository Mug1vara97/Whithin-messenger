using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.VotePoll;

public record VotePollCommand(
    Guid UserId,
    Guid MessageId,
    IReadOnlyList<Guid> OptionIds) : IRequest<VotePollResult>;

public class VotePollResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public Guid? ChatId { get; init; }
    public Guid? MessageId { get; init; }
}
