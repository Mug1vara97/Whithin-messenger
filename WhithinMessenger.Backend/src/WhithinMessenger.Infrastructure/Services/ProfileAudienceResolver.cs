using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Services;

internal sealed class ProfileAudienceResolver : IProfileAudienceResolver
{
    private readonly WithinDbContext _context;

    public ProfileAudienceResolver(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<HashSet<Guid>> GetAudienceUserIdsAsync(
        Guid profileUserId,
        CancellationToken cancellationToken = default)
    {
        var audience = new HashSet<Guid> { profileUserId };

        var friendIds = await _context.Friendships
            .AsNoTracking()
            .Where(f =>
                f.Status == FriendshipStatus.Accepted &&
                (f.RequesterId == profileUserId || f.AddresseeId == profileUserId))
            .Select(f => f.RequesterId == profileUserId ? f.AddresseeId : f.RequesterId)
            .ToListAsync(cancellationToken);

        foreach (var friendId in friendIds)
        {
            audience.Add(friendId);
        }

        var chatMateIds = await _context.Members
            .AsNoTracking()
            .Where(m =>
                m.UserId == profileUserId &&
                (m.Chat.Type.TypeName == "Private" || m.Chat.Type.TypeName == "Group"))
            .SelectMany(m =>
                m.Chat.Members
                    .Where(other => other.UserId != profileUserId)
                    .Select(other => other.UserId))
            .Distinct()
            .ToListAsync(cancellationToken);

        foreach (var mateId in chatMateIds)
        {
            audience.Add(mateId);
        }

        var serverMateIds = await _context.ServerMembers
            .AsNoTracking()
            .Where(sm => sm.UserId == profileUserId)
            .SelectMany(sm =>
                _context.ServerMembers
                    .Where(other => other.ServerId == sm.ServerId && other.UserId != profileUserId)
                    .Select(other => other.UserId))
            .Distinct()
            .ToListAsync(cancellationToken);

        foreach (var serverMateId in serverMateIds)
        {
            audience.Add(serverMateId);
        }

        return audience;
    }
}
