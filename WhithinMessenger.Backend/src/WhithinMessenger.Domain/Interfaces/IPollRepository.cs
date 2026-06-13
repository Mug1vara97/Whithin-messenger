using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces;

public interface IPollRepository
{
    Task<MessagePoll?> GetByMessageIdAsync(Guid messageId, CancellationToken cancellationToken = default);

    Task<MessagePoll?> GetByIdWithDetailsAsync(Guid pollId, CancellationToken cancellationToken = default);

    Task<MessagePoll> AddAsync(MessagePoll poll, CancellationToken cancellationToken = default);

    Task ReplaceVotesAsync(
        Guid pollId,
        Guid userId,
        IReadOnlyList<Guid> optionIds,
        CancellationToken cancellationToken = default);
}
