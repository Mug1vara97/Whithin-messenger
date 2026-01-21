using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.RemoveFriend;

public class RemoveFriendCommandHandler : IRequestHandler<RemoveFriendCommand, RemoveFriendResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IHubContext<Hub> _hubContext;

    public RemoveFriendCommandHandler(
        IFriendshipRepository friendshipRepository,
        IHubContext<Hub> hubContext)
    {
        _friendshipRepository = friendshipRepository;
        _hubContext = hubContext;
    }

    public async Task<RemoveFriendResult> Handle(RemoveFriendCommand request, CancellationToken cancellationToken)
    {
        var friendship = await _friendshipRepository.GetByUsersAsync(request.UserId, request.FriendId, cancellationToken);
        
        if (friendship == null)
        {
            return new RemoveFriendResult(false, "Дружба не найдена");
        }

        if (friendship.Status != FriendshipStatus.Accepted)
        {
            return new RemoveFriendResult(false, "Пользователи не являются друзьями");
        }

        await _friendshipRepository.DeleteAsync(friendship.Id, cancellationToken);

        // Определяем кто удалил и кого удалили
        var removedUserId = friendship.RequesterId == request.UserId ? friendship.AddresseeId : friendship.RequesterId;

        // Уведомляем обоих пользователей
        await _hubContext.Clients.Group($"user-{request.UserId}").SendAsync(
            "FriendRemoved",
            new
            {
                friendId = removedUserId
            },
            cancellationToken);

        await _hubContext.Clients.Group($"user-{removedUserId}").SendAsync(
            "FriendRemoved",
            new
            {
                friendId = request.UserId
            },
            cancellationToken);

        return new RemoveFriendResult(true);
    }
}








