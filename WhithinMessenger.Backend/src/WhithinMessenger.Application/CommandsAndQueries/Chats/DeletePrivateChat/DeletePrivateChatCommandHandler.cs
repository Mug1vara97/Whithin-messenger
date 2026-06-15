using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.DeletePrivateChat;

public class DeletePrivateChatCommandHandler : IRequestHandler<DeletePrivateChatCommand, DeletePrivateChatResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IUserListCacheService _userListCache;

    public DeletePrivateChatCommandHandler(IChatRepository chatRepository, IUserListCacheService userListCache)
    {
        _chatRepository = chatRepository;
        _userListCache = userListCache;
    }

    public async Task<DeletePrivateChatResult> Handle(DeletePrivateChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new DeletePrivateChatResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            var isParticipant = await _chatRepository.IsUserParticipantAsync(request.ChatId, request.UserId, cancellationToken);
            if (!isParticipant)
            {
                return new DeletePrivateChatResult { Success = false, ErrorMessage = "Вы не являетесь участником этого чата" };
            }

            var participants = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);

            await _chatRepository.DeleteAsync(request.ChatId, cancellationToken);

            await _userListCache.InvalidateUserChatsAsync(participants, cancellationToken);

            return new DeletePrivateChatResult { Success = true, Participants = participants };
        }
        catch (Exception ex)
        {
            return new DeletePrivateChatResult { Success = false, ErrorMessage = $"Ошибка при удалении чата: {ex.Message}" };
        }
    }
}

