using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.RemoveFriend;

public class RemoveFriendCommandHandler : IRequestHandler<RemoveFriendCommand, RemoveFriendResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IFriendRealtimeNotifier _friendRealtimeNotifier;

    public RemoveFriendCommandHandler(
        IFriendshipRepository friendshipRepository,
        IFriendRealtimeNotifier friendRealtimeNotifier)
    {
        _friendshipRepository = friendshipRepository;
        _friendRealtimeNotifier = friendRealtimeNotifier;
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

        await _friendRealtimeNotifier.NotifyFriendRemovedAsync(
            userId: request.UserId,
            friendId: removedUserId,
            cancellationToken: cancellationToken);

        await _friendRealtimeNotifier.NotifyFriendRemovedAsync(
            userId: removedUserId,
            friendId: request.UserId,
            cancellationToken: cancellationToken);

        return new RemoveFriendResult(true);
    }
}








