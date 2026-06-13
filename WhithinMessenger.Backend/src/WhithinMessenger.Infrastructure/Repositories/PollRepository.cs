using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class PollRepository : IPollRepository
{
    private readonly WithinDbContext _context;

    public PollRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<MessagePoll?> GetByMessageIdAsync(Guid messageId, CancellationToken cancellationToken = default)
    {
        return await ApplyIncludes(_context.MessagePolls.Where(p => p.MessageId == messageId))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<MessagePoll?> GetByIdWithDetailsAsync(Guid pollId, CancellationToken cancellationToken = default)
    {
        return await ApplyIncludes(_context.MessagePolls.Where(p => p.Id == pollId))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<MessagePoll> AddAsync(MessagePoll poll, CancellationToken cancellationToken = default)
    {
        _context.MessagePolls.Add(poll);
        await _context.SaveChangesAsync(cancellationToken);
        return poll;
    }

    public async Task ReplaceVotesAsync(
        Guid pollId,
        Guid userId,
        IReadOnlyList<Guid> optionIds,
        CancellationToken cancellationToken = default)
    {
        var poll = await ApplyIncludes(_context.MessagePolls.Where(p => p.Id == pollId))
            .FirstOrDefaultAsync(cancellationToken);

        if (poll == null)
        {
            return;
        }

        var validOptionIds = poll.Options.Select(o => o.Id).ToHashSet();
        var selectedOptionIds = optionIds.Where(validOptionIds.Contains).Distinct().ToList();

        var existingVotes = await _context.PollVotes
            .Where(v => v.UserId == userId && poll.Options.Select(o => o.Id).Contains(v.PollOptionId))
            .ToListAsync(cancellationToken);

        if (existingVotes.Count > 0)
        {
            _context.PollVotes.RemoveRange(existingVotes);
        }

        foreach (var optionId in selectedOptionIds)
        {
            _context.PollVotes.Add(new PollVote
            {
                Id = Guid.NewGuid(),
                PollOptionId = optionId,
                UserId = userId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    private static IQueryable<MessagePoll> ApplyIncludes(IQueryable<MessagePoll> query) =>
        query
            .Include(p => p.Options.OrderBy(o => o.SortOrder))
                .ThenInclude(o => o.Votes)
                    .ThenInclude(v => v.User)
                        .ThenInclude(u => u.UserProfile);
}
