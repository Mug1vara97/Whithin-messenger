using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.SendFriendRequest;

public class SendFriendRequestCommandHandler : IRequestHandler<SendFriendRequestCommand, SendFriendRequestResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserRepository _userRepository;
    private readonly IFriendRealtimeNotifier _friendRealtimeNotifier;

    public SendFriendRequestCommandHandler(
        IFriendshipRepository friendshipRepository, 
        IUserRepository userRepository,
        IFriendRealtimeNotifier friendRealtimeNotifier)
    {
        _friendshipRepository = friendshipRepository;
        _userRepository = userRepository;
        _friendRealtimeNotifier = friendRealtimeNotifier;
    }

    public async Task<SendFriendRequestResult> Handle(SendFriendRequestCommand request, CancellationToken cancellationToken)
    {
        var requester = await _userRepository.GetByIdAsync(request.RequesterId, cancellationToken);
        var addressee = await _userRepository.GetByIdAsync(request.AddresseeId, cancellationToken);

        if (requester == null || addressee == null)
        {
            return new SendFriendRequestResult(false, "Один или оба пользователя не найдены");
        }

        if (request.RequesterId == request.AddresseeId)
        {
            return new SendFriendRequestResult(false, "Нельзя отправить запрос в друзья самому себе");
        }

        var existingFriendship = await _friendshipRepository.GetByUsersAsync(request.RequesterId, request.AddresseeId, cancellationToken);
        if (existingFriendship != null)
        {
            if (existingFriendship.Status == FriendshipStatus.Accepted)
            {
                return new SendFriendRequestResult(false, "Пользователи уже являются друзьями");
            }
            if (existingFriendship.Status == FriendshipStatus.Pending)
            {
                return new SendFriendRequestResult(false, "Запрос в друзья уже отправлен");
            }
            if (existingFriendship.Status == FriendshipStatus.Blocked)
            {
                return new SendFriendRequestResult(false, "Пользователь заблокирован");
            }
        }

        var friendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = request.RequesterId,
            AddresseeId = request.AddresseeId,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await _friendshipRepository.CreateAsync(friendship, cancellationToken);

        await _friendRealtimeNotifier.NotifyFriendRequestReceivedAsync(
            addresseeId: request.AddresseeId,
            requestId: friendship.Id,
            senderId: request.RequesterId,
            senderUsername: requester.UserName ?? string.Empty,
            cancellationToken: cancellationToken);

        return new SendFriendRequestResult(true, FriendshipId: friendship.Id);
    }
}








