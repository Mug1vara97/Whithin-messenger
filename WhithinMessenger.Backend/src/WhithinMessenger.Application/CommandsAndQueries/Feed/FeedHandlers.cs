using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Feed;

public static class FeedPostMapper
{
    public static object Map(FeedPost post)
    {
        var profile = post.Author?.UserProfile;
        var username = post.Author?.UserName ?? "Пользователь";
        var displayName = string.IsNullOrWhiteSpace(profile?.DisplayName)
            ? username
            : profile!.DisplayName!;

        return new
        {
            id = post.Id,
            scope = post.Scope == FeedPostScope.Server ? "server" : "friend",
            text = post.Text,
            createdAt = post.CreatedAt,
            authorId = post.AuthorUserId,
            authorName = displayName,
            authorUsername = username,
            authorAvatar = profile?.Avatar,
            authorAvatarColor = profile?.AvatarColor ?? "#5865f2",
            serverId = post.ServerId,
            serverName = post.Server?.Name,
            serverAvatar = post.Server?.Avatar,
        };
    }
}

public class CreateFeedPostCommandHandler : IRequestHandler<CreateFeedPostCommand, FeedPostMutationResult>
{
    private const int MaxTextLength = 2000;

    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IServerRepository _serverRepository;

    public CreateFeedPostCommandHandler(
        IFeedPostRepository feedPostRepository,
        IServerMemberRepository serverMemberRepository,
        IServerRepository serverRepository)
    {
        _feedPostRepository = feedPostRepository;
        _serverMemberRepository = serverMemberRepository;
        _serverRepository = serverRepository;
    }

    public async Task<FeedPostMutationResult> Handle(CreateFeedPostCommand request, CancellationToken cancellationToken)
    {
        var text = (request.Text ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return new FeedPostMutationResult { Success = false, ErrorMessage = "Текст поста пуст" };
        }

        if (text.Length > MaxTextLength)
        {
            return new FeedPostMutationResult
            {
                Success = false,
                ErrorMessage = $"Текст поста не должен превышать {MaxTextLength} символов",
            };
        }

        Guid? serverId = null;
        if (request.Scope == FeedPostScope.Server)
        {
            if (!request.ServerId.HasValue || request.ServerId == Guid.Empty)
            {
                return new FeedPostMutationResult
                {
                    Success = false,
                    ErrorMessage = "Для поста сервера нужен serverId",
                };
            }

            var isMember = await _serverMemberRepository.IsUserMemberAsync(
                request.ServerId.Value,
                request.AuthorUserId,
                cancellationToken);
            if (!isMember)
            {
                var server = await _serverRepository.GetByIdAsync(request.ServerId.Value, cancellationToken);
                if (server == null || server.OwnerId != request.AuthorUserId)
                {
                    return new FeedPostMutationResult
                    {
                        Success = false,
                        ErrorMessage = "Вы не состоите в этом сервере",
                    };
                }
            }

            serverId = request.ServerId;
        }

        var post = new FeedPost
        {
            Id = Guid.NewGuid(),
            AuthorUserId = request.AuthorUserId,
            Text = text,
            Scope = request.Scope,
            ServerId = serverId,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _feedPostRepository.CreateAsync(post, cancellationToken);

        var saved = await _feedPostRepository.GetByIdAsync(post.Id, cancellationToken);
        return new FeedPostMutationResult
        {
            Success = true,
            Post = saved == null ? null : FeedPostMapper.Map(saved),
        };
    }
}

public class DeleteFeedPostCommandHandler : IRequestHandler<DeleteFeedPostCommand, FeedPostMutationResult>
{
    private readonly IFeedPostRepository _feedPostRepository;

    public DeleteFeedPostCommandHandler(IFeedPostRepository feedPostRepository)
    {
        _feedPostRepository = feedPostRepository;
    }

