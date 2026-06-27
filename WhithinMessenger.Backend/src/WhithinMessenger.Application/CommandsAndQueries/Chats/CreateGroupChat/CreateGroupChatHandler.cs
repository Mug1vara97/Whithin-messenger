using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.CreateGroupChat;

public class CreateGroupChatHandler : IRequestHandler<CreateGroupChatCommand, CreateGroupChatResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChatMemberRepository _memberRepository;
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserListCacheService _userListCache;

    public CreateGroupChatHandler(
        IChatRepository chatRepository,
        IUserRepository userRepository,
        IChatMemberRepository memberRepository,
        IFriendshipRepository friendshipRepository,
        IUserListCacheService userListCache)
    {
        _chatRepository = chatRepository;
        _userRepository = userRepository;
        _memberRepository = memberRepository;
        _friendshipRepository = friendshipRepository;
        _userListCache = userListCache;
    }

    public async Task<CreateGroupChatResult> Handle(CreateGroupChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var creator = await _userRepository.GetByIdAsync(request.CreatorId);
            if (creator == null)
            {
                return CreateGroupChatResult.FailureResult("Пользователь-создатель не найден");
            }

            foreach (var memberId in request.MemberIds)
            {
                if (memberId == request.CreatorId)
                {
                    continue;
                }

                var member = await _userRepository.GetByIdAsync(memberId);
                if (member == null)
                {
                    return CreateGroupChatResult.FailureResult($"Пользователь с ID {memberId} не найден");
                }

                var areFriends = await _friendshipRepository.AreFriendsAsync(
                    request.CreatorId,
                    memberId,
                    cancellationToken);
                if (!areFriends)
                {
                    return CreateGroupChatResult.FailureResult("В группу можно добавлять только друзей");
                }
            }

            var groupChatType = await _chatRepository.GetChatTypeByNameAsync("Group", cancellationToken);
            if (groupChatType == null)
            {
                return new CreateGroupChatResult(false, "Group chat type not found.");
            }

            var groupChat = new Chat
            {
                Id = Guid.NewGuid(),
                Name = request.ChatName,
                TypeId = groupChatType.Id,
                IsPrivate = false,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedByUserId = request.CreatorId,
                ServerId = null
            };

            await _chatRepository.CreateAsync(groupChat, cancellationToken);

            var members = new List<Member>();
            foreach (var memberId in request.MemberIds)
            {
                var user = await _userRepository.GetByIdAsync(memberId, cancellationToken);
                if (user != null)
                {
                    var chatMember = new Member
                    {
                        Id = Guid.NewGuid(),
                        UserId = memberId,
                        ChatId = groupChat.Id,
                        JoinedAt = DateTimeOffset.UtcNow,
                        Chat = groupChat,
                        User = user
                    };
                    members.Add(chatMember);
                }
            }
            
            await _memberRepository.AddRangeAsync(members, cancellationToken);

            await _userListCache.InvalidateUserChatsAsync(request.MemberIds, cancellationToken);
            await _userListCache.InvalidateUserChatsAsync(request.CreatorId, cancellationToken);

            return CreateGroupChatResult.SuccessResult(groupChat.Id);
        }
        catch (Exception ex)
        {
            return CreateGroupChatResult.FailureResult($"Ошибка при создании группового чата: {ex.Message}");
        }
    }

}
