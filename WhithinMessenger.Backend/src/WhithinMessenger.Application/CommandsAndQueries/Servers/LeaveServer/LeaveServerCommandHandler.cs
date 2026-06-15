using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers.LeaveServer;

public class LeaveServerCommandHandler : IRequestHandler<LeaveServerCommand, LeaveServerResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IUserListCacheService _userListCache;

    public LeaveServerCommandHandler(
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository,
        IUserListCacheService userListCache)
    {
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
        _userListCache = userListCache;
    }

    public async Task<LeaveServerResult> Handle(LeaveServerCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new LeaveServerResult(false, "Сервер не найден");
            }

            var isMember = await _serverMemberRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken);
            if (!isMember)
            {
                return new LeaveServerResult(false, "Вы не являетесь участником этого сервера");
            }

            if (server.OwnerId == request.UserId)
            {
                return new LeaveServerResult(false, "Владелец сервера не может покинуть сервер. Используйте удаление сервера.");
            }

            await _serverMemberRepository.DeleteByServerAndUserAsync(request.ServerId, request.UserId, cancellationToken);

            await _userListCache.InvalidateUserServersAsync(request.UserId, cancellationToken);

            return new LeaveServerResult(true, null);
        }
        catch (Exception ex)
        {
            return new LeaveServerResult(false, $"Произошла ошибка при покидании сервера: {ex.Message}");
        }
    }
}
