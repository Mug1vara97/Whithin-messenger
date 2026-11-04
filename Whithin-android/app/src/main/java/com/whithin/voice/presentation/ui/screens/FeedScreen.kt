package com.whithin.voice.presentation.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.whithin.voice.data.model.FeedAttachmentDto
import com.whithin.voice.data.model.FeedCommentDto
import com.whithin.voice.data.model.FeedCommentNode
import com.whithin.voice.data.model.FeedPostDto
import com.whithin.voice.data.model.buildFeedCommentTree
import com.whithin.voice.data.model.resolveFeedPostPreview
import com.whithin.voice.data.model.resolveFeedPostTitle
import com.whithin.voice.presentation.ui.components.AppText as Text
import com.whithin.voice.presentation.ui.components.MediaViewerOverlay
import com.whithin.voice.presentation.ui.media.MediaViewerItem
import com.whithin.voice.presentation.ui.media.MediaViewerState
import com.whithin.voice.presentation.ui.media.resolveAvatarUrl
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.FeedViewModel
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

private val LikeOrange = Color(0xFFFF4500)
private val DislikeBlue = Color(0xFF7193FF)
private const val MaxCommentDepth = 6

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    onBack: () -> Unit,
    viewModel: FeedViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsUiState()
    val context = LocalContext.current
    var showComposer by remember { mutableStateOf(false) }
    var draftTitle by remember { mutableStateOf("") }
    var draft by remember { mutableStateOf("") }
    var draftImages by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var commentDraft by remember { mutableStateOf("") }
    var viewerState by remember { mutableStateOf<MediaViewerState?>(null) }

    val inThread = !state.selectedPostId.isNullOrBlank()

    BackHandler {
        if (inThread) viewModel.closeThread() else onBack()
    }

    val imagePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetMultipleContents(),
    ) { uris ->
        if (uris.isNotEmpty()) {
            draftImages = (draftImages + uris).distinct().take(10)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (inThread) {
                            "Обсуждение"
                        } else {
                            state.channelName.ifBlank {
                                if (state.serverId != null) "Новости" else "Лента"
                            }
                        },
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            if (inThread) viewModel.closeThread() else onBack()
                        },
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    if (!inThread) {
                        IconButton(onClick = { showComposer = true }) {
                            Icon(Icons.Default.Add, contentDescription = "Новый пост")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                inThread -> {
                    FeedThreadPane(
                        post = state.selectedPost,
                        loading = state.threadLoading,
                        comments = state.commentsByPost[state.selectedPostId].orEmpty(),
                        commentsLoading = state.commentsLoading.contains(state.selectedPostId),
                        isServerNewsChannel = state.serverId != null,
                        currentUserId = state.currentUserId,
                        replyToCommentId = state.replyToCommentId,
                        commentDraft = commentDraft,
                        onCommentDraftChange = { commentDraft = it },
                        onReplyTo = viewModel::setReplyTo,
                        onReaction = { post, value -> viewModel.setReaction(post, value) },
                        onCommentReaction = { comment, value ->
                            val postId = state.selectedPostId ?: return@FeedThreadPane
                            viewModel.setCommentReaction(postId, comment, value)
                        },
                        onSendComment = {
                            val postId = state.selectedPostId ?: return@FeedThreadPane
                            viewModel.addComment(postId, commentDraft)
                            commentDraft = ""
                        },
                        onDeleteComment = { commentId ->
                            val postId = state.selectedPostId ?: return@FeedThreadPane
                            viewModel.deleteComment(postId, commentId)
                        },
                        onDeletePost = {
                            state.selectedPostId?.let(viewModel::deletePost)
                        },
                        onShare = { post -> sharePost(context, post) },
                        onOpenImage = { post, index ->
                            viewerState = viewerStateFor(post, index)
                        },
                        onRetry = {
                            state.selectedPostId?.let(viewModel::openThread)
                        },
                    )
                }
                state.isLoading && state.posts.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                state.posts.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("Пока пусто")
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            if (state.serverId != null) {
                                "Напишите первую новость — её увидят участники сервера."
                            } else {
                                "Напишите первый пост — его увидят друзья."
                            },
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        state.error?.let {
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(it, color = MaterialTheme.colorScheme.error)
                            TextButton(onClick = viewModel::refresh) { Text("Повторить") }
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        if (state.error != null) {
                            item {
                                Text(
                                    text = state.error.orEmpty(),
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                        }
                        items(state.posts, key = { it.id ?: it.hashCode().toString() }) { post ->
                            FeedThreadCard(
                                post = post,
                                isServerNewsChannel = state.serverId != null,
                                currentUserId = state.currentUserId,
                                onOpen = { post.id?.let(viewModel::openThread) },
                                onReaction = { value -> viewModel.setReaction(post, value) },
                                onDeletePost = { post.id?.let(viewModel::deletePost) },
                                onShare = { sharePost(context, post) },
                                onOpenImage = { index ->
                                    viewerState = viewerStateFor(post, index)
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    if (showComposer) {
        AlertDialog(
            onDismissRequest = { if (!state.isPublishing) showComposer = false },
            title = { Text(if (state.serverId != null) "Новость сервера" else "Новый пост") },
            text = {
                Column {
                    OutlinedTextField(
                        value = draftTitle,
                        onValueChange = { if (it.length <= 200) draftTitle = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Заголовок") },
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                if (state.serverId != null) {
                                    "Текст новости — её увидят все участники сервера."
                                } else {
                                    "Текст поста"
                                },
                            )
                        },
                        minLines = 3,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    TextButton(onClick = { imagePicker.launch("image/*") }) {
                        Text(if (draftImages.isEmpty()) "Добавить фото" else "Фото: ${draftImages.size}")
                    }
                }
            },
            confirmButton = {
                Button(
                    enabled = !state.isPublishing &&
                        (draftTitle.isNotBlank() || draft.isNotBlank() || draftImages.isNotEmpty()),
                    onClick = {
                        viewModel.createPost(draftTitle, draft, draftImages) { ok ->
                            if (ok) {
                                draftTitle = ""
                                draft = ""
                                draftImages = emptyList()
                                showComposer = false
                            }
                        }
                    },
                ) {
                    Text(if (state.isPublishing) "Публикация…" else "Опубликовать")
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !state.isPublishing,
                    onClick = { showComposer = false },
                ) { Text("Отмена") }
            },
        )
    }

    viewerState?.let { viewer ->
        MediaViewerOverlay(
            state = viewer,
            onDismiss = { viewerState = null },
            onSaveToGallery = { item -> viewModel.saveViewerItem(context, item, toGallery = true) },
            onDownload = { item -> viewModel.saveViewerItem(context, item, toGallery = false) },
        )
    }
}

@Composable
private fun FeedThreadPane(
    post: FeedPostDto?,
    loading: Boolean,
    comments: List<FeedCommentDto>,
    commentsLoading: Boolean,
    isServerNewsChannel: Boolean,
    currentUserId: String,
    replyToCommentId: String?,
    commentDraft: String,
    onCommentDraftChange: (String) -> Unit,
    onReplyTo: (String?) -> Unit,
    onReaction: (FeedPostDto, String) -> Unit,
    onCommentReaction: (FeedCommentDto, String) -> Unit,
    onSendComment: () -> Unit,
    onDeleteComment: (String) -> Unit,
    onDeletePost: () -> Unit,
    onShare: (FeedPostDto) -> Unit,
    onOpenImage: (FeedPostDto, Int) -> Unit,
    onRetry: () -> Unit,
) {
    if (post == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (loading) {
                CircularProgressIndicator()
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Пост не найден")
                    TextButton(onClick = onRetry) { Text("Повторить") }
                }
            }
        }
        return
    }

    val tree = remember(comments) { buildFeedCommentTree(comments) }
    val replyTarget = comments.firstOrNull { it.id == replyToCommentId }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                FeedPostDetail(
                    post = post,
                    isServerNewsChannel = isServerNewsChannel,
                    currentUserId = currentUserId,
                    onReaction = { onReaction(post, it) },
                    onDeletePost = onDeletePost,
                    onShare = { onShare(post) },
                    onOpenImage = { onOpenImage(post, it) },
                )
            }
            item {
                Text(
                    text = "Комментарии · ${(post.commentsCount ?: comments.size)}",
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            if (commentsLoading && comments.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    }
                }
            } else if (comments.isEmpty()) {
                item {
                    Text(
                        text = "Пока нет комментариев — напишите первым.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            } else {
                items(tree, key = { it.comment.id ?: it.hashCode().toString() }) { node ->
                    CommentTreeItem(
                        node = node,
                        depth = 0,
                        currentUserId = currentUserId,
                        replyToCommentId = replyToCommentId,
                        onReply = onReplyTo,
                        onReaction = onCommentReaction,
                        onDelete = onDeleteComment,
                    )
                }
            }
        }

        Surface(tonalElevation = 2.dp) {
            Column(modifier = Modifier.padding(12.dp)) {
                if (replyTarget != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = "Ответ для ${
                                replyTarget.authorName?.ifBlank { replyTarget.authorUsername }
                                    .orEmpty().ifBlank { "комментария" }
                            }",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        IconButton(onClick = { onReplyTo(null) }) {
                            Icon(Icons.Default.Close, contentDescription = "Отменить ответ")
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = commentDraft,
                        onValueChange = onCommentDraftChange,
                        modifier = Modifier.weight(1f),
                        placeholder = {
                            Text(if (replyTarget != null) "Ваш ответ" else "Комментарий")
                        },
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(onClick = onSendComment, enabled = commentDraft.isNotBlank()) {
                        Text("Отправить")
                    }
                }
            }
        }
    }
}

@Composable
private fun FeedThreadCard(
    post: FeedPostDto,
    isServerNewsChannel: Boolean,
    currentUserId: String,
    onOpen: () -> Unit,
    onReaction: (String) -> Unit,
    onDeletePost: () -> Unit,
    onShare: () -> Unit,
    onOpenImage: (Int) -> Unit,
) {
    val title = resolveFeedPostTitle(post)
    val preview = resolveFeedPostPreview(post)
    val score = (post.likesCount ?: 0) - (post.dislikesCount ?: 0)
    val scoreColor = when (post.myReaction) {
        "like" -> LikeOrange
        "dislike" -> DislikeBlue
        else -> MaterialTheme.colorScheme.onSurface
    }
    val images = post.attachments.orEmpty().filter(::isVisualAttachment)
    val header = feedDisplayHeader(post, isServerNewsChannel)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .clickable(onClick = onOpen),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AuthorAvatar(name = header.displayName, avatar = header.avatarUrl, color = post.authorAvatarColor)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = header.displayName,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (header.metaLine.isNotBlank()) {
                        Text(
                            text = header.metaLine,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                if (post.authorId == currentUserId && currentUserId.isNotBlank()) {
                    IconButton(onClick = onDeletePost) {
                        Icon(Icons.Outlined.Delete, contentDescription = "Удалить пост")
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            if (preview.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = preview,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (images.isNotEmpty()) {
                val context = LocalContext.current
                val density = LocalDensity.current
                val feedImageHeightPx = with(density) { 180.dp.roundToPx() }
                val attachment = images.first()
                val url = resolveAvatarUrl(attachment.filePath)
                if (url != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    val request = remember(url, feedImageHeightPx) {
                        ImageRequest.Builder(context)
                            .data(url)
                            .size(1080, feedImageHeightPx)
                            .crossfade(false)
                            .build()
                    }
                    AsyncImage(
                        model = request,
                        contentDescription = attachment.originalFileName,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onOpenImage(0) },
                        contentScale = ContentScale.Crop,
                    )
                    if (images.size > 1) {
                        Text(
                            text = "+${images.size - 1} вложений",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            VoteAndMetaRow(
                score = score,
                scoreColor = scoreColor,
                myReaction = post.myReaction,
                commentsCount = post.commentsCount ?: 0,
                onReaction = onReaction,
                onCommentsClick = onOpen,
                onShare = onShare,
            )
        }
    }
}

@Composable
private fun FeedPostDetail(
    post: FeedPostDto,
    isServerNewsChannel: Boolean,
    currentUserId: String,
    onReaction: (String) -> Unit,
    onDeletePost: () -> Unit,
    onShare: () -> Unit,
    onOpenImage: (Int) -> Unit,
) {
    val title = resolveFeedPostTitle(post)
    val body = post.text?.trim().orEmpty().let { text ->
        val t = post.title?.trim().orEmpty()
        if (t.isNotEmpty() && text.startsWith(t)) text.removePrefix(t).trim() else text
    }
    val score = (post.likesCount ?: 0) - (post.dislikesCount ?: 0)
    val scoreColor = when (post.myReaction) {
        "like" -> LikeOrange
        "dislike" -> DislikeBlue
        else -> MaterialTheme.colorScheme.onSurface
    }
    val images = post.attachments.orEmpty().filter(::isVisualAttachment)
    val header = feedDisplayHeader(post, isServerNewsChannel)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AuthorAvatar(name = header.displayName, avatar = header.avatarUrl, color = post.authorAvatarColor)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = header.displayName,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (header.metaLine.isNotBlank()) {
                        Text(
                            text = header.metaLine,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                if (post.authorId == currentUserId && currentUserId.isNotBlank()) {
                    IconButton(onClick = onDeletePost) {
                        Icon(Icons.Outlined.Delete, contentDescription = "Удалить пост")
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleLarge,
            )
            if (body.isNotBlank() && body != title) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(body)
            }

            val context = LocalContext.current
            val density = LocalDensity.current
            val feedImageHeightPx = with(density) { 220.dp.roundToPx() }
            images.forEachIndexed { index, attachment ->
                val url = resolveAvatarUrl(attachment.filePath) ?: return@forEachIndexed
                Spacer(modifier = Modifier.height(8.dp))
                val request = remember(url, feedImageHeightPx) {
                    ImageRequest.Builder(context)
                        .data(url)
                        .size(1080, feedImageHeightPx)
                        .crossfade(false)
                        .build()
                }
                AsyncImage(
                    model = request,
                    contentDescription = attachment.originalFileName,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onOpenImage(index) },
                    contentScale = ContentScale.Crop,
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            VoteAndMetaRow(
                score = score,
                scoreColor = scoreColor,
                myReaction = post.myReaction,
                commentsCount = post.commentsCount ?: 0,
                onReaction = onReaction,
                onCommentsClick = {},
                onShare = onShare,
                showComments = false,
            )
        }
    }
}

@Composable
private fun VoteAndMetaRow(
    score: Int,
    scoreColor: Color,
    myReaction: String?,
    commentsCount: Int,
    onReaction: (String) -> Unit,
    onCommentsClick: () -> Unit,
    onShare: () -> Unit,
    showComments: Boolean = true,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { onReaction("like") }) {
                    Icon(
                        Icons.Default.ThumbUp,
                        contentDescription = "Нравится",
                        tint = if (myReaction == "like") LikeOrange else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = score.toString(),
                    color = scoreColor,
                    fontWeight = FontWeight.SemiBold,
                )
                IconButton(onClick = { onReaction("dislike") }) {
                    Icon(
                        Icons.Default.ThumbDown,
                        contentDescription = "Не нравится",
                        tint = if (myReaction == "dislike") DislikeBlue else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (showComments) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.clickable(onClick = onCommentsClick),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Outlined.ChatBubbleOutline,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(commentsCount.toString())
                }
            }
        }
        TextButton(onClick = onShare) {
            Icon(Icons.Outlined.Share, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Поделиться")
        }
    }
}

@Composable
private fun CommentTreeItem(
    node: FeedCommentNode,
    depth: Int,
    currentUserId: String,
    replyToCommentId: String?,
    onReply: (String?) -> Unit,
    onReaction: (FeedCommentDto, String) -> Unit,
    onDelete: (String) -> Unit,
) {
    val comment = node.comment
    val score = (comment.likesCount ?: 0) - (comment.dislikesCount ?: 0)
    val scoreColor = when (comment.myReaction) {
        "like" -> LikeOrange
        "dislike" -> DislikeBlue
        else -> MaterialTheme.colorScheme.onSurface
    }
    val indent = (depth.coerceAtMost(MaxCommentDepth) * 12).dp
    val highlighted = comment.id == replyToCommentId

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 12.dp + indent, end = 12.dp, top = 4.dp, bottom = 4.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (highlighted) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
            } else {
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
            },
        ) {
            Column(modifier = Modifier.padding(10.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    AuthorAvatar(
                        name = comment.authorName,
                        avatar = comment.authorAvatar,
                        color = comment.authorAvatarColor,
                        size = 28,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = comment.authorName?.ifBlank { comment.authorUsername }
                                .orEmpty().ifBlank { "Пользователь" },
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = formatFeedTime(comment.createdAt),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(comment.text.orEmpty())
                    }
                    if (comment.authorId == currentUserId && currentUserId.isNotBlank()) {
                        IconButton(onClick = { comment.id?.let(onDelete) }) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "Удалить комментарий",
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    IconButton(
                        onClick = { onReaction(comment, "like") },
                        modifier = Modifier.size(32.dp),
                    ) {
                        Icon(
                            Icons.Default.ThumbUp,
                            contentDescription = "Нравится",
                            modifier = Modifier.size(16.dp),
                            tint = if (comment.myReaction == "like") {
                                LikeOrange
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                        )
                    }
                    Text(
                        text = score.toString(),
                        style = MaterialTheme.typography.bodySmall,
                        color = scoreColor,
                        fontWeight = FontWeight.SemiBold,
                    )
                    IconButton(
                        onClick = { onReaction(comment, "dislike") },
                        modifier = Modifier.size(32.dp),
                    ) {
                        Icon(
                            Icons.Default.ThumbDown,
                            contentDescription = "Не нравится",
                            modifier = Modifier.size(16.dp),
                            tint = if (comment.myReaction == "dislike") {
                                DislikeBlue
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                        )
                    }
                    if (depth < MaxCommentDepth) {
                        TextButton(onClick = { onReply(comment.id) }) {
                            Text("Ответить")
                        }
                    }
                }
            }
        }
        node.children.forEach { child ->
            CommentTreeItem(
                node = child,
                depth = depth + 1,
                currentUserId = currentUserId,
                replyToCommentId = replyToCommentId,
                onReply = onReply,
                onReaction = onReaction,
                onDelete = onDelete,
            )
        }
    }
}

@Composable
private fun AuthorAvatar(
    name: String?,
    avatar: String?,
    color: String?,
    size: Int = 36,
) {
    val url = resolveAvatarUrl(avatar)
    val letter = name?.trim()?.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
    val context = LocalContext.current
    val sizePx = with(LocalDensity.current) { size.dp.roundToPx() }
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(parseHexColor(color)),
        contentAlignment = Alignment.Center,
    ) {
        if (url != null) {
            val request = remember(url, sizePx) {
                ImageRequest.Builder(context)
                    .data(url)
                    .size(sizePx)
                    .crossfade(false)
                    .build()
            }
            AsyncImage(
                model = request,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Text(letter, color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

private data class FeedDisplayHeader(
    val displayName: String,
    val avatarUrl: String?,
    val metaLine: String,
)

private fun feedDisplayHeader(post: FeedPostDto, isServerNewsChannel: Boolean): FeedDisplayHeader {
    val isServerPostInFriendFeed =
        !isServerNewsChannel && post.scope.equals("server", ignoreCase = true)
    val displayName = when {
        isServerNewsChannel ->
            post.authorName?.ifBlank { post.authorUsername }.orEmpty().ifBlank { "Пользователь" }
        isServerPostInFriendFeed ->
            post.serverName?.takeIf { it.isNotBlank() }
                ?: post.authorName?.ifBlank { post.authorUsername }.orEmpty().ifBlank { "Сервер" }
        else ->
            post.authorName?.ifBlank { post.authorUsername }.orEmpty().ifBlank { "Пользователь" }
    }
    val avatarUrl = when {
        isServerNewsChannel -> post.authorAvatar
        isServerPostInFriendFeed ->
            post.serverAvatar?.takeIf { it.isNotBlank() } ?: post.authorAvatar
        else -> post.authorAvatar
    }
    val metaLine = buildList {
        add(formatFeedTime(post.createdAt).ifBlank { null })
        if (isServerPostInFriendFeed) {
            add("сервер")
            post.authorName?.takeIf { it.isNotBlank() }?.let { add(it) }
        }
    }.mapNotNull { it }.joinToString(" · ")
    return FeedDisplayHeader(displayName, avatarUrl, metaLine)
}

private fun viewerStateFor(post: FeedPostDto, index: Int): MediaViewerState? {
    val visual = post.attachments.orEmpty().filter(::isVisualAttachment)
    if (visual.isEmpty()) return null
    val items = visual.map { attachment ->
        val path = attachment.filePath.orEmpty()
        val type = attachment.contentType?.takeIf { it.isNotBlank() } ?: "image/jpeg"
        MediaViewerItem(
            url = resolveAvatarUrl(path).orEmpty(),
            filePath = path,
            contentType = type,
            isVideo = type.startsWith("video/"),
            senderUsername = post.authorName.orEmpty(),
            createdAt = post.createdAt.orEmpty(),
            caption = post.text.orEmpty(),
            fileName = attachment.originalFileName ?: attachment.fileName ?: "photo",
        )
    }
    return MediaViewerState(items = items, initialIndex = index.coerceIn(0, items.lastIndex))
}

private fun isVisualAttachment(attachment: FeedAttachmentDto): Boolean {
    val type = attachment.contentType.orEmpty()
    return type.startsWith("image/") || type.startsWith("video/") || type.isBlank()
}

private fun sharePost(context: android.content.Context, post: FeedPostDto) {
    val title = resolveFeedPostTitle(post)
    val author = if (post.scope.equals("server", ignoreCase = true)) {
        post.serverName?.takeIf { it.isNotBlank() }
            ?: post.authorName?.ifBlank { post.authorUsername }.orEmpty().ifBlank { "Пост" }
    } else {
        post.authorName?.ifBlank { post.authorUsername }.orEmpty().ifBlank { "Пост" }
    }
    val body = listOf(author, title, post.text.orEmpty()).filter { it.isNotBlank() }.distinct().joinToString("\n")
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, body.ifBlank { "Пост в Whithin" })
    }
    context.startActivity(Intent.createChooser(intent, "Поделиться"))
}

private fun parseHexColor(raw: String?): Color {
    val value = raw?.trim().orEmpty()
    if (value.isEmpty()) return Color(0xFF5865F2)
    return runCatching { Color(android.graphics.Color.parseColor(value)) }.getOrDefault(Color(0xFF5865F2))
}

private fun formatFeedTime(raw: String?): String {
    if (raw.isNullOrBlank()) return ""
    val patterns = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ss.SSS",
        "yyyy-MM-dd'T'HH:mm:ss",
    )
    val date = patterns.firstNotNullOfOrNull { pattern ->
        runCatching {
            SimpleDateFormat(pattern, Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.parse(raw)
        }.getOrNull()
    } ?: return ""
    val minutes = (System.currentTimeMillis() - date.time) / 60_000
    return when {
        minutes < 1 -> "только что"
        minutes < 60 -> "$minutes мин"
        minutes < 60 * 24 -> "${minutes / 60} ч"
        minutes < 60 * 24 * 7 -> "${minutes / (60 * 24)} д"
        else -> SimpleDateFormat("d MMM", Locale("ru")).format(date)
    }
}
