using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public class PollDto
{
    public Guid Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public bool AllowMultiple { get; set; }
    public bool IsAnonymous { get; set; }
    public List<PollOptionDto> Options { get; set; } = new();
    public List<Guid> VotedOptionIds { get; set; } = new();
    public int TotalVotes { get; set; }
}

public class PollOptionDto
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int VoteCount { get; set; }
    public List<PollVoterDto> Voters { get; set; } = new();
}

public class PollVoterDto
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? AvatarColor { get; set; }
}

public static class PollDtoMapper
{
    public static PollDto? Map(MessagePoll? poll, Guid? viewerUserId = null)
    {
        if (poll == null)
        {
            return null;
        }

        var options = poll.Options
            .OrderBy(o => o.SortOrder)
            .Select(o => new PollOptionDto
            {
                Id = o.Id,
                Text = o.Text,
                SortOrder = o.SortOrder,
                VoteCount = o.Votes?.Count ?? 0,
                Voters = poll.IsAnonymous
                    ? new List<PollVoterDto>()
                    : (o.Votes ?? Array.Empty<PollVote>())
                        .Select(v => new PollVoterDto
                        {
                            UserId = v.UserId,
                            Username = v.User?.UserName ?? "Unknown",
                            AvatarUrl = v.User?.UserProfile?.Avatar,
                            AvatarColor = v.User?.UserProfile?.AvatarColor,
                        })
                        .OrderBy(v => v.Username, StringComparer.OrdinalIgnoreCase)
                        .ToList(),
            })
            .ToList();

        var votedOptionIds = viewerUserId.HasValue
            ? options
                .Where(o => poll.Options.Any(opt =>
                    opt.Id == o.Id &&
                    opt.Votes.Any(v => v.UserId == viewerUserId.Value)))
                .Select(o => o.Id)
                .ToList()
            : new List<Guid>();

        return new PollDto
        {
            Id = poll.Id,
            Question = poll.Question,
            AllowMultiple = poll.AllowMultiple,
            IsAnonymous = poll.IsAnonymous,
            Options = options,
            VotedOptionIds = votedOptionIds,
            TotalVotes = options.Sum(o => o.VoteCount),
        };
    }
}
