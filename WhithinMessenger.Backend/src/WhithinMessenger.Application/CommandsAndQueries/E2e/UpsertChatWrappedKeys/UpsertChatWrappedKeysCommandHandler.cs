using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.E2e.UpsertChatWrappedKeys;

public class UpsertChatWrappedKeysCommandHandler
    : IRequestHandler<UpsertChatWrappedKeysCommand, UpsertChatWrappedKeysResult>
{
    private const int MaxWrappedKeyLength = 256;

    private readonly IChatE2eKeyRepository _repository;
    private readonly IChatRepository _chatRepository;

    public UpsertChatWrappedKeysCommandHandler(
        IChatE2eKeyRepository repository,
        IChatRepository chatRepository)
    {
        _repository = repository;
        _chatRepository = chatRepository;
    }

    public async Task<UpsertChatWrappedKeysResult> Handle(
        UpsertChatWrappedKeysCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Wraps.Count == 0)
        {
            return new UpsertChatWrappedKeysResult
            {
                Success = false,
                ErrorMessage = "No wrapped keys provided",
            };
        }

        var members = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
        if (!members.Contains(request.ActorUserId))
        {
            return new UpsertChatWrappedKeysResult
            {
                Success = false,
                ErrorMessage = "Access denied",
            };
        }

        var memberSet = members.ToHashSet();
        var entities = new List<ChatE2eWrappedKey>();

        foreach (var wrap in request.Wraps)
        {
            if (!memberSet.Contains(wrap.UserId))
            {
                return new UpsertChatWrappedKeysResult
                {
                    Success = false,
                    ErrorMessage = "Wrapped key target is not a chat member",
                };
            }

            if (string.IsNullOrWhiteSpace(wrap.WrappedKeyBase64)
                || wrap.WrappedKeyBase64.Length > MaxWrappedKeyLength)
            {
                return new UpsertChatWrappedKeysResult
                {
                    Success = false,
                    ErrorMessage = "Invalid wrapped key payload",
                };
            }

            entities.Add(new ChatE2eWrappedKey
            {
                ChatId = request.ChatId,
                UserId = wrap.UserId,
                DeviceId = string.IsNullOrWhiteSpace(wrap.DeviceId) ? "default" : wrap.DeviceId.Trim(),
                WrappedKeyBase64 = wrap.WrappedKeyBase64.Trim(),
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }

        await _repository.UpsertManyAsync(request.ChatId, entities, cancellationToken);

        return new UpsertChatWrappedKeysResult { Success = true };
    }
}
