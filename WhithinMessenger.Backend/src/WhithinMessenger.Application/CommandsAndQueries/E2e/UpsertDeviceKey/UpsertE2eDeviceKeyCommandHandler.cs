using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertDeviceKey;

public class UpsertE2eDeviceKeyCommandHandler : IRequestHandler<UpsertE2eDeviceKeyCommand, UpsertE2eDeviceKeyResult>
{
    private const int ExpectedPublicKeyBytes = 32;

    private readonly IUserE2eKeyRepository _repository;

    public UpsertE2eDeviceKeyCommandHandler(IUserE2eKeyRepository repository)
    {
        _repository = repository;
    }

    public async Task<UpsertE2eDeviceKeyResult> Handle(UpsertE2eDeviceKeyCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceId))
        {
            return new UpsertE2eDeviceKeyResult { Success = false, ErrorMessage = "DeviceId is required" };
        }

        if (string.IsNullOrWhiteSpace(request.PublicKeyBase64))
        {
            return new UpsertE2eDeviceKeyResult { Success = false, ErrorMessage = "PublicKeyBase64 is required" };
        }

        byte[] publicKeyBytes;
        try
        {
            publicKeyBytes = Convert.FromBase64String(request.PublicKeyBase64.Trim());
        }
        catch
        {
            return new UpsertE2eDeviceKeyResult { Success = false, ErrorMessage = "Invalid public key encoding" };
        }

        if (publicKeyBytes.Length != ExpectedPublicKeyBytes)
        {
            return new UpsertE2eDeviceKeyResult
            {
                Success = false,
                ErrorMessage = $"Public key must be {ExpectedPublicKeyBytes} bytes",
            };
        }

        await _repository.UpsertAsync(new UserE2eDeviceKey
        {
            UserId = request.UserId,
            DeviceId = request.DeviceId.Trim(),
            PublicKeyBase64 = Convert.ToBase64String(publicKeyBytes),
            UpdatedAt = DateTimeOffset.UtcNow,
        }, cancellationToken);

        return new UpsertE2eDeviceKeyResult { Success = true };
    }
}
