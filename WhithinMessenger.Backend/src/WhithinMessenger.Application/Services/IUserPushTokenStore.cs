namespace WhithinMessenger.Application.Services;

public interface IUserPushTokenStore
{
    Task SaveTokenAsync(
        Guid userId,
        string deviceId,
        string token,
        CancellationToken cancellationToken = default
    );

    Task RemoveTokenAsync(
        Guid userId,
        string deviceId,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<string>> GetTokensAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );
}
