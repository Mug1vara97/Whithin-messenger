using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using System.Text.RegularExpressions;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertChatWrappedKeys;

public class UpsertChatWrappedKeysCommandHandler
    : IRequestHandler<UpsertChatWrappedKeysCommand, UpsertChatWrappedKeysResult>
{
    private const int MaxWrappedKeyLength = 1024;
    private static readonly Regex FingerprintRegex = new("^[0-9a-f]{64}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly IChatE2eKeyRepository _repository;
    private readonly IChatRepository _chatRepository;

    public UpsertChatWrappedKeysCommandHandler(
        IChatE2eKeyRepository repository,
        IChatRepository chatRepository)
    {
        _repository = repository;
        _chatRepository = chatRepository;
    }

    public async Task<UpsertChatWrappedKeysResult> Handle(
        UpsertChatWrappedKeysCommand request,
        CancellationToken cancellationToken)
    {
        var members = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
        if (!members.Contains(request.ActorUserId))
        {
            // Stale client state may attempt best-effort wrap sync for channels no longer available
            // to this user. Treat as a no-op to avoid noisy 4xx loops.
            return new UpsertChatWrappedKeysResult { Success = true };
        }

        var memberSet = members.ToHashSet();
        var entities = new List<ChatE2eWrappedKey>();

        foreach (var wrap in request.Wraps)
        {
            if (!memberSet.Contains(wrap.UserId))
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(wrap.WrappedKeyBase64)
                || wrap.WrappedKeyBase64.Length > MaxWrappedKeyLength)
            {
                continue;
            }

            entities.Add(new ChatE2eWrappedKey
            {
                ChatId = request.ChatId,
                UserId = wrap.UserId,
                DeviceId = string.IsNullOrWhiteSpace(wrap.DeviceId) ? "default" : wrap.DeviceId.Trim(),
                WrappedKeyBase64 = wrap.WrappedKeyBase64.Trim(),
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }

        if (entities.Count == 0)
        {
            return new UpsertChatWrappedKeysResult { Success = true };
        }

        var normalizedFingerprint = request.KeyFingerprint?.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(normalizedFingerprint) && !FingerprintRegex.IsMatch(normalizedFingerprint))
        {
            return new UpsertChatWrappedKeysResult
            {
                Success = false,
                ErrorMessage = "Invalid key fingerprint format.",
            };
        }

        var writeResult = await _repository.UpsertManyGuardedAsync(
            request.ChatId,
            request.ActorUserId,
            memberSet,
            entities,
            normalizedFingerprint,
            cancellationToken);
        return new UpsertChatWrappedKeysResult
        {
            Success = writeResult.Success,
            ErrorMessage = writeResult.ErrorMessage,
        };
    }
}
