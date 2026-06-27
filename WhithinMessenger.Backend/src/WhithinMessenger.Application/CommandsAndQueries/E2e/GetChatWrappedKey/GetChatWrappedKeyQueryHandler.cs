using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.GetChatWrappedKey;

public class GetChatWrappedKeyQueryHandler : IRequestHandler<GetChatWrappedKeyQuery, GetChatWrappedKeyResult>
{
    private readonly IChatE2eKeyRepository _repository;
    private readonly IChatRepository _chatRepository;

    public GetChatWrappedKeyQueryHandler(
        IChatE2eKeyRepository repository,
        IChatRepository chatRepository)
    {
        _repository = repository;
        _chatRepository = chatRepository;
    }

    public async Task<GetChatWrappedKeyResult> Handle(GetChatWrappedKeyQuery request, CancellationToken cancellationToken)
    {
        var members = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
        if (!members.Contains(request.UserId))
        {
            return new GetChatWrappedKeyResult
            {
                Success = false,
                ErrorMessage = "Access denied",
            };
        }

        var key = await _repository.GetForUserAsync(
            request.ChatId,
            request.UserId,
            request.DeviceId,
            cancellationToken);

        if (key == null)
        {
            return new GetChatWrappedKeyResult
            {
                Success = false,
                ErrorMessage = "Chat E2E key not found",
            };
        }

        return new GetChatWrappedKeyResult
        {
            Success = true,
            WrappedKeyBase64 = key.WrappedKeyBase64,
            UpdatedAt = key.UpdatedAt,
        };
    }
}
