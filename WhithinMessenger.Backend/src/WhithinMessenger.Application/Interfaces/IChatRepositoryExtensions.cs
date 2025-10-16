using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.Interfaces
{
    public interface IChatRepositoryExtensions
    {
        Task<ChatInfoDto?> GetChatInfoAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default);
    }
}

