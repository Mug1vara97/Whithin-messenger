using MediatR;
using Microsoft.AspNetCore.Http;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Feed;

public static class FeedPostMapper
{
    public const int MaxTitleLength = 300;
    public const int MaxCommentDepth = 6;

    public static string ResolveTitle(FeedPost post)
    {
        if (!string.IsNullOrWhiteSpace(post.Title))
        {
            return post.Title.Trim();
        }

        var text = (post.Text ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(text))
        {
            return "Без названия";
        }

        var firstLine = text.Split('\n', 2, StringSplitOptions.None)[0].Trim();
        if (firstLine.Length <= MaxTitleLength)
        {
            return string.IsNullOrEmpty(firstLine) ? "Без названия" : firstLine;
        }

        return firstLine[..MaxTitleLength].TrimEnd() + "…";
    }

    public static string? NormalizeTitle(string? title)
    {
        var trimmed = (title ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length > MaxTitleLength ? trimmed[..MaxTitleLength] : trimmed;
    }

    public static object MapAttachment(FeedPostAttachment attachment) => new
    {
        id = attachment.Id,
        fileName = attachment.FileName,
        originalFileName = attachment.OriginalFileName,
        filePath = attachment.FilePath.StartsWith('/') ? attachment.FilePath : $"/{attachment.FilePath}",
        contentType = attachment.ContentType,
        fileSize = attachment.FileSize,
        thumbnailPath = string.IsNullOrWhiteSpace(attachment.ThumbnailPath)
            ? null
            : (attachment.ThumbnailPath.StartsWith('/')
                ? attachment.ThumbnailPath
                : $"/{attachment.ThumbnailPath}"),
    };

    public static object Map(FeedPost post, Guid? viewerUserId = null)
    {
        var profile = post.Author?.UserProfile;
        var username = post.Author?.UserName ?? "Пользователь";
        var displayName = string.IsNullOrWhiteSpace(profile?.DisplayName)
            ? username
            : profile!.DisplayName!;

        var attachments = (post.Attachments ?? [])
            .OrderBy(a => a.CreatedAt)
            .Select(MapAttachment)
            .Cast<object>()
            .ToList();

        var reactions = post.Reactions ?? [];
        var likesCount = reactions.Count(r => r.Value == FeedReactionValue.Like);
        var dislikesCount = reactions.Count(r => r.Value == FeedReactionValue.Dislike);
        string? myReaction = null;
        if (viewerUserId.HasValue)
        {
            var mine = reactions.FirstOrDefault(r => r.UserId == viewerUserId.Value);
            if (mine != null)
            {
                myReaction = mine.Value == FeedReactionValue.Like ? "like" : "dislike";
            }
        }

        return new
        {
            id = post.Id,
            scope = post.Scope == FeedPostScope.Server ? "server" : "friend",
            title = ResolveTitle(post),
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
            attachments,
            likesCount,
            dislikesCount,
            commentsCount = (post.Comments ?? []).Count,
            myReaction,
        };
    }

    public static object MapComment(FeedPostComment comment, Guid? viewerUserId = null)
    {
        var profile = comment.Author?.UserProfile;
        var username = comment.Author?.UserName ?? "Пользователь";
        var displayName = string.IsNullOrWhiteSpace(profile?.DisplayName)
            ? username
            : profile!.DisplayName!;

        var reactions = comment.Reactions ?? [];
        var likesCount = reactions.Count(r => r.Value == FeedReactionValue.Like);
        var dislikesCount = reactions.Count(r => r.Value == FeedReactionValue.Dislike);
        string? myReaction = null;
        if (viewerUserId.HasValue)
        {
            var mine = reactions.FirstOrDefault(r => r.UserId == viewerUserId.Value);
            if (mine != null)
            {
                myReaction = mine.Value == FeedReactionValue.Like ? "like" : "dislike";
            }
        }

        return new
        {
            id = comment.Id,
            postId = comment.FeedPostId,
            parentCommentId = comment.ParentCommentId,
            text = comment.Text,
            createdAt = comment.CreatedAt,
            authorId = comment.AuthorUserId,
            authorName = displayName,
            authorUsername = username,
            authorAvatar = profile?.Avatar,
            authorAvatarColor = profile?.AvatarColor ?? "#5865f2",
            likesCount,
            dislikesCount,
            myReaction,
        };
    }
}

public class CreateFeedPostCommandHandler : IRequestHandler<CreateFeedPostCommand, FeedPostMutationResult>
{
    private const int MaxTextLength = 2000;
    private const int MaxAttachments = 10;
    private const long MaxFileBytes = 50L * 1024 * 1024;

    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IFileService _fileService;

