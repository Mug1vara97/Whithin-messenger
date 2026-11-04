package com.whithin.voice.presentation.viewmodel

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.api.FeedApi
import com.whithin.voice.data.local.MediaDownloadHelper
import com.whithin.voice.data.local.MediaSaveTarget
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.model.AddFeedCommentRequest
import com.whithin.voice.data.model.FeedCommentDto
import com.whithin.voice.data.model.FeedPostDto
import com.whithin.voice.data.model.SetFeedReactionRequest
import com.whithin.voice.presentation.ui.media.MediaViewerItem
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

data class FeedUiState(
    val posts: List<FeedPostDto> = emptyList(),
    val isLoading: Boolean = false,
    val isPublishing: Boolean = false,
    val error: String? = null,
    val currentUserId: String = "",
    val commentsByPost: Map<String, List<FeedCommentDto>> = emptyMap(),
    val commentsLoading: Set<String> = emptySet(),
    val reactionBusy: Set<String> = emptySet(),
    val commentReactionBusy: Set<String> = emptySet(),
    /** Открытый тред (Reddit-style). */
    val selectedPostId: String? = null,
    val selectedPost: FeedPostDto? = null,
    val threadLoading: Boolean = false,
    val replyToCommentId: String? = null,
    /** Новости конкретного сервера (канал NEWS), иначе общая лента друзей. */
    val serverId: String? = null,
    val channelName: String = "Лента",
)

