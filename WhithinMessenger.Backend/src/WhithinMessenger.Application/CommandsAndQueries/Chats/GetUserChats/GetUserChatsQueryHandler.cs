using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetUserChats
{
    public class GetUserChatsQueryHandler : IRequestHandler<GetUserChatsQuery, GetUserChatsResult>
    {
        private readonly IChatRepository _chatRepository;
        private readonly IUserListCacheService _userListCache;

        public GetUserChatsQueryHandler(IChatRepository chatRepository, IUserListCacheService userListCache)
        {
            _chatRepository = chatRepository;
            _userListCache = userListCache;
        }

        public async Task<GetUserChatsResult> Handle(GetUserChatsQuery request, CancellationToken cancellationToken)
        {
            var cached = await _userListCache.GetUserChatsAsync(request.UserId, cancellationToken);
            if (cached != null)
            {
                return new GetUserChatsResult { Chats = cached };
            }

            var chats = await _chatRepository.GetUserChatsAsync(request.UserId, cancellationToken);
            await _userListCache.SetUserChatsAsync(request.UserId, chats, cancellationToken);
            return new GetUserChatsResult { Chats = chats };
        }
    }
}
