using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetUserChats
{
    public class GetUserChatsQueryHandler : IRequestHandler<GetUserChatsQuery, GetUserChatsResult>
    {
        private readonly IChatRepository _chatRepository;

        public GetUserChatsQueryHandler(IChatRepository chatRepository)
        {
            _chatRepository = chatRepository;
        }

        public async Task<GetUserChatsResult> Handle(GetUserChatsQuery request, CancellationToken cancellationToken)
        {
            var chats = await _chatRepository.GetUserChatsAsync(request.UserId, cancellationToken);
            return new GetUserChatsResult { Chats = chats };
        }
    }
}
