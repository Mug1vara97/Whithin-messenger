using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;
using System.Data;

namespace WhithinMessenger.Infrastructure.Repositories;

public class ChatE2eKeyRepository : IChatE2eKeyRepository
{
    private readonly WithinDbContext _context;

    public ChatE2eKeyRepository(WithinDbContext context)
    {
        _context = context;
    }

    public Task<ChatE2eWrappedKey?> GetForUserAsync(
        Guid chatId,
        Guid userId,
        string deviceId = "default",
        CancellationToken cancellationToken = default)
    {
        return _context.ChatE2eWrappedKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(
                k => k.ChatId == chatId && k.UserId == userId && k.DeviceId == deviceId,
                cancellationToken);
    }

    public async Task<IReadOnlyList<Guid>> GetRecipientUserIdsAsync(
        Guid chatId,
        CancellationToken cancellationToken = default)
    {
        return await _context.ChatE2eWrappedKeys
            .AsNoTracking()
            .Where(k => k.ChatId == chatId)
            .Select(k => k.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task UpsertManyAsync(
        Guid chatId,
        IReadOnlyList<ChatE2eWrappedKey> keys,
        CancellationToken cancellationToken = default)
    {
        foreach (var key in keys)
        {
            var existing = await _context.ChatE2eWrappedKeys
                .FirstOrDefaultAsync(
                    k => k.ChatId == chatId
                         && k.UserId == key.UserId
                         && k.DeviceId == key.DeviceId,
                    cancellationToken);

            if (existing == null)
            {
                _context.ChatE2eWrappedKeys.Add(key);
            }
            else
            {
                existing.WrappedKeyBase64 = key.WrappedKeyBase64;
                existing.UpdatedAt = key.UpdatedAt;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<(bool Success, string? ErrorMessage)> UpsertManyGuardedAsync(
        Guid chatId,
        Guid actorUserId,
        IReadOnlyCollection<Guid> memberUserIds,
        IReadOnlyList<ChatE2eWrappedKey> keys,
        string? keyFingerprint = null,
        bool forceReset = false,
        CancellationToken cancellationToken = default)
    {
        var memberSet = memberUserIds.ToHashSet();
        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var normalizedFingerprint = keyFingerprint?.Trim().ToLowerInvariant();
        string? existingFingerprint = null;
        if (!forceReset)
        {
            existingFingerprint = await _context.ChatE2eWrappedKeys
                .AsNoTracking()
                .Where(k => k.ChatId == chatId && k.ChatKeyFingerprint != null)
                .Select(k => k.ChatKeyFingerprint)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(normalizedFingerprint)
            && !string.IsNullOrWhiteSpace(existingFingerprint)
            && !string.Equals(existingFingerprint, normalizedFingerprint, StringComparison.OrdinalIgnoreCase))
        {
            await tx.RollbackAsync(cancellationToken);
            return (false, "Conflicting chat key fingerprint detected. Refresh key state and retry.");
        }
        var effectiveFingerprint = !string.IsNullOrWhiteSpace(normalizedFingerprint)
            ? normalizedFingerprint
            : existingFingerprint?.Trim().ToLowerInvariant();

        var existingRecipients = await _context.ChatE2eWrappedKeys
            .AsNoTracking()
            .Where(k => k.ChatId == chatId && memberSet.Contains(k.UserId))
            .Select(k => k.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var requestRecipients = keys.Select(k => k.UserId).Distinct().ToHashSet();
        var selfOnlyRequest = requestRecipients.Count == 1 && requestRecipients.Contains(actorUserId);

        // If the chat key is already established, reject self-only writes to avoid split-brain
        // regressions from stale client audiences.
        if (existingRecipients.Count > 0 && selfOnlyRequest)
        {
            await tx.RollbackAsync(cancellationToken);
            return (false, "Chat key already established for this chat. Request full audience re-sync.");
        }

        // For first bootstrap we require at least actor + one peer recipient.
        if (existingRecipients.Count == 0 && selfOnlyRequest)
        {
            await tx.RollbackAsync(cancellationToken);
            return (false, "Bootstrap requires at least one peer recipient.");
        }

        if (forceReset)
        {
            if (!requestRecipients.Contains(actorUserId))
            {
                await tx.RollbackAsync(cancellationToken);
                return (false, "Force reset requires actor recipient wrap.");
            }

            var hasPeerRecipient = requestRecipients.Any(id => id != actorUserId);
            if (!hasPeerRecipient)
            {
                await tx.RollbackAsync(cancellationToken);
                return (false, "Force reset requires at least one peer recipient.");
            }

            if (string.IsNullOrWhiteSpace(normalizedFingerprint))
            {
                await tx.RollbackAsync(cancellationToken);
                return (false, "Force reset requires key fingerprint.");
            }

            var staleRows = await _context.ChatE2eWrappedKeys
                .Where(k => k.ChatId == chatId)
                .ToListAsync(cancellationToken);

            if (staleRows.Count > 0)
            {
                _context.ChatE2eWrappedKeys.RemoveRange(staleRows);
                await _context.SaveChangesAsync(cancellationToken);
            }

            effectiveFingerprint = normalizedFingerprint;
        }

        foreach (var key in keys)
        {
            var existing = await _context.ChatE2eWrappedKeys
                .FirstOrDefaultAsync(
                    k => k.ChatId == chatId
                         && k.UserId == key.UserId
                         && k.DeviceId == key.DeviceId,
                    cancellationToken);

            if (existing == null)
            {
                key.ChatKeyFingerprint = effectiveFingerprint;
                _context.ChatE2eWrappedKeys.Add(key);
            }
            else
            {
                existing.WrappedKeyBase64 = key.WrappedKeyBase64;
                existing.UpdatedAt = key.UpdatedAt;
                if (!string.IsNullOrWhiteSpace(effectiveFingerprint))
                {
                    existing.ChatKeyFingerprint = effectiveFingerprint;
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return (true, null);
    }

    public async Task<IReadOnlyList<Guid>> GetChatIdsForUserDeviceAsync(
        Guid userId,
        string deviceId,
        CancellationToken cancellationToken = default)
    {
        var normalizedDeviceId = deviceId.Trim();
        return await _context.ChatE2eWrappedKeys
            .AsNoTracking()
            .Where(k => k.UserId == userId && k.DeviceId == normalizedDeviceId)
            .Select(k => k.ChatId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task DeleteForUserDeviceAsync(
        Guid userId,
        string deviceId,
        CancellationToken cancellationToken = default)
    {
        var normalizedDeviceId = deviceId.Trim();
        var staleWraps = await _context.ChatE2eWrappedKeys
            .Where(k => k.UserId == userId && k.DeviceId == normalizedDeviceId)
            .ToListAsync(cancellationToken);

        if (staleWraps.Count == 0)
        {
            return;
        }

        _context.ChatE2eWrappedKeys.RemoveRange(staleWraps);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
