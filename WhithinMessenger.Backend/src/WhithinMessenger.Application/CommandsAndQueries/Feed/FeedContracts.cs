using MediatR;
using Microsoft.AspNetCore.Http;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Feed;

public record CreateFeedPostCommand(
    Guid AuthorUserId,
    string? Title,
    string Text,
    FeedPostScope Scope,
    Guid? ServerId,
    IReadOnlyList<IFormFile>? Files
) : IRequest<FeedPostMutationResult>;

public record DeleteFeedPostCommand(Guid UserId, Guid PostId) : IRequest<FeedPostMutationResult>;

public record GetFeedPostByIdQuery(Guid ViewerUserId, Guid PostId) : IRequest<FeedPostMutationResult>;

public record GetFriendsFeedQuery(Guid UserId, int Take = 50) : IRequest<FeedPostsResult>;

public record GetServerFeedQuery(Guid UserId, int Take = 50) : IRequest<FeedPostsResult>;

public record GetServerFeedByServerQuery(Guid UserId, Guid ServerId, int Take = 50)
    : IRequest<FeedPostsResult>;

public record GetUnifiedFeedQuery(Guid UserId, int Take = 50) : IRequest<FeedPostsResult>;

public record GetUserFeedPostsQuery(Guid ViewerUserId, Guid AuthorUserId, int Take = 50)
    : IRequest<FeedPostsResult>;

public record SetFeedReactionCommand(Guid UserId, Guid PostId, FeedReactionValue? Value)
    : IRequest<FeedEngagementResult>;

public record GetFeedCommentsQuery(Guid ViewerUserId, Guid PostId, int Take = 500)
    : IRequest<FeedCommentsResult>;

public record AddFeedCommentCommand(
    Guid AuthorUserId,
    Guid PostId,
    string Text,
    Guid? ParentCommentId
) : IRequest<FeedCommentMutationResult>;

public record DeleteFeedCommentCommand(Guid UserId, Guid CommentId)
    : IRequest<FeedCommentMutationResult>;

public record SetFeedCommentReactionCommand(Guid UserId, Guid CommentId, FeedReactionValue? Value)
    : IRequest<FeedCommentMutationResult>;

public class FeedPostMutationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Post { get; set; }
}

public class FeedEngagementResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Post { get; set; }
}

public class FeedCommentsResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<object> Comments { get; set; } = [];
}

public class FeedCommentMutationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Comment { get; set; }
}

public class FeedPostsResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<object> Posts { get; set; } = [];
}