@HiltViewModel
class FeedViewModel @Inject constructor(
    private val feedApi: FeedApi,
    private val tokenManager: TokenManager,
    private val mediaDownloadHelper: MediaDownloadHelper,
    @ApplicationContext private val context: Context,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val _uiState = MutableStateFlow(
        FeedUiState(
            serverId = savedStateHandle.get<String>("serverId")
                ?.let { Uri.decode(it) }
                ?.trim()
                ?.takeIf { it.isNotEmpty() && it != "unknown-server" },
            channelName = savedStateHandle.get<String>("channelName")
                ?.let { Uri.decode(it) }
                ?.replace("_", "/")
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: if (savedStateHandle.contains("serverId")) "Новости" else "Лента",
        ),
    )
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    private val isServerNews: Boolean
        get() = !_uiState.value.serverId.isNullOrBlank()

    init {
        _uiState.update { it.copy(currentUserId = tokenManager.peekUserFromToken()?.id.orEmpty()) }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val serverId = _uiState.value.serverId
                val response = if (!serverId.isNullOrBlank()) {
                    feedApi.getServerPosts(serverId)
                } else {
                    feedApi.getFeed()
                }
                if (response.isSuccessful) {
                    val posts = response.body().orEmpty()
                    _uiState.update { state ->
                        val selectedId = state.selectedPostId
                        val refreshedSelected = selectedId?.let { id ->
                            posts.firstOrNull { it.id == id } ?: state.selectedPost
                        }
                        state.copy(
                            isLoading = false,
                            posts = posts,
                            selectedPost = refreshedSelected,
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = if (isServerNews) {
                                "Не удалось загрузить новости сервера"
                            } else {
                                "Не удалось загрузить ленту"
                            },
                        )
                    }
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = if (isServerNews) {
                            "Не удалось загрузить новости сервера"
                        } else {
                            "Не удалось загрузить ленту"
                        },
                    )
                }
            }
        }
    }

    fun openThread(postId: String) {
        val id = postId.trim()
        if (id.isEmpty()) return
        val cached = _uiState.value.posts.firstOrNull { it.id == id }
        _uiState.update {
            it.copy(
                selectedPostId = id,
                selectedPost = cached,
                replyToCommentId = null,
                threadLoading = cached == null,
            )
        }
        loadComments(id)
        if (cached == null) {
            viewModelScope.launch {
                try {
                    val response = feedApi.getPost(id)
                    val post = response.body()
                    if (response.isSuccessful && post != null) {
                        _uiState.update { state ->
                            state.copy(
                                selectedPost = post,
                                threadLoading = false,
                                posts = if (state.posts.any { it.id == id }) {
                                    state.posts.map { if (it.id == id) post else it }
                                } else {
                                    listOf(post) + state.posts
                                },
                            )
                        }
                    } else {
                        _uiState.update { it.copy(threadLoading = false, error = "Не удалось открыть пост") }
                    }
                } catch (_: Exception) {
                    _uiState.update { it.copy(threadLoading = false, error = "Не удалось открыть пост") }
                }
            }
        } else {
            viewModelScope.launch {
                try {
                    val response = feedApi.getPost(id)
                    val post = response.body()
                    if (response.isSuccessful && post != null) {
                        replacePost(post)
                        _uiState.update { it.copy(selectedPost = post) }
                    }
                } catch (_: Exception) {
                }
            }
        }
    }

    fun closeThread() {
        _uiState.update {
            it.copy(selectedPostId = null, selectedPost = null, replyToCommentId = null, threadLoading = false)
        }
    }

    fun setReplyTo(commentId: String?) {
        _uiState.update { it.copy(replyToCommentId = commentId?.takeIf { id -> id.isNotBlank() }) }
    }

    fun setReaction(post: FeedPostDto, value: String) {
        val postId = post.id ?: return
        if (_uiState.value.reactionBusy.contains(postId)) return
        val next = if (post.myReaction == value) null else value
        viewModelScope.launch {
            _uiState.update { it.copy(reactionBusy = it.reactionBusy + postId) }
            try {
                val response = feedApi.setReaction(postId, SetFeedReactionRequest(next))
                val updated = response.body()
                if (response.isSuccessful && updated != null) {
                    replacePost(updated)
                }
            } catch (_: Exception) {
            } finally {
                _uiState.update { it.copy(reactionBusy = it.reactionBusy - postId) }
            }
        }
    }

    fun setCommentReaction(postId: String, comment: FeedCommentDto, value: String) {
        val commentId = comment.id ?: return
        if (_uiState.value.commentReactionBusy.contains(commentId)) return
        val next = if (comment.myReaction == value) null else value
        viewModelScope.launch {
            _uiState.update { it.copy(commentReactionBusy = it.commentReactionBusy + commentId) }
            try {
                val response = feedApi.setCommentReaction(commentId, SetFeedReactionRequest(next))
                val updated = response.body()
                if (response.isSuccessful && updated != null) {
                    _uiState.update { state ->
                        state.copy(
                            commentsByPost = state.commentsByPost + (
                                postId to state.commentsByPost[postId].orEmpty().map { c ->
                                    if (c.id == commentId) updated else c
                                }
                            ),
                        )
                    }
                }
            } catch (_: Exception) {
            } finally {
                _uiState.update { it.copy(commentReactionBusy = it.commentReactionBusy - commentId) }
            }
        }
    }

    fun loadComments(postId: String) {
        if (_uiState.value.commentsLoading.contains(postId)) return
        viewModelScope.launch {
            _uiState.update { it.copy(commentsLoading = it.commentsLoading + postId) }
            try {
                val response = feedApi.getComments(postId)
                if (response.isSuccessful) {
                    _uiState.update {
                        it.copy(commentsByPost = it.commentsByPost + (postId to response.body().orEmpty()))
                    }
                }
            } catch (_: Exception) {
            } finally {
                _uiState.update { it.copy(commentsLoading = it.commentsLoading - postId) }
            }
        }
    }

    fun addComment(postId: String, text: String, parentCommentId: String? = null) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        val parent = parentCommentId?.takeIf { it.isNotBlank() } ?: _uiState.value.replyToCommentId
        viewModelScope.launch {
            try {
                val response = feedApi.addComment(
                    postId,
                    AddFeedCommentRequest(text = trimmed, parentCommentId = parent),
                )
                val comment = response.body()
                if (response.isSuccessful && comment != null) {
                    _uiState.update { state ->
                        state.copy(
                            commentsByPost = state.commentsByPost + (
                                postId to (state.commentsByPost[postId].orEmpty() + comment)
                            ),
                            posts = state.posts.map { post ->
                                if (post.id == postId) {
                                    post.copy(commentsCount = (post.commentsCount ?: 0) + 1)
                                } else {
                                    post
                                }
                            },
                            selectedPost = state.selectedPost?.let { selected ->
                                if (selected.id == postId) {
                                    selected.copy(commentsCount = (selected.commentsCount ?: 0) + 1)
                                } else {
                                    selected
                                }
                            },
                            replyToCommentId = null,
                        )
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    fun deletePost(postId: String) {
        viewModelScope.launch {
            try {
                val response = feedApi.deletePost(postId)
                if (response.isSuccessful) {
                    _uiState.update { state ->
                        val closing = state.selectedPostId == postId
                        state.copy(
                            posts = state.posts.filter { it.id != postId },
                            commentsByPost = state.commentsByPost - postId,
                            selectedPostId = if (closing) null else state.selectedPostId,
                            selectedPost = if (closing) null else state.selectedPost,
                            replyToCommentId = if (closing) null else state.replyToCommentId,
                        )
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    fun saveViewerItem(context: Context, item: MediaViewerItem, toGallery: Boolean) {
        viewModelScope.launch(Dispatchers.IO) {
            val target =
                if (toGallery || item.contentType.startsWith("image/") || item.contentType.startsWith("video/")) {
                    MediaSaveTarget.GALLERY
                } else {
                    MediaSaveTarget.DOWNLOADS
                }
            val result =
                mediaDownloadHelper.saveMedia(
                    context = context,
                    filePath = item.filePath,
                    contentType = item.contentType,
                    displayName = item.fileName,
                    target = if (toGallery) MediaSaveTarget.GALLERY else target,
                )
            withContext(Dispatchers.Main) {
                mediaDownloadHelper.showResultToast(
                    context,
                    result,
                    if (toGallery) MediaSaveTarget.GALLERY else target,
                )
            }
        }
    }

    fun deleteComment(postId: String, commentId: String) {
        viewModelScope.launch {
            try {
                val response = feedApi.deleteComment(commentId)
                if (response.isSuccessful) {
                    _uiState.update { state ->
                        // Drop whole subtree whose parent chain includes deleted id
                        val removedIds = mutableSetOf(commentId)
                        var changed = true
                        val all = state.commentsByPost[postId].orEmpty()
                        while (changed) {
                            changed = false
                            all.forEach { c ->
                                val id = c.id ?: return@forEach
                                val parent = c.parentCommentId
                                if (id !in removedIds && parent != null && parent in removedIds) {
                                    removedIds += id
                                    changed = true
                                }
                            }
                        }
                        val filtered = all.filter { it.id !in removedIds }
                        val removedCount = all.size - filtered.size
                        state.copy(
                            commentsByPost = state.commentsByPost + (postId to filtered),
                            posts = state.posts.map { post ->
                                if (post.id == postId) {
                                    post.copy(
                                        commentsCount = ((post.commentsCount ?: removedCount) - removedCount)
                                            .coerceAtLeast(0),
                                    )
                                } else {
                                    post
                                }
                            },
                            selectedPost = state.selectedPost?.let { selected ->
                                if (selected.id == postId) {
                                    selected.copy(
                                        commentsCount = ((selected.commentsCount ?: removedCount) - removedCount)
                                            .coerceAtLeast(0),
                                    )
                                } else {
                                    selected
                                }
                            },
                            replyToCommentId = if (state.replyToCommentId in removedIds) null else state.replyToCommentId,
                        )
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    fun createPost(title: String, text: String, imageUris: List<Uri>, onDone: (Boolean) -> Unit) {
        val trimmedTitle = title.trim().take(200)
        val trimmedText = text.trim()
        if (trimmedTitle.isEmpty() && trimmedText.isEmpty() && imageUris.isEmpty()) {
            onDone(false)
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isPublishing = true, error = null) }
            try {
                val parts = imageUris.mapIndexedNotNull { index, uri -> uriToPart(uri, index) }
                val serverId = _uiState.value.serverId
                val scope = if (!serverId.isNullOrBlank()) "server" else "friend"
                val bodyText = when {
                    trimmedText.isNotEmpty() -> trimmedText
                    trimmedTitle.isNotEmpty() -> trimmedTitle
                    else -> ""
                }
                val response = feedApi.createPost(
                    title = trimmedTitle
                        .takeIf { it.isNotEmpty() }
                        ?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    text = bodyText.toRequestBody("text/plain".toMediaTypeOrNull()),
                    scope = scope.toRequestBody("text/plain".toMediaTypeOrNull()),
                    serverId = serverId
                        ?.takeIf { it.isNotBlank() }
                        ?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    files = parts,
                )
                val created = response.body()
                if (response.isSuccessful && created != null) {
                    _uiState.update { it.copy(isPublishing = false, posts = listOf(created) + it.posts) }
                    onDone(true)
                } else {
                    _uiState.update { it.copy(isPublishing = false, error = "Не удалось опубликовать пост") }
                    onDone(false)
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isPublishing = false, error = "Не удалось опубликовать пост") }
                onDone(false)
            }
        }
    }

    private fun replacePost(updated: FeedPostDto) {
        val id = updated.id ?: return
        _uiState.update { state ->
            state.copy(
                posts = state.posts.map { if (it.id == id) updated else it },
                selectedPost = if (state.selectedPostId == id) updated else state.selectedPost,
            )
        }
    }

    private fun uriToPart(uri: Uri, index: Int): MultipartBody.Part? {
        val resolver = context.contentResolver
        val mime = resolver.getType(uri) ?: "image/jpeg"
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
        val body = bytes.toRequestBody(mime.toMediaTypeOrNull())
        val ext = if (mime.contains("png")) "png" else "jpg"
        return MultipartBody.Part.createFormData("files", "photo-$index.$ext", body)
    }
}
