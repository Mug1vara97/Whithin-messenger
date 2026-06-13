export const normalizePoll = (poll) => {
  if (!poll) return null;
  return {
    id: poll.id ?? poll.Id,
    question: poll.question ?? poll.Question ?? '',
    allowMultiple: Boolean(poll.allowMultiple ?? poll.AllowMultiple),
    isAnonymous: Boolean(poll.isAnonymous ?? poll.IsAnonymous ?? true),
    totalVotes: poll.totalVotes ?? poll.TotalVotes ?? 0,
    votedOptionIds: (poll.votedOptionIds ?? poll.VotedOptionIds ?? []).map(String),
    options: (poll.options ?? poll.Options ?? []).map((option) => ({
      id: option.id ?? option.Id,
      text: option.text ?? option.Text ?? '',
      sortOrder: option.sortOrder ?? option.SortOrder ?? 0,
      voteCount: option.voteCount ?? option.VoteCount ?? 0,
      voters: (option.voters ?? option.Voters ?? []).map((voter) => ({
        userId: voter.userId ?? voter.UserId,
        username: voter.username ?? voter.Username ?? '',
        avatarUrl: voter.avatarUrl ?? voter.AvatarUrl ?? null,
        avatarColor: voter.avatarColor ?? voter.AvatarColor ?? null,
      })),
    })),
  };
};

export const formatVotesLabel = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} голос`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} голоса`;
  return `${count} голосов`;
};

export const getPollTotalVotes = (poll) => (
  poll.totalVotes || poll.options.reduce((sum, option) => sum + option.voteCount, 0)
);

export const getPollOptionPercent = (voteCount, totalVotes) => (
  totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
);
