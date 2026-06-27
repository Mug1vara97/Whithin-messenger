using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatKeyRecipients;

public record GetChatKeyRecipientsQuery(Guid ChatId, Guid UserId) : IRequest<GetChatKeyRecipientsResult>;

public record GetChatKeyRecipientsResult
{
    public bool Success { get; init; }
    public IReadOnlyList<Guid> UserIds { get; init; } = Array.Empty<Guid>();
    public string? ErrorMessage { get; init; }
}
