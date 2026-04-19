using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers.AddMember;

public class AddMemberCommandHandler : IRequestHandler<AddMemberCommand, AddMemberResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IChatMemberRepository _chatMemberRepository;

    public AddMemberCommandHandler(
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository,
        IUserRepository userRepository,
        IChatRepository chatRepository,
        IChatMemberRepository chatMemberRepository)
    {
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
        _userRepository = userRepository;
        _chatRepository = chatRepository;
        _chatMemberRepository = chatMemberRepository;
    }

    public async Task<AddMemberResult> Handle(AddMemberCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new AddMemberResult(false, "Сервер не найден");
            }

            var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
            if (user == null)
            {
                return new AddMemberResult(false, "Пользователь не найден");
            }

            var existingMember = await _serverMemberRepository.GetByServerAndUserAsync(request.ServerId, request.UserId, cancellationToken);
            if (existingMember != null)
            {
                return new AddMemberResult(false, "Пользователь уже является участником этого сервера");
            }

            var serverMember = new ServerMember
            {
                Id = Guid.NewGuid(),
                ServerId = request.ServerId,
                UserId = request.UserId,
                JoinedAt = DateTime.UtcNow
            };

            await _serverMemberRepository.AddAsync(serverMember, cancellationToken);
            await _serverMemberRepository.SaveChangesAsync(cancellationToken);

            // Ensure manually added members can read existing public channels immediately.
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

            return new AddMemberResult(true, null, serverMember.Id);
        }
        catch (Exception ex)
        {
            return new AddMemberResult(false, $"Произошла ошибка при добавлении участника: {ex.Message}");
        }
    }
}
