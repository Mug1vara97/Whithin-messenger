using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.UnblockUser;

public class UnblockUserCommandHandler : IRequestHandler<UnblockUserCommand, UnblockUserResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IFriendRealtimeNotifier _friendRealtimeNotifier;

    public UnblockUserCommandHandler(
        IFriendshipRepository friendshipRepository,
        IFriendRealtimeNotifier friendRealtimeNotifier)
    {
        _friendshipRepository = friendshipRepository;
        _friendRealtimeNotifier = friendRealtimeNotifier;
    }

    public async Task<UnblockUserResult> Handle(UnblockUserCommand request, CancellationToken cancellationToken)
    {
        var isBlocked = await _friendshipRepository.IsBlockedByAsync(
            request.UserId,
            request.TargetUserId,
            cancellationToken);

        if (!isBlocked)
        {
            return new UnblockUserResult(false, "Пользователь не заблокирован");
        }

        var friendship = await _friendshipRepository.GetByUsersAsync(
            request.UserId,
            request.TargetUserId,
            cancellationToken);

        if (friendship != null)
        {
            await _friendshipRepository.DeleteAsync(friendship.Id, cancellationToken);
        }

        await _friendRealtimeNotifier.NotifyUserUnblockedAsync(
            blockerId: request.UserId,
            unblockedUserId: request.TargetUserId,
            cancellationToken: cancellationToken);

        return new UnblockUserResult(true);
    }
}
