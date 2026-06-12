using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IIdeaBoardRepository
{
    Task<List<IdeaBoardCard>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default);

    Task<IdeaBoardCard?> GetByIdAsync(Guid cardId, CancellationToken cancellationToken = default);

    Task CreateAsync(IdeaBoardCard card, CancellationToken cancellationToken = default);

    Task UpdateAsync(IdeaBoardCard card, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid cardId, CancellationToken cancellationToken = default);
}
