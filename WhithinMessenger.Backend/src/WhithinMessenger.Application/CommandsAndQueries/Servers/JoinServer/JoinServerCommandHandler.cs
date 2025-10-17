using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class JoinServerCommandHandler : IRequestHandler<JoinServerCommand, JoinServerResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;

    public JoinServerCommandHandler(IServerRepository serverRepository, IServerMemberRepository serverMemberRepository)
    {
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
    }

    public async Task<JoinServerResult> Handle(JoinServerCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new JoinServerResult
                {
                    Success = false,
                    ErrorMessage = "Сервер не найден"
                };
            }

            if (!server.IsPublic)
            {
                return new JoinServerResult
                {
                    Success = false,
                    ErrorMessage = "Этот сервер не является публичным"
                };
            }

            var isAlreadyMember = await _serverMemberRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken);
            if (isAlreadyMember)
            {
                return new JoinServerResult
                {
                    Success = false,
                    ErrorMessage = "Вы уже являетесь участником этого сервера"
                };
            }

            var serverMember = new ServerMember
            {
                ServerId = request.ServerId,
                UserId = request.UserId,
                JoinedAt = DateTimeOffset.UtcNow
            };

            await _serverMemberRepository.AddAsync(serverMember, cancellationToken);

            return new JoinServerResult
            {
                Success = true
            };
        }
        catch (Exception ex)
        {
            return new JoinServerResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}


















