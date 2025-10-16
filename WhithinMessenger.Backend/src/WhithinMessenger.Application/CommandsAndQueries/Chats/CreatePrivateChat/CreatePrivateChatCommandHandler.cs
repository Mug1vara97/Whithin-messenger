using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.CreatePrivateChat
{
    public class CreatePrivateChatCommandHandler : IRequestHandler<CreatePrivateChatCommand, CreatePrivateChatResult>
    {
        private readonly IChatRepository _chatRepository;

        public CreatePrivateChatCommandHandler(IChatRepository chatRepository)
        {
            _chatRepository = chatRepository;
        }

        public async Task<CreatePrivateChatResult> Handle(CreatePrivateChatCommand request, CancellationToken cancellationToken)
        {
            var result = await _chatRepository.CreatePrivateChatAsync(request.UserId, request.TargetUserId, cancellationToken);
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
