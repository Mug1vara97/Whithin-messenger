using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Application.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Users.SearchUsers
{
    public class SearchUsersQueryHandler : IRequestHandler<SearchUsersQuery, SearchUsersResult>
    {
        private readonly IUserRepositoryExtensions _userRepository;

        public SearchUsersQueryHandler(IUserRepositoryExtensions userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<SearchUsersResult> Handle(SearchUsersQuery request, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    Console.WriteLine($"SearchUsersQueryHandler: Getting users with existing chats for user {request.CurrentUserId}");
                    var usersWithChats = await _userRepository.GetUsersWithExistingChatsAsync(request.CurrentUserId, cancellationToken);
                    Console.WriteLine($"SearchUsersQueryHandler: Found {usersWithChats.Count} users with existing chats");
                    return new SearchUsersResult
                    {
                        Users = usersWithChats,
                        Success = true
                    };
                }

                var users = await _userRepository.SearchUsersAsync(request.CurrentUserId, request.Name, cancellationToken);

                return new SearchUsersResult
                {
                    Users = users,
                    Success = true
                };
            }
            catch (Exception ex)
            {
                return new SearchUsersResult
                {
                    Success = false,
                    ErrorMessage = "Произошла ошибка при поиске пользователей: " + ex.Message
                };
            }
        }
    }
}
