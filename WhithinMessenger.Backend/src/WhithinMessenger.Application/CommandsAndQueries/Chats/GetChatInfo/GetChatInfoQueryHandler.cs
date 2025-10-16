using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Application.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatInfo;

public class GetChatInfoQueryHandler : IRequestHandler<GetChatInfoQuery, GetChatInfoResult>
{
    private readonly IChatRepositoryExtensions _chatRepository;
    private readonly IUserProfileRepository _userProfileRepository;

    public GetChatInfoQueryHandler(IChatRepositoryExtensions chatRepository, IUserProfileRepository userProfileRepository)
    {
        _chatRepository = chatRepository;
        _userProfileRepository = userProfileRepository;
    }

    public async Task<GetChatInfoResult> Handle(GetChatInfoQuery request, CancellationToken cancellationToken)
    {
        try
        {
            // Получаем информацию о чате
            var chatInfo = await _chatRepository.GetChatInfoAsync(request.ChatId, request.UserId, cancellationToken);
            
            if (chatInfo == null)
            {
                return new GetChatInfoResult
                {
                    Success = false,
                    ErrorMessage = "Чат не найден"
                };
            }

            return new GetChatInfoResult
            {
                Success = true,
                ChatInfo = chatInfo
            };
        }
        catch (Exception ex)
        {
            return new GetChatInfoResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}








