using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetAvailableUsers
{
    public class GetAvailableUsersQueryHandler : IRequestHandler<GetAvailableUsersQuery, GetAvailableUsersResult>
    {
        private readonly IChatRepository _chatRepository;

        public GetAvailableUsersQueryHandler(IChatRepository chatRepository)
        {
            _chatRepository = chatRepository;
        }

        public async Task<GetAvailableUsersResult> Handle(GetAvailableUsersQuery request, CancellationToken cancellationToken)
        {
            try
            {
                Console.WriteLine($"🔍 GetAvailableUsers - GroupChatId: {request.GroupChatId}, CurrentUserId: {request.CurrentUserId}");
                
                var availableUsers = await _chatRepository.GetAvailableUsersForGroupAsync(
                    request.CurrentUserId, 
                    request.GroupChatId, 
                    cancellationToken);
                
                Console.WriteLine($"✅ GetAvailableUsers - Found {availableUsers.Count} available users");
                foreach (var user in availableUsers)
                {
                    Console.WriteLine($"  - {user.Username} (ID: {user.UserId})");
                }

                return new GetAvailableUsersResult
                {
                    Success = true,
                    AvailableUsers = availableUsers
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ GetAvailableUsers - Error: {ex.Message}");
                return new GetAvailableUsersResult
                {
                    Success = false,
                    ErrorMessage = "Произошла ошибка при получении доступных пользователей: " + ex.Message
                };
            }
        }
    }
}










