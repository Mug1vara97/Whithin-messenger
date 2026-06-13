using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.VotePoll;

public class VotePollCommandHandler : IRequestHandler<VotePollCommand, VotePollResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IPollRepository _pollRepository;
    private readonly IChatRepository _chatRepository;

    public VotePollCommandHandler(
        IMessageRepository messageRepository,
        IPollRepository pollRepository,
        IChatRepository chatRepository)
    {
        _messageRepository = messageRepository;
        _pollRepository = pollRepository;
        _chatRepository = chatRepository;
    }

    public async Task<VotePollResult> Handle(VotePollCommand request, CancellationToken cancellationToken)
    {
        var message = await _messageRepository.GetByIdAsync(request.MessageId, cancellationToken);
        if (message == null || message.ContentType != "poll" || message.Poll == null)
        {
            return new VotePollResult { Success = false, ErrorMessage = "Poll not found" };
        }

        var members = await _chatRepository.GetChatMembersAsync(message.ChatId, cancellationToken);
        if (!members.Contains(request.UserId))
        {
            return new VotePollResult { Success = false, ErrorMessage = "User not authorized" };
        }

        var optionIds = request.OptionIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? new List<Guid>();
        if (!message.Poll.AllowMultiple && optionIds.Count > 1)
        {
            optionIds = optionIds.Take(1).ToList();
        }

        await _pollRepository.ReplaceVotesAsync(message.Poll.Id, request.UserId, optionIds, cancellationToken);

        return new VotePollResult
        {
            Success = true,
            ChatId = message.ChatId,
            MessageId = message.Id,
        };
    }
}
