using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers.LeaveServer;

public class LeaveServerCommandHandler : IRequestHandler<LeaveServerCommand, LeaveServerResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;

    public LeaveServerCommandHandler(
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository)
    {
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
    }

    public async Task<LeaveServerResult> Handle(LeaveServerCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Проверяем существование сервера
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new LeaveServerResult(false, "Сервер не найден");
            }

            // Проверяем, что пользователь является участником сервера
            var isMember = await _serverMemberRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken);
            if (!isMember)
            {
                return new LeaveServerResult(false, "Вы не являетесь участником этого сервера");
            }

            // Проверяем, что пользователь не является владельцем сервера
            if (server.OwnerId == request.UserId)
            {
                return new LeaveServerResult(false, "Владелец сервера не может покинуть сервер. Используйте удаление сервера.");
            }

            // Удаляем пользователя из участников сервера
            await _serverMemberRepository.DeleteByServerAndUserAsync(request.ServerId, request.UserId, cancellationToken);

            return new LeaveServerResult(true, null);
        }
        catch (Exception ex)
        {
            return new LeaveServerResult(false, $"Произошла ошибка при покидании сервера: {ex.Message}");
        }
    }
}
