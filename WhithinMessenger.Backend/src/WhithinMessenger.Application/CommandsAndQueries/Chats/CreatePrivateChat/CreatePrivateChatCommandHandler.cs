using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.CreatePrivateChat
{
    public class CreatePrivateChatCommandHandler : IRequestHandler<CreatePrivateChatCommand, CreatePrivateChatResult>
    {
        private readonly IChatRepository _chatRepository;
        private readonly IUserListCacheService _userListCache;

        public CreatePrivateChatCommandHandler(IChatRepository chatRepository, IUserListCacheService userListCache)
        {
            _chatRepository = chatRepository;
            _userListCache = userListCache;
        }

        public async Task<CreatePrivateChatResult> Handle(CreatePrivateChatCommand request, CancellationToken cancellationToken)
        {
            var result = await _chatRepository.CreatePrivateChatAsync(request.UserId, request.TargetUserId, cancellationToken);

            if (result.Success)
            {
                await _userListCache.InvalidateUserChatsAsync(
                    [request.UserId, request.TargetUserId],
                    cancellationToken);
            }

            return new CreatePrivateChatResult
            {
                ChatId = result.ChatId,
                Exists = result.Exists,
                Success = result.Success,
                ErrorMessage = result.ErrorMessage
            };
        }
    }
}
