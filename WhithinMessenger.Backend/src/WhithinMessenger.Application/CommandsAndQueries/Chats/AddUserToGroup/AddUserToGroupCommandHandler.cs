using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.AddUserToGroup
{
    public class AddUserToGroupCommandHandler : IRequestHandler<AddUserToGroupCommand, AddUserToGroupResult>
    {
        private readonly IChatRepository _chatRepository;

        public AddUserToGroupCommandHandler(IChatRepository chatRepository)
        {
            _chatRepository = chatRepository;
        }

        public async Task<AddUserToGroupResult> Handle(AddUserToGroupCommand request, CancellationToken cancellationToken)
        {
            try
            {
                Console.WriteLine($"AddUserToGroup - GroupChatId: {request.GroupChatId}, UserId: {request.UserId}, CurrentUserId: {request.CurrentUserId}");
                
                var success = await _chatRepository.AddUserToGroupAsync(
                    request.GroupChatId, 
                    request.UserId, 
                    cancellationToken);
                
                if (success)
                {
                    Console.WriteLine($"AddUserToGroup - User {request.UserId} added to group {request.GroupChatId}");
                    return new AddUserToGroupResult
                    {
                        Success = true
                    };
                }
                else
                {
                    Console.WriteLine($"AddUserToGroup - Failed to add user {request.UserId} to group {request.GroupChatId}");
                    return new AddUserToGroupResult
                    {
                        Success = false,
                        ErrorMessage = "Не удалось добавить пользователя в группу"
                    };
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"AddUserToGroup - Error: {ex.Message}");
                return new AddUserToGroupResult
                {
                    Success = false,
                    ErrorMessage = "Произошла ошибка при добавлении пользователя в группу: " + ex.Message
                };
            }
        }
    }
}