    public CreateFeedPostCommandHandler(
        IFeedPostRepository feedPostRepository,
        IServerMemberRepository serverMemberRepository,
        IServerRepository serverRepository,
        IFileService fileService)
    {
        _feedPostRepository = feedPostRepository;
        _serverMemberRepository = serverMemberRepository;
        _serverRepository = serverRepository;
        _fileService = fileService;
    }

    public async Task<FeedPostMutationResult> Handle(CreateFeedPostCommand request, CancellationToken cancellationToken)
    {
        var title = FeedPostMapper.NormalizeTitle(request.Title);
        var text = (request.Text ?? string.Empty).Trim();
        var files = (request.Files ?? Array.Empty<IFormFile>())
            .Where(f => f != null && f.Length > 0)
            .ToList();

        if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(text) && files.Count == 0)
        {
            return new FeedPostMutationResult
            {
                Success = false,
                ErrorMessage = "Добавьте заголовок, текст или вложение",
            };
        }

        if (text.Length > MaxTextLength)
        {
            return new FeedPostMutationResult
            {
                Success = false,
                ErrorMessage = $"Текст поста не должен превышать {MaxTextLength} символов",
            };
        }

        if (files.Count > MaxAttachments)
        {
            return new FeedPostMutationResult
            {
                Success = false,
                ErrorMessage = $"Можно прикрепить не больше {MaxAttachments} файлов",
            };
        }

        foreach (var file in files)
        {
            if (file.Length > MaxFileBytes)
            {
                return new FeedPostMutationResult
                {
                    Success = false,
                    ErrorMessage = $"Файл «{file.FileName}» слишком большой (макс. 50 МБ)",
                };
            }
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

        var now = DateTimeOffset.UtcNow;
        var post = new FeedPost
        {
            Id = Guid.NewGuid(),
            AuthorUserId = request.AuthorUserId,
            Title = title,
            Text = text,
            Scope = request.Scope,
            ServerId = serverId,
            CreatedAt = now,
        };

        foreach (var file in files)
        {
            var contentType = string.IsNullOrWhiteSpace(file.ContentType)
                ? "application/octet-stream"
                : file.ContentType;
            var folder = _fileService.GetMediaFolderPath(contentType);
            var relativePath = await _fileService.SaveFileAsync(file, Path.Combine("feed", folder));
            var normalizedPath = relativePath.StartsWith('/') ? relativePath : $"/{relativePath}";

            post.Attachments.Add(new FeedPostAttachment
            {
                Id = Guid.NewGuid(),
                FeedPostId = post.Id,
                FileName = Path.GetFileName(normalizedPath),
                OriginalFileName = string.IsNullOrWhiteSpace(Path.GetFileName(file.FileName))
                    ? "file"
                    : Path.GetFileName(file.FileName),
                FilePath = normalizedPath,
                ContentType = contentType,
                FileSize = file.Length,
                CreatedAt = now,
            });
        }

        await _feedPostRepository.CreateAsync(post, cancellationToken);

        var saved = await _feedPostRepository.GetByIdAsync(post.Id, cancellationToken);
        return new FeedPostMutationResult
        {
            Success = true,
            Post = saved == null ? null : FeedPostMapper.Map(saved, request.AuthorUserId),
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
            Posts = posts.Select(p => FeedPostMapper.Map(p, request.UserId)).Cast<object>().ToList(),
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
            Posts = posts.Select(p => FeedPostMapper.Map(p, request.UserId)).Cast<object>().ToList(),
        };
    }
}

public class GetServerFeedByServerQueryHandler : IRequestHandler<GetServerFeedByServerQuery, FeedPostsResult>
{
    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IServerRepository _serverRepository;

    public GetServerFeedByServerQueryHandler(
        IFeedPostRepository feedPostRepository,
        IServerMemberRepository serverMemberRepository,
        IServerRepository serverRepository)
    {
        _feedPostRepository = feedPostRepository;
        _serverMemberRepository = serverMemberRepository;
        _serverRepository = serverRepository;
    }

    public async Task<FeedPostsResult> Handle(GetServerFeedByServerQuery request, CancellationToken cancellationToken)
    {
        var isMember = await _serverMemberRepository.IsUserMemberAsync(
            request.ServerId,
            request.UserId,
            cancellationToken);
        if (!isMember)
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null || server.OwnerId != request.UserId)
            {
                return new FeedPostsResult
                {
                    Success = false,
                    ErrorMessage = "Нет доступа к новостям сервера",
                };
            }
        }

