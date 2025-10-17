using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public interface IUserRepository
    {
        Task<ApplicationUser?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<ApplicationUser?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default);
    }
}