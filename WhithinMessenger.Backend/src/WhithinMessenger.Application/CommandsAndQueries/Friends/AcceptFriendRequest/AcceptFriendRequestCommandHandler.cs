using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.AcceptFriendRequest;

public class AcceptFriendRequestCommandHandler : IRequestHandler<AcceptFriendRequestCommand, AcceptFriendRequestResult>
{
    private readonly IFriendshipRepository _friendshipRepository;

    public AcceptFriendRequestCommandHandler(IFriendshipRepository friendshipRepository)
    {
        _friendshipRepository = friendshipRepository;
    }

    public async Task<AcceptFriendRequestResult> Handle(AcceptFriendRequestCommand request, CancellationToken cancellationToken)
    {
        var friendship = await _friendshipRepository.GetByIdAsync(request.FriendshipId, cancellationToken);
        
        if (friendship == null)
        {
            return new AcceptFriendRequestResult(false, "Запрос в друзья не найден");
        }

        if (friendship.AddresseeId != request.UserId)
        {
            return new AcceptFriendRequestResult(false, "У вас нет прав для принятия этого запроса");
        }

        if (friendship.Status != FriendshipStatus.Pending)
        {
            return new AcceptFriendRequestResult(false, "Запрос уже был обработан");
        }

        friendship.Status = FriendshipStatus.Accepted;
        friendship.UpdatedAt = DateTimeOffset.UtcNow;

        await _friendshipRepository.UpdateAsync(friendship, cancellationToken);

        return new AcceptFriendRequestResult(true);
    }
}








