using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public interface IChatMemberRepository
    {
        Task<Member?> GetByIdAsync(Guid memberId, CancellationToken cancellationToken = default);
        Task<List<Member>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default);
        Task<List<Member>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<Member> CreateAsync(Member member, CancellationToken cancellationToken = default);
        Task<Member> UpdateAsync(Member member, CancellationToken cancellationToken = default);
        Task DeleteAsync(Guid memberId, CancellationToken cancellationToken = default);
        Task<bool> IsMemberAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default);
        Task AddRangeAsync(IEnumerable<Member> members, CancellationToken cancellationToken = default);
    }
}
