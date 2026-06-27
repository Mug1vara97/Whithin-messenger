using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.GetDeviceKey;

public record GetE2eDeviceKeyQuery(Guid UserId, string? DeviceId = null) : IRequest<GetE2eDeviceKeyResult>;

public record GetE2eDeviceKeyResult
{
    public bool Success { get; init; }
    public string? DeviceId { get; init; }
    public string? PublicKeyBase64 { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public string? ErrorMessage { get; init; }
}
