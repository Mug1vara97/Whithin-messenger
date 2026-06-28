using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

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
