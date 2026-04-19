using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class JoinServerCommandHandler : IRequestHandler<JoinServerCommand, JoinServerResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IUserRepository _userRepository;

    public JoinServerCommandHandler(
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository,
        IChatRepository chatRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository)
    {
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
        _chatRepository = chatRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
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

            // Auto-join user to all existing public channels on server join.
            var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
            if (user != null)
            {
                var serverChats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
                var publicChats = serverChats.Where(c => !c.IsPrivate).ToList();
                var membersToAdd = new List<Member>();

                foreach (var chat in publicChats)
                {
                    var alreadyInChat = await _chatMemberRepository.IsMemberAsync(chat.Id, request.UserId, cancellationToken);
                    if (alreadyInChat) continue;

                    membersToAdd.Add(new Member
                    {
                        Id = Guid.NewGuid(),
                        ChatId = chat.Id,
                        UserId = request.UserId,
                        JoinedAt = DateTimeOffset.UtcNow,
                        Chat = chat,
                        User = user
                    });
                }

                if (membersToAdd.Count > 0)
                {
                    await _chatMemberRepository.AddRangeAsync(membersToAdd, cancellationToken);
                }
            }

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


















