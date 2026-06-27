using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatWrappedKey;

public record GetChatWrappedKeyQuery(Guid ChatId, Guid UserId, string DeviceId = "default")
    : IRequest<GetChatWrappedKeyResult>;

public record GetChatWrappedKeyResult
{
    public bool Success { get; init; }
    public string? WrappedKeyBase64 { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public string? ErrorMessage { get; init; }
}
