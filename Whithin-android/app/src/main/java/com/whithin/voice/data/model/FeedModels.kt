package com.whithin.voice.data.model

data class FeedAttachmentDto(
    val id: String? = null,
    val fileName: String? = null,
    val originalFileName: String? = null,
    val filePath: String? = null,
    val contentType: String? = null,
    val fileSize: Long? = null,
    val thumbnailPath: String? = null,
)

data class FeedPostDto(
    val id: String? = null,
    val scope: String? = null,
    val title: String? = null,
    val text: String? = null,
    val createdAt: String? = null,
    val authorId: String? = null,
    val authorName: String? = null,
    val authorUsername: String? = null,
    val authorAvatar: String? = null,
    val authorAvatarColor: String? = null,
    val serverId: String? = null,
    val serverName: String? = null,
    val serverAvatar: String? = null,
    val attachments: List<FeedAttachmentDto>? = null,
    val likesCount: Int? = null,
    val dislikesCount: Int? = null,
    val commentsCount: Int? = null,
    val myReaction: String? = null,
)

data class FeedCommentDto(
    val id: String? = null,
    val postId: String? = null,
    val parentCommentId: String? = null,
    val text: String? = null,
    val createdAt: String? = null,
    val authorId: String? = null,
    val authorName: String? = null,
    val authorUsername: String? = null,
    val authorAvatar: String? = null,
    val authorAvatarColor: String? = null,
    val likesCount: Int? = null,
    val dislikesCount: Int? = null,
    val myReaction: String? = null,
)

data class SetFeedReactionRequest(
    val value: String?,
)

data class AddFeedCommentRequest(
    val text: String,
    val parentCommentId: String? = null,
)

data class FeedCommentNode(
    val comment: FeedCommentDto,
    val children: List<FeedCommentNode> = emptyList(),
)

fun resolveFeedPostTitle(post: FeedPostDto): String {
    val title = post.title?.trim().orEmpty()
    if (title.isNotEmpty()) return title
    val text = post.text?.trim().orEmpty()
    if (text.isEmpty()) return "Без названия"
    val firstLine = text.lineSequence().firstOrNull()?.trim().orEmpty()
    return firstLine.ifBlank { "Без названия" }
}

fun resolveFeedPostPreview(post: FeedPostDto, maxLen: Int = 180): String {
    val text = post.text?.trim().orEmpty()
    val title = post.title?.trim().orEmpty()
    var body = text
    if (title.isNotEmpty() && text.startsWith(title)) {
        body = text.removePrefix(title).trim()
    }
    if (body.isEmpty()) return ""
    return if (body.length <= maxLen) body else body.take(maxLen).trimEnd() + "…"
}

fun buildFeedCommentTree(comments: List<FeedCommentDto>): List<FeedCommentNode> {
    val byId = LinkedHashMap<String, MutableList<FeedCommentDto>>()
    val roots = mutableListOf<FeedCommentDto>()
    comments.forEach { comment ->
        val parentId = comment.parentCommentId?.takeIf { it.isNotBlank() }
        if (parentId == null) {
            roots += comment
        } else {
            byId.getOrPut(parentId) { mutableListOf() }.add(comment)
        }
    }

    fun build(node: FeedCommentDto): FeedCommentNode {
        val id = node.id.orEmpty()
        val kids = byId[id].orEmpty().map { build(it) }
        return FeedCommentNode(comment = node, children = kids)
    }

    return roots.map { build(it) }
}
