using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IChatE2eKeyRepository
{
    Task<ChatE2eWrappedKey?> GetForUserAsync(
        Guid chatId,
        Guid userId,
        string deviceId = "default",
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetRecipientUserIdsAsync(
        Guid chatId,
        CancellationToken cancellationToken = default);

    Task UpsertManyAsync(
        Guid chatId,
        IReadOnlyList<ChatE2eWrappedKey> keys,
        CancellationToken cancellationToken = default);
}
