using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers.DeleteServer;

public class DeleteServerCommandHandler : IRequestHandler<DeleteServerCommand, DeleteServerResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ICategoryRepository _categoryRepository;

    public DeleteServerCommandHandler(
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository,
        IChatRepository chatRepository,
        ICategoryRepository categoryRepository)
    {
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
        _chatRepository = chatRepository;
        _categoryRepository = categoryRepository;
    }

    public async Task<DeleteServerResult> Handle(DeleteServerCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new DeleteServerResult(false, "Сервер не найден");
            }

            if (server.OwnerId != request.UserId)
            {
                return new DeleteServerResult(false, "Только владелец сервера может его удалить");
            }

            await _serverMemberRepository.RemoveAllMembersAsync(request.ServerId, cancellationToken);

            await _chatRepository.DeleteAllByServerIdAsync(request.ServerId, cancellationToken);

            await _categoryRepository.DeleteAllByServerIdAsync(request.ServerId, cancellationToken);

            await _serverRepository.DeleteAsync(request.ServerId, cancellationToken);

            return new DeleteServerResult(true, null);
        }
        catch (Exception ex)
        {
            return new DeleteServerResult(false, $"Произошла ошибка при удалении сервера: {ex.Message}");
        }
    }
}