        var take = Math.Clamp(request.Take, 1, 100);
        var posts = await _feedPostRepository.GetServerFeedAsync(
            [request.ServerId],
            take,
            cancellationToken);

        return new FeedPostsResult
        {
            Success = true,
            Posts = posts.Select(p => FeedPostMapper.Map(p, request.UserId)).Cast<object>().ToList(),
        };
    }
}

public class GetUnifiedFeedQueryHandler : IRequestHandler<GetUnifiedFeedQuery, FeedPostsResult>
{
    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IServerMemberRepository _serverMemberRepository;

    public GetUnifiedFeedQueryHandler(
        IFeedPostRepository feedPostRepository,
        IFriendshipRepository friendshipRepository,
        IServerMemberRepository serverMemberRepository)
    {
        _feedPostRepository = feedPostRepository;
        _friendshipRepository = friendshipRepository;
        _serverMemberRepository = serverMemberRepository;
    }

    public async Task<FeedPostsResult> Handle(GetUnifiedFeedQuery request, CancellationToken cancellationToken)
    {
        var take = Math.Clamp(request.Take, 1, 100);

        var friendships = await _friendshipRepository.GetFriendsAsync(request.UserId, cancellationToken);
        var authorIds = friendships
            .Select(f => f.RequesterId == request.UserId ? f.AddresseeId : f.RequesterId)
            .Append(request.UserId)
            .Distinct()
            .ToList();

        var memberships = await _serverMemberRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        var serverIds = memberships.Select(m => m.ServerId).Distinct().ToList();

        var friendPosts = await _feedPostRepository.GetFriendFeedAsync(authorIds, take, cancellationToken);
        var serverPosts = await _feedPostRepository.GetServerFeedAsync(serverIds, take, cancellationToken);

        var merged = friendPosts
            .Concat(serverPosts)
            .OrderByDescending(p => p.CreatedAt)
            .Take(take)
            .Select(p => FeedPostMapper.Map(p, request.UserId))
            .Cast<object>()
            .ToList();

        return new FeedPostsResult
        {
            Success = true,
            Posts = merged,
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
            scope: null,
            take,
            cancellationToken);

        return new FeedPostsResult
        {
            Success = true,
            Posts = posts.Select(p => FeedPostMapper.Map(p, request.ViewerUserId)).Cast<object>().ToList(),
        };
    }
}

public class SetFeedReactionCommandHandler : IRequestHandler<SetFeedReactionCommand, FeedEngagementResult>
{
    private readonly IFeedPostRepository _feedPostRepository;

    public SetFeedReactionCommandHandler(IFeedPostRepository feedPostRepository)
    {
        _feedPostRepository = feedPostRepository;
    }

    public async Task<FeedEngagementResult> Handle(SetFeedReactionCommand request, CancellationToken cancellationToken)
    {
        var post = await _feedPostRepository.GetByIdWithEngagementAsync(request.PostId, cancellationToken);
        if (post == null)
        {
            return new FeedEngagementResult { Success = false, ErrorMessage = "Пост не найден" };
        }

        var existing = await _feedPostRepository.GetReactionAsync(request.PostId, request.UserId, cancellationToken);

        if (request.Value == null)
        {
            if (existing != null)
            {
                await _feedPostRepository.RemoveReactionAsync(existing, cancellationToken);
            }
        }
        else
        {
            var value = request.Value == FeedReactionValue.Like
                ? FeedReactionValue.Like
                : FeedReactionValue.Dislike;

            if (existing != null && existing.Value == value)
            {
                await _feedPostRepository.RemoveReactionAsync(existing, cancellationToken);
            }
            else
            {
                await _feedPostRepository.UpsertReactionAsync(
                    new FeedPostReaction
                    {
                        Id = existing?.Id ?? Guid.NewGuid(),
                        FeedPostId = request.PostId,
                        UserId = request.UserId,
                        Value = value,
                        CreatedAt = existing?.CreatedAt ?? DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow,
                    },
                    cancellationToken);
            }
        }

        var refreshed = await _feedPostRepository.GetByIdWithEngagementAsync(request.PostId, cancellationToken);
        return new FeedEngagementResult
        {
            Success = true,
            Post = refreshed == null ? null : FeedPostMapper.Map(refreshed, request.UserId),
        };
    }
}

