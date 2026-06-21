using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.SetChatPin;

public class SetChatPinCommandHandler : IRequestHandler<SetChatPinCommand, SetChatPinResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IUserListCacheService _userListCache;

    public SetChatPinCommandHandler(IChatRepository chatRepository, IUserListCacheService userListCache)
    {
        _chatRepository = chatRepository;
        _userListCache = userListCache;
    }

    public async Task<SetChatPinResult> Handle(SetChatPinCommand request, CancellationToken cancellationToken)
    {
        var isParticipant = await _chatRepository.IsUserParticipantAsync(
            request.ChatId,
            request.UserId,
            cancellationToken);

        if (!isParticipant)
        {
            return new SetChatPinResult
            {
                Success = false,
                ErrorMessage = "Вы не являетесь участником этого чата",
            };
        }

        var updated = await _chatRepository.SetChatPinnedAsync(
            request.UserId,
            request.ChatId,
            request.IsPinned,
            cancellationToken);

        if (!updated)
        {
            return new SetChatPinResult
            {
                Success = false,
                ErrorMessage = "Не удалось изменить закрепление чата",
            };
        }

        await _userListCache.InvalidateUserChatsAsync(request.UserId, cancellationToken);

        return new SetChatPinResult
        {
            Success = true,
            IsPinned = request.IsPinned,
            PinnedAt = request.IsPinned ? DateTimeOffset.UtcNow : null,
        };
    }
}
