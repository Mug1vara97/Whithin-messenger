using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertChatWrappedKeys;

public record UpsertChatWrappedKeysCommand(
    Guid ChatId,
    Guid ActorUserId,
    IReadOnlyList<ChatWrappedKeyEntry> Wraps) : IRequest<UpsertChatWrappedKeysResult>;

public record ChatWrappedKeyEntry(Guid UserId, string WrappedKeyBase64, string DeviceId = "default");

public record UpsertChatWrappedKeysResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
