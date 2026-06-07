using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.LeaveGroupChat;

public class LeaveGroupChatCommandHandler : IRequestHandler<LeaveGroupChatCommand, LeaveGroupChatResult>
{
    private readonly IChatRepository _chatRepository;

    public LeaveGroupChatCommandHandler(IChatRepository chatRepository)
    {
        _chatRepository = chatRepository;
    }

    public async Task<LeaveGroupChatResult> Handle(LeaveGroupChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new LeaveGroupChatResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            if (chat.Type?.TypeName is not "Group")
            {
                return new LeaveGroupChatResult { Success = false, ErrorMessage = "Можно покинуть только групповой чат" };
            }

            var isParticipant = await _chatRepository.IsUserParticipantAsync(request.ChatId, request.UserId, cancellationToken);
            if (!isParticipant)
            {
                return new LeaveGroupChatResult { Success = false, ErrorMessage = "Вы не являетесь участником этого чата" };
            }

            var creatorId = await _chatRepository.GetGroupCreatorUserIdAsync(request.ChatId, cancellationToken);
            if (creatorId == request.UserId)
            {
                return new LeaveGroupChatResult
                {
                    Success = false,
                    ErrorMessage = "Создатель не может покинуть группу. Удалите чат."
                };
            }

            var removed = await _chatRepository.RemoveMemberFromGroupAsync(request.ChatId, request.UserId, cancellationToken);
            if (!removed)
            {
                return new LeaveGroupChatResult { Success = false, ErrorMessage = "Не удалось покинуть группу" };
            }

            return new LeaveGroupChatResult { Success = true };
        }
        catch (Exception ex)
        {
            return new LeaveGroupChatResult { Success = false, ErrorMessage = $"Ошибка при выходе из группы: {ex.Message}" };
        }
    }
}
