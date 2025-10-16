using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.UpdateChatAvatar;

public class UpdateChatAvatarCommandHandler : IRequestHandler<UpdateChatAvatarCommand, UpdateChatAvatarResult>
{
    private readonly IChatRepository _chatRepository;

    public UpdateChatAvatarCommandHandler(IChatRepository chatRepository)
    {
        _chatRepository = chatRepository;
    }

    public async Task<UpdateChatAvatarResult> Handle(UpdateChatAvatarCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Получаем чат
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new UpdateChatAvatarResult
                {
                    Success = false,
                    ErrorMessage = "Чат не найден"
                };
            }

            // Проверяем, что пользователь является участником чата
            var members = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
            if (!members.Contains(request.UserId))
            {
                return new UpdateChatAvatarResult
                {
                    Success = false,
                    ErrorMessage = "У вас нет прав для изменения этого чата"
                };
            }

            // Обновляем аватар чата
            chat.Avatar = request.AvatarUrl;
            await _chatRepository.UpdateAsync(chat, cancellationToken);

            return new UpdateChatAvatarResult
            {
                Success = true
            };
        }
        catch (Exception ex)
        {
            return new UpdateChatAvatarResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}









