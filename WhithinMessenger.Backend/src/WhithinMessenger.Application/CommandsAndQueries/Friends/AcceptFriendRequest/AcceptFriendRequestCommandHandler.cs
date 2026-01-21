using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.AcceptFriendRequest;

public class AcceptFriendRequestCommandHandler : IRequestHandler<AcceptFriendRequestCommand, AcceptFriendRequestResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserRepository _userRepository;
    private readonly IHubContext<Hub> _hubContext;

    public AcceptFriendRequestCommandHandler(
        IFriendshipRepository friendshipRepository,
        IUserRepository userRepository,
        IHubContext<Hub> hubContext)
    {
        _friendshipRepository = friendshipRepository;
        _userRepository = userRepository;
        _hubContext = hubContext;
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

        // Уведомляем отправителя запроса
        await _hubContext.Clients.Group($"user-{friendship.RequesterId}").SendAsync(
            "FriendRequestAccepted",
            new
            {
                friendId = friendship.AddresseeId,
                friendUsername = addressee?.UserName
            },
            cancellationToken);

        // Уведомляем получателя запроса (кто принял)
        await _hubContext.Clients.Group($"user-{friendship.AddresseeId}").SendAsync(
            "FriendAdded",
            new
            {
                friendId = friendship.RequesterId,
                friendUsername = requester?.UserName
            },
            cancellationToken);

        return new AcceptFriendRequestResult(true);
    }
}








