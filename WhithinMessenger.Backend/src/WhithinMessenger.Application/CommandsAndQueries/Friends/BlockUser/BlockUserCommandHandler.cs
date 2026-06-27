using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.BlockUser;

public class BlockUserCommandHandler : IRequestHandler<BlockUserCommand, BlockUserResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserRepository _userRepository;
    private readonly IFriendRealtimeNotifier _friendRealtimeNotifier;

    public BlockUserCommandHandler(
        IFriendshipRepository friendshipRepository,
        IUserRepository userRepository,
        IFriendRealtimeNotifier friendRealtimeNotifier)
    {
        _friendshipRepository = friendshipRepository;
        _userRepository = userRepository;
        _friendRealtimeNotifier = friendRealtimeNotifier;
    }

    public async Task<BlockUserResult> Handle(BlockUserCommand request, CancellationToken cancellationToken)
    {
        if (request.UserId == request.TargetUserId)
        {
            return new BlockUserResult(false, "Нельзя заблокировать самого себя");
        }

        var targetUser = await _userRepository.GetByIdAsync(request.TargetUserId, cancellationToken);
        if (targetUser == null)
        {
            return new BlockUserResult(false, "Пользователь не найден");
        }

        var existing = await _friendshipRepository.GetByUsersAsync(request.UserId, request.TargetUserId, cancellationToken);
        var wasFriend = existing?.Status == FriendshipStatus.Accepted;

        if (existing == null)
        {
            existing = new Friendship
            {
                Id = Guid.NewGuid(),
                RequesterId = request.UserId,
                AddresseeId = request.TargetUserId,
                Status = FriendshipStatus.Blocked,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            await _friendshipRepository.CreateAsync(existing, cancellationToken);
        }
        else
        {
            existing.RequesterId = request.UserId;
            existing.AddresseeId = request.TargetUserId;
            existing.Status = FriendshipStatus.Blocked;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await _friendshipRepository.UpdateAsync(existing, cancellationToken);
        }

        if (wasFriend)
        {
            await _friendRealtimeNotifier.NotifyFriendRemovedAsync(request.UserId, request.TargetUserId, cancellationToken);
            await _friendRealtimeNotifier.NotifyFriendRemovedAsync(request.TargetUserId, request.UserId, cancellationToken);
        }

        await _friendRealtimeNotifier.NotifyUserBlockedAsync(
            blockerId: request.UserId,
            blockedUserId: request.TargetUserId,
            cancellationToken: cancellationToken);

        return new BlockUserResult(true);
    }
}
