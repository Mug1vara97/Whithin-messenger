using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertDeviceKey;

public class UpsertE2eDeviceKeyCommandHandler : IRequestHandler<UpsertE2eDeviceKeyCommand, UpsertE2eDeviceKeyResult>
{
    private const int ExpectedPublicKeyBytes = 32;

    private readonly IUserE2eKeyRepository _userKeyRepository;
    private readonly IChatE2eKeyRepository _chatKeyRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IE2eRealtimeNotifier _e2eNotifier;

    public UpsertE2eDeviceKeyCommandHandler(
        IUserE2eKeyRepository userKeyRepository,
        IChatE2eKeyRepository chatKeyRepository,
        IChatRepository chatRepository,
        IE2eRealtimeNotifier e2eNotifier)
    {
        _userKeyRepository = userKeyRepository;
        _chatKeyRepository = chatKeyRepository;
        _chatRepository = chatRepository;
        _e2eNotifier = e2eNotifier;
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

        var normalizedDeviceId = request.DeviceId.Trim();
        var normalizedPublicKey = Convert.ToBase64String(publicKeyBytes);

        var existing = await _userKeyRepository.GetByDeviceAsync(
            request.UserId,
            normalizedDeviceId,
            cancellationToken);

        var keyChanged = existing != null
            && !string.Equals(
                NormalizePublicKey(existing.PublicKeyBase64),
                normalizedPublicKey,
                StringComparison.Ordinal);

        await _userKeyRepository.UpsertAsync(new UserE2eDeviceKey
        {
            UserId = request.UserId,
            DeviceId = normalizedDeviceId,
            PublicKeyBase64 = normalizedPublicKey,
            UpdatedAt = DateTimeOffset.UtcNow,
        }, cancellationToken);

        if (keyChanged)
        {
            var affectedChatIds = await _chatKeyRepository.GetChatIdsForUserDeviceAsync(
                request.UserId,
                normalizedDeviceId,
                cancellationToken);

            await _chatKeyRepository.DeleteForUserDeviceAsync(
                request.UserId,
                normalizedDeviceId,
                cancellationToken);

            foreach (var chatId in affectedChatIds)
            {
                var members = await _chatRepository.GetChatMembersAsync(chatId, cancellationToken);
                await _e2eNotifier.NotifyChatKeyRewrapNeededAsync(
                    chatId,
                    request.UserId,
                    normalizedDeviceId,
                    members,
                    cancellationToken);
            }
        }

        return new UpsertE2eDeviceKeyResult { Success = true };
    }

    private static string NormalizePublicKey(string base64)
    {
        try
        {
            return Convert.ToBase64String(Convert.FromBase64String(base64.Trim()));
        }
        catch
        {
            return base64.Trim();
        }
    }
}
