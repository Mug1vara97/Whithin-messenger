using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.DeclineFriendRequest;

public class DeclineFriendRequestCommandHandler : IRequestHandler<DeclineFriendRequestCommand, DeclineFriendRequestResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IFriendRealtimeNotifier _friendRealtimeNotifier;

    public DeclineFriendRequestCommandHandler(
        IFriendshipRepository friendshipRepository,
        IFriendRealtimeNotifier friendRealtimeNotifier)
    {
        _friendshipRepository = friendshipRepository;
        _friendRealtimeNotifier = friendRealtimeNotifier;
    }

    public async Task<DeclineFriendRequestResult> Handle(DeclineFriendRequestCommand request, CancellationToken cancellationToken)
    {
        var friendship = await _friendshipRepository.GetByIdAsync(request.FriendshipId, cancellationToken);
        
        if (friendship == null)
        {
            return new DeclineFriendRequestResult(false, "Запрос в друзья не найден");
        }

        if (friendship.AddresseeId != request.UserId)
        {
            return new DeclineFriendRequestResult(false, "У вас нет прав для отклонения этого запроса");
        }

        if (friendship.Status != FriendshipStatus.Pending)
        {
            return new DeclineFriendRequestResult(false, "Запрос уже был обработан");
        }

        friendship.Status = FriendshipStatus.Declined;
        friendship.UpdatedAt = DateTimeOffset.UtcNow;

        await _friendshipRepository.UpdateAsync(friendship, cancellationToken);

        await _friendRealtimeNotifier.NotifyFriendRequestDeclinedAsync(
            requesterId: friendship.RequesterId,
            requestId: request.FriendshipId,
            cancellationToken: cancellationToken);

        return new DeclineFriendRequestResult(true);
    }
}








