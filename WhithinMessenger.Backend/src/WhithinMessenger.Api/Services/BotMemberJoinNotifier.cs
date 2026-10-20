using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Api.Services;

public class BotMemberJoinNotifier
{
    private readonly IUserRepository _userRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IBotEventForwarder _botEvents;

    public BotMemberJoinNotifier(
        IUserRepository userRepository,
        IServerRepository serverRepository,
        IBotEventForwarder botEvents)
    {
        _userRepository = userRepository;
        _serverRepository = serverRepository;
        _botEvents = botEvents;
    }

    public async Task NotifyAsync(Guid serverId, Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null || user.IsBot)
        {
            return;
        }

        var server = await _serverRepository.GetByIdAsync(serverId, cancellationToken);
        var username = UserDisplayNames.Resolve(user.UserProfile?.DisplayName, user.UserName);

        await _botEvents.ForwardMemberJoinedAsync(
            serverId,
            server?.Name,
            userId,
            username,
            cancellationToken);
    }
}
