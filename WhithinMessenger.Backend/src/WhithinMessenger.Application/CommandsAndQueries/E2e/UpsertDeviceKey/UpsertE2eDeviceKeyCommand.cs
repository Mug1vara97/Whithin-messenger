using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertDeviceKey;

public record UpsertE2eDeviceKeyCommand(
    Guid UserId,
    string DeviceId,
    string PublicKeyBase64) : IRequest<UpsertE2eDeviceKeyResult>;

public record UpsertE2eDeviceKeyResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
