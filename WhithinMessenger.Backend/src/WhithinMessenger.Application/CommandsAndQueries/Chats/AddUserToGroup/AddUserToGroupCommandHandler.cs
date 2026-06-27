using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.AddUserToGroup;

public class AddUserToGroupCommandHandler : IRequestHandler<AddUserToGroupCommand, AddUserToGroupResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserListCacheService _userListCache;

    public AddUserToGroupCommandHandler(
        IChatRepository chatRepository,
        IFriendshipRepository friendshipRepository,
        IUserListCacheService userListCache)
    {
        _chatRepository = chatRepository;
        _friendshipRepository = friendshipRepository;
        _userListCache = userListCache;
    }

    public async Task<AddUserToGroupResult> Handle(AddUserToGroupCommand request, CancellationToken cancellationToken)
    {
        try
        {
            if (request.UserId == request.CurrentUserId)
            {
                return new AddUserToGroupResult
                {
                    Success = false,
                    ErrorMessage = "Вы уже состоите в этой группе"
                };
            }

            var isParticipant = await _chatRepository.IsUserParticipantAsync(
                request.GroupChatId,
                request.CurrentUserId,
                cancellationToken);
            if (!isParticipant)
            {
                return new AddUserToGroupResult
                {
                    Success = false,
                    ErrorMessage = "Вы не являетесь участником этой группы"
                };
            }

            var areFriends = await _friendshipRepository.AreFriendsAsync(
                request.CurrentUserId,
                request.UserId,
                cancellationToken);
            if (!areFriends)
            {
                return new AddUserToGroupResult
                {
                    Success = false,
                    ErrorMessage = "В группу можно добавлять только друзей"
                };
            }

            var success = await _chatRepository.AddUserToGroupAsync(
                request.GroupChatId,
                request.UserId,
                cancellationToken);

            if (!success)
            {
                return new AddUserToGroupResult
                {
                    Success = false,
                    ErrorMessage = "Не удалось добавить пользователя в группу"
                };
            }

            await _userListCache.InvalidateUserChatsAsync(request.UserId, cancellationToken);

            return new AddUserToGroupResult { Success = true };
        }
        catch (Exception ex)
        {
            return new AddUserToGroupResult
            {
                Success = false,
                ErrorMessage = "Произошла ошибка при добавлении пользователя в группу: " + ex.Message
            };
        }
    }
}
