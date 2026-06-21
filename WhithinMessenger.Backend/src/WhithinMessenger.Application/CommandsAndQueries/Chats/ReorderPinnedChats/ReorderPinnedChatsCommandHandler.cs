using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.ReorderPinnedChats;

public class ReorderPinnedChatsCommandHandler : IRequestHandler<ReorderPinnedChatsCommand, ReorderPinnedChatsResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IUserListCacheService _userListCache;

    public ReorderPinnedChatsCommandHandler(IChatRepository chatRepository, IUserListCacheService userListCache)
    {
        _chatRepository = chatRepository;
        _userListCache = userListCache;
    }

    public async Task<ReorderPinnedChatsResult> Handle(
        ReorderPinnedChatsCommand request,
        CancellationToken cancellationToken)
    {
        var updated = await _chatRepository.ReorderPinnedChatsAsync(
            request.UserId,
            request.ChatIds,
            cancellationToken);

        if (!updated)
        {
            return new ReorderPinnedChatsResult
            {
                Success = false,
                ErrorMessage = "Не удалось изменить порядок закреплённых чатов",
            };
        }

        await _userListCache.InvalidateUserChatsAsync(request.UserId, cancellationToken);

        return new ReorderPinnedChatsResult { Success = true };
    }
}
