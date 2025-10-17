using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.DeclineFriendRequest;

public class DeclineFriendRequestCommandHandler : IRequestHandler<DeclineFriendRequestCommand, DeclineFriendRequestResult>
{
    private readonly IFriendshipRepository _friendshipRepository;

    public DeclineFriendRequestCommandHandler(IFriendshipRepository friendshipRepository)
    {
        _friendshipRepository = friendshipRepository;
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

        return new DeclineFriendRequestResult(true);
    }
}








