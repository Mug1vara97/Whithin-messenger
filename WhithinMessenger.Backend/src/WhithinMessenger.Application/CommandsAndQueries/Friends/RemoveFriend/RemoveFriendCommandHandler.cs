using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.RemoveFriend;

public class RemoveFriendCommandHandler : IRequestHandler<RemoveFriendCommand, RemoveFriendResult>
{
    private readonly IFriendshipRepository _friendshipRepository;

    public RemoveFriendCommandHandler(IFriendshipRepository friendshipRepository)
    {
        _friendshipRepository = friendshipRepository;
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

        return new RemoveFriendResult(true);
    }
}