    public async Task<FeedPostMutationResult> Handle(DeleteFeedPostCommand request, CancellationToken cancellationToken)
    {
        var post = await _feedPostRepository.GetByIdAsync(request.PostId, cancellationToken);
        if (post == null)
        {
            return new FeedPostMutationResult { Success = false, ErrorMessage = "Пост не найден" };
        }

        if (post.AuthorUserId != request.UserId)
        {
            return new FeedPostMutationResult { Success = false, ErrorMessage = "Можно удалять только свои посты" };
        }

        await _feedPostRepository.DeleteAsync(post, cancellationToken);
        return new FeedPostMutationResult { Success = true };
    }
}

public class GetFriendsFeedQueryHandler : IRequestHandler<GetFriendsFeedQuery, FeedPostsResult>
{
    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IFriendshipRepository _friendshipRepository;

    public GetFriendsFeedQueryHandler(
        IFeedPostRepository feedPostRepository,
        IFriendshipRepository friendshipRepository)
    {
        _feedPostRepository = feedPostRepository;
        _friendshipRepository = friendshipRepository;
    }

    public async Task<FeedPostsResult> Handle(GetFriendsFeedQuery request, CancellationToken cancellationToken)
    {
        var friendships = await _friendshipRepository.GetFriendsAsync(request.UserId, cancellationToken);
        var authorIds = friendships
            .Select(f => f.RequesterId == request.UserId ? f.AddresseeId : f.RequesterId)
            .Append(request.UserId)
            .Distinct()
            .ToList();

        var take = Math.Clamp(request.Take, 1, 100);
        var posts = await _feedPostRepository.GetFriendFeedAsync(authorIds, take, cancellationToken);

        return new FeedPostsResult
        {
            Success = true,
            Posts = posts.Select(FeedPostMapper.Map).Cast<object>().ToList(),
        };
    }
}

public class GetServerFeedQueryHandler : IRequestHandler<GetServerFeedQuery, FeedPostsResult>
{
    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IServerMemberRepository _serverMemberRepository;

    public GetServerFeedQueryHandler(
        IFeedPostRepository feedPostRepository,
        IServerMemberRepository serverMemberRepository)
    {
        _feedPostRepository = feedPostRepository;
        _serverMemberRepository = serverMemberRepository;
    }

    public async Task<FeedPostsResult> Handle(GetServerFeedQuery request, CancellationToken cancellationToken)
    {
        var memberships = await _serverMemberRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        var serverIds = memberships.Select(m => m.ServerId).Distinct().ToList();
        var take = Math.Clamp(request.Take, 1, 100);
        var posts = await _feedPostRepository.GetServerFeedAsync(serverIds, take, cancellationToken);

        return new FeedPostsResult
        {
            Success = true,
            Posts = posts.Select(FeedPostMapper.Map).Cast<object>().ToList(),
        };
    }
}

public class GetUserFeedPostsQueryHandler : IRequestHandler<GetUserFeedPostsQuery, FeedPostsResult>
{
    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IFriendshipRepository _friendshipRepository;

    public GetUserFeedPostsQueryHandler(
        IFeedPostRepository feedPostRepository,
        IFriendshipRepository friendshipRepository)
    {
        _feedPostRepository = feedPostRepository;
        _friendshipRepository = friendshipRepository;
    }

    public async Task<FeedPostsResult> Handle(GetUserFeedPostsQuery request, CancellationToken cancellationToken)
    {
        var isOwn = request.ViewerUserId == request.AuthorUserId;
        if (!isOwn)
        {
            var areFriends = await _friendshipRepository.AreFriendsAsync(
                request.ViewerUserId,
                request.AuthorUserId,
                cancellationToken);
            if (!areFriends)
            {
                return new FeedPostsResult
                {
                    Success = false,
                    ErrorMessage = "Публикации видны только друзьям",
                };
            }
        }

        var take = Math.Clamp(request.Take, 1, 100);
        var posts = await _feedPostRepository.GetByAuthorAsync(
            request.AuthorUserId,
            FeedPostScope.Friend,
            take,
            cancellationToken);

        return new FeedPostsResult
        {
            Success = true,
            Posts = posts.Select(FeedPostMapper.Map).Cast<object>().ToList(),
        };
    }
}
