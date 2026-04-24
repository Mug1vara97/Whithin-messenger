using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.AcceptFriendRequest;

public class AcceptFriendRequestCommandHandler : IRequestHandler<AcceptFriendRequestCommand, AcceptFriendRequestResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserRepository _userRepository;
    private readonly IFriendRealtimeNotifier _friendRealtimeNotifier;

    public AcceptFriendRequestCommandHandler(
        IFriendshipRepository friendshipRepository,
        IUserRepository userRepository,
        IFriendRealtimeNotifier friendRealtimeNotifier)
    {
        _friendshipRepository = friendshipRepository;
        _userRepository = userRepository;
        _friendRealtimeNotifier = friendRealtimeNotifier;
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

        // Получаем данные пользователей для уведомлений
        var requester = await _userRepository.GetByIdAsync(friendship.RequesterId, cancellationToken);
        var addressee = await _userRepository.GetByIdAsync(friendship.AddresseeId, cancellationToken);

        await _friendRealtimeNotifier.NotifyFriendRequestAcceptedAsync(
            requesterId: friendship.RequesterId,
            friendId: friendship.AddresseeId,
            friendUsername: addressee?.UserName,
            cancellationToken: cancellationToken);

        await _friendRealtimeNotifier.NotifyFriendAddedAsync(
            addresseeId: friendship.AddresseeId,
            friendId: friendship.RequesterId,
            friendUsername: requester?.UserName,
            cancellationToken: cancellationToken);

        return new AcceptFriendRequestResult(true);
    }
}