public class GetFeedPostByIdQueryHandler : IRequestHandler<GetFeedPostByIdQuery, FeedPostMutationResult>
{
    private readonly IFeedPostRepository _feedPostRepository;
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IServerRepository _serverRepository;

    public GetFeedPostByIdQueryHandler(
        IFeedPostRepository feedPostRepository,
        IFriendshipRepository friendshipRepository,
        IServerMemberRepository serverMemberRepository,
        IServerRepository serverRepository)
    {
        _feedPostRepository = feedPostRepository;
        _friendshipRepository = friendshipRepository;
        _serverMemberRepository = serverMemberRepository;
        _serverRepository = serverRepository;
    }

    public async Task<FeedPostMutationResult> Handle(GetFeedPostByIdQuery request, CancellationToken cancellationToken)
    {
        var post = await _feedPostRepository.GetByIdWithEngagementAsync(request.PostId, cancellationToken);
        if (post == null)
        {
            return new FeedPostMutationResult { Success = false, ErrorMessage = "Пост не найден" };
        }

        if (!await CanViewPostAsync(post, request.ViewerUserId, cancellationToken))
        {
            return new FeedPostMutationResult { Success = false, ErrorMessage = "Нет доступа к посту" };
        }

        return new FeedPostMutationResult
        {
            Success = true,
            Post = FeedPostMapper.Map(post, request.ViewerUserId),
        };
    }

    private async Task<bool> CanViewPostAsync(FeedPost post, Guid viewerId, CancellationToken cancellationToken)
    {
        if (post.AuthorUserId == viewerId)
        {
            return true;
        }

        if (post.Scope == FeedPostScope.Friend)
        {
            return await _friendshipRepository.AreFriendsAsync(viewerId, post.AuthorUserId, cancellationToken);
        }

        if (!post.ServerId.HasValue)
        {
            return false;
        }

        if (await _serverMemberRepository.IsUserMemberAsync(post.ServerId.Value, viewerId, cancellationToken))
        {
            return true;
        }

        var server = await _serverRepository.GetByIdAsync(post.ServerId.Value, cancellationToken);
        return server != null && server.OwnerId == viewerId;
    }
}

public class GetFeedCommentsQueryHandler : IRequestHandler<GetFeedCommentsQuery, FeedCommentsResult>
{
    private readonly IFeedPostRepository _feedPostRepository;

    public GetFeedCommentsQueryHandler(IFeedPostRepository feedPostRepository)
    {
        _feedPostRepository = feedPostRepository;
    }

    public async Task<FeedCommentsResult> Handle(GetFeedCommentsQuery request, CancellationToken cancellationToken)
    {
        var post = await _feedPostRepository.GetByIdAsync(request.PostId, cancellationToken);
        if (post == null)
        {
            return new FeedCommentsResult { Success = false, ErrorMessage = "Пост не найден" };
        }

        var take = Math.Clamp(request.Take, 1, 500);
        var comments = await _feedPostRepository.GetCommentsAsync(request.PostId, take, cancellationToken);
        return new FeedCommentsResult
        {
            Success = true,
            Comments = comments
                .Select(c => FeedPostMapper.MapComment(c, request.ViewerUserId))
                .Cast<object>()
                .ToList(),
        };
    }
}

public class AddFeedCommentCommandHandler : IRequestHandler<AddFeedCommentCommand, FeedCommentMutationResult>
{
    private const int MaxTextLength = 2000;
    private readonly IFeedPostRepository _feedPostRepository;

    public AddFeedCommentCommandHandler(IFeedPostRepository feedPostRepository)
    {
        _feedPostRepository = feedPostRepository;
    }

