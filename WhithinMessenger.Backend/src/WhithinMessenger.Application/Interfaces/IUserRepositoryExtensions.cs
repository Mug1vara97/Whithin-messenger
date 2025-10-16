using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.Interfaces
{
    public interface IUserRepositoryExtensions
    {
        Task<List<UserSearchInfo>> SearchUsersAsync(Guid currentUserId, string searchTerm, CancellationToken cancellationToken = default);
        Task<List<UserSearchInfo>> GetAllUsersAsync(Guid currentUserId, CancellationToken cancellationToken = default);
        Task<List<UserSearchInfo>> GetUsersWithExistingChatsAsync(Guid currentUserId, CancellationToken cancellationToken = default);
    }
}

