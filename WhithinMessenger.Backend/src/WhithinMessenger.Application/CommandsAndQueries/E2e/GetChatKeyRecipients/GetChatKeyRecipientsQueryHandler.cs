using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatKeyRecipients;

public class GetChatKeyRecipientsQueryHandler : IRequestHandler<GetChatKeyRecipientsQuery, GetChatKeyRecipientsResult>
{
    private readonly IChatE2eKeyRepository _repository;
    private readonly IChatRepository _chatRepository;

    public GetChatKeyRecipientsQueryHandler(
        IChatE2eKeyRepository repository,
        IChatRepository chatRepository)
    {
        _repository = repository;
        _chatRepository = chatRepository;
    }

    public async Task<GetChatKeyRecipientsResult> Handle(
        GetChatKeyRecipientsQuery request,
        CancellationToken cancellationToken)
    {
        var members = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
        if (!members.Contains(request.UserId))
        {
            return new GetChatKeyRecipientsResult
            {
                Success = false,
                ErrorMessage = "Access denied",
            };
        }

        var userIds = await _repository.GetRecipientUserIdsAsync(request.ChatId, cancellationToken);
        return new GetChatKeyRecipientsResult
        {
            Success = true,
            UserIds = userIds,
        };
    }
}
