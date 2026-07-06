using MediatR;
using Microsoft.Extensions.Logging;
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
    private readonly ILogger<UpsertChatWrappedKeysCommandHandler> _logger;

    public UpsertChatWrappedKeysCommandHandler(
        IChatE2eKeyRepository repository,
        IChatRepository chatRepository,
        ILogger<UpsertChatWrappedKeysCommandHandler> logger)
    {
        _repository = repository;
        _chatRepository = chatRepository;
        _logger = logger;
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
            _logger.LogWarning(
                "E2E upsert rejected: invalid key fingerprint format actor={ActorUserId} chat={ChatId}",
                request.ActorUserId,
                request.ChatId);
            return new UpsertChatWrappedKeysResult
            {
                Success = false,
                ErrorMessage = "Invalid key fingerprint format.",
            };
        }

        _logger.LogDebug(
            "E2E upsert start actor={ActorUserId} chat={ChatId} wraps={WrapCount} memberCount={MemberCount} hasFingerprint={HasFingerprint} forceReset={ForceReset}",
            request.ActorUserId,
            request.ChatId,
            entities.Count,
            memberSet.Count,
            !string.IsNullOrWhiteSpace(normalizedFingerprint),
            request.ForceReset);

        var writeResult = await _repository.UpsertManyGuardedAsync(
            request.ChatId,
            request.ActorUserId,
            memberSet,
            entities,
            normalizedFingerprint,
            request.ForceReset,
            cancellationToken);
        if (!writeResult.Success)
        {
            _logger.LogWarning(
                "E2E upsert rejected actor={ActorUserId} chat={ChatId} reason={Reason}",
                request.ActorUserId,
                request.ChatId,
                writeResult.ErrorMessage);
        }
        else
        {
            _logger.LogDebug(
                "E2E upsert success actor={ActorUserId} chat={ChatId} wraps={WrapCount}",
                request.ActorUserId,
                request.ChatId,
                entities.Count);
        }
        return new UpsertChatWrappedKeysResult
        {
            Success = writeResult.Success,
            ErrorMessage = writeResult.ErrorMessage,
        };
    }
}
