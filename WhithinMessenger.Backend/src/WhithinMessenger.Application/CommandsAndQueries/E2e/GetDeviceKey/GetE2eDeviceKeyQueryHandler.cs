using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.GetDeviceKey;

public class GetE2eDeviceKeyQueryHandler : IRequestHandler<GetE2eDeviceKeyQuery, GetE2eDeviceKeyResult>
{
    private readonly IUserE2eKeyRepository _repository;

    public GetE2eDeviceKeyQueryHandler(IUserE2eKeyRepository repository)
    {
        _repository = repository;
    }

    public async Task<GetE2eDeviceKeyResult> Handle(GetE2eDeviceKeyQuery request, CancellationToken cancellationToken)
    {
        var key = await _repository.GetPrimaryAsync(request.UserId, cancellationToken);
        if (key == null)
        {
            return new GetE2eDeviceKeyResult
            {
                Success = false,
                ErrorMessage = "E2E key not found",
            };
        }

        return new GetE2eDeviceKeyResult
        {
            Success = true,
            DeviceId = key.DeviceId,
            PublicKeyBase64 = key.PublicKeyBase64,
            UpdatedAt = key.UpdatedAt,
        };
    }
}
