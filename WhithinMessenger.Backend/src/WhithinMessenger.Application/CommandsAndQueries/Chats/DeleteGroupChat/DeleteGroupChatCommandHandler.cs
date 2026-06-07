using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.DeleteGroupChat;

public class DeleteGroupChatCommandHandler : IRequestHandler<DeleteGroupChatCommand, DeleteGroupChatResult>
{
    private readonly IChatRepository _chatRepository;

    public DeleteGroupChatCommandHandler(IChatRepository chatRepository)
    {
        _chatRepository = chatRepository;
    }

    public async Task<DeleteGroupChatResult> Handle(DeleteGroupChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new DeleteGroupChatResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            if (chat.Type?.TypeName is not "Group")
            {
                return new DeleteGroupChatResult { Success = false, ErrorMessage = "Можно удалить только групповой чат" };
            }

            var creatorId = await _chatRepository.GetGroupCreatorUserIdAsync(request.ChatId, cancellationToken);
            if (creatorId != request.UserId)
            {
                return new DeleteGroupChatResult { Success = false, ErrorMessage = "Только создатель может удалить группу" };
            }

            var participants = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
            await _chatRepository.DeleteAsync(request.ChatId, cancellationToken);

            return new DeleteGroupChatResult
            {
                Success = true,
                ParticipantIds = participants
            };
        }
        catch (Exception ex)
        {
            return new DeleteGroupChatResult { Success = false, ErrorMessage = $"Ошибка при удалении группы: {ex.Message}" };
        }
    }
}