    public async Task<FeedCommentMutationResult> Handle(AddFeedCommentCommand request, CancellationToken cancellationToken)
    {
        var text = (request.Text ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return new FeedCommentMutationResult { Success = false, ErrorMessage = "Комментарий пуст" };
        }

        if (text.Length > MaxTextLength)
        {
            return new FeedCommentMutationResult
            {
                Success = false,
                ErrorMessage = $"Комментарий не должен превышать {MaxTextLength} символов",
            };
        }

        var post = await _feedPostRepository.GetByIdAsync(request.PostId, cancellationToken);
        if (post == null)
        {
            return new FeedCommentMutationResult { Success = false, ErrorMessage = "Пост не найден" };
        }

        Guid? parentId = request.ParentCommentId;
        if (parentId.HasValue)
        {
            var parent = await _feedPostRepository.GetCommentByIdAsync(parentId.Value, cancellationToken);
            if (parent == null || parent.FeedPostId != request.PostId)
            {
                return new FeedCommentMutationResult
                {
                    Success = false,
                    ErrorMessage = "Родительский комментарий не найден",
                };
            }

            var parentDepth = await _feedPostRepository.GetCommentDepthAsync(parentId.Value, cancellationToken);
            // parentDepth = number of ancestors; reply depth = parentDepth + 1 (0-based nesting of reply)
            if (parentDepth + 1 >= FeedPostMapper.MaxCommentDepth)
            {
                return new FeedCommentMutationResult
                {
                    Success = false,
                    ErrorMessage = $"Максимальная глубина треда — {FeedPostMapper.MaxCommentDepth}",
                };
            }
        }

        var comment = new FeedPostComment
        {
            Id = Guid.NewGuid(),
            FeedPostId = request.PostId,
            AuthorUserId = request.AuthorUserId,
            ParentCommentId = parentId,
            Text = text,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _feedPostRepository.AddCommentAsync(comment, cancellationToken);
        var saved = await _feedPostRepository.GetCommentByIdAsync(comment.Id, cancellationToken);

        return new FeedCommentMutationResult
        {
            Success = true,
            Comment = saved == null ? null : FeedPostMapper.MapComment(saved, request.AuthorUserId),
        };
    }
}

public class DeleteFeedCommentCommandHandler : IRequestHandler<DeleteFeedCommentCommand, FeedCommentMutationResult>
{
    private readonly IFeedPostRepository _feedPostRepository;

    public DeleteFeedCommentCommandHandler(IFeedPostRepository feedPostRepository)
    {
        _feedPostRepository = feedPostRepository;
    }

    public async Task<FeedCommentMutationResult> Handle(DeleteFeedCommentCommand request, CancellationToken cancellationToken)
    {
        var comment = await _feedPostRepository.GetCommentByIdAsync(request.CommentId, cancellationToken);
        if (comment == null)
        {
            return new FeedCommentMutationResult { Success = false, ErrorMessage = "Комментарий не найден" };
        }

        if (comment.AuthorUserId != request.UserId)
        {
            return new FeedCommentMutationResult
            {
                Success = false,
                ErrorMessage = "Можно удалять только свои комментарии",
            };
        }

        await _feedPostRepository.DeleteCommentAsync(comment, cancellationToken);
        return new FeedCommentMutationResult { Success = true };
    }
}

public class SetFeedCommentReactionCommandHandler
    : IRequestHandler<SetFeedCommentReactionCommand, FeedCommentMutationResult>
{
    private readonly IFeedPostRepository _feedPostRepository;

    public SetFeedCommentReactionCommandHandler(IFeedPostRepository feedPostRepository)
    {
        _feedPostRepository = feedPostRepository;
    }

    public async Task<FeedCommentMutationResult> Handle(
        SetFeedCommentReactionCommand request,
        CancellationToken cancellationToken)
    {
        var comment = await _feedPostRepository.GetCommentByIdAsync(request.CommentId, cancellationToken);
        if (comment == null)
        {
            return new FeedCommentMutationResult { Success = false, ErrorMessage = "Комментарий не найден" };
        }

        var existing = await _feedPostRepository.GetCommentReactionAsync(
            request.CommentId,
            request.UserId,
            cancellationToken);

        if (request.Value == null)
        {
            if (existing != null)
            {
                await _feedPostRepository.RemoveCommentReactionAsync(existing, cancellationToken);
            }
        }
        else
        {
            var value = request.Value == FeedReactionValue.Like
                ? FeedReactionValue.Like
                : FeedReactionValue.Dislike;

            if (existing != null && existing.Value == value)
            {
                await _feedPostRepository.RemoveCommentReactionAsync(existing, cancellationToken);
            }
            else
            {
                await _feedPostRepository.UpsertCommentReactionAsync(
                    new FeedCommentReaction
                    {
                        Id = existing?.Id ?? Guid.NewGuid(),
                        FeedPostCommentId = request.CommentId,
                        UserId = request.UserId,
                        Value = value,
                        CreatedAt = existing?.CreatedAt ?? DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow,
                    },
                    cancellationToken);
            }
        }

        var refreshed = await _feedPostRepository.GetCommentByIdAsync(request.CommentId, cancellationToken);
        return new FeedCommentMutationResult
        {
            Success = true,
            Comment = refreshed == null ? null : FeedPostMapper.MapComment(refreshed, request.UserId),
        };
    }
}
