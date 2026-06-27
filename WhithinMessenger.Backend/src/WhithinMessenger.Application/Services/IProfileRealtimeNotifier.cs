using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public interface IProfileRealtimeNotifier
{
    Task NotifyUserProfileUpdatedAsync(
        Guid userId,
        UserProfile profile,
        ApplicationUser? user,
        IEnumerable<string>? changedFields = null,
        CancellationToken cancellationToken = default);
}
