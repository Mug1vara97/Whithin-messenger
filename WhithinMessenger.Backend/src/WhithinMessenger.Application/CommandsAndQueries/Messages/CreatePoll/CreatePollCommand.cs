using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.CreatePoll;

public record CreatePollCommand(
    Guid UserId,
    Guid ChatId,
    string Question,
    IReadOnlyList<string> Options,
    bool AllowMultiple,
    bool IsAnonymous) : IRequest<CreatePollResult>;

public class CreatePollResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public Guid? MessageId { get; init; }
}
