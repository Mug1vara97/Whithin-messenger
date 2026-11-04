package com.whithin.voice.presentation.ui.media

import android.content.Context
import coil.ImageLoader
import coil.request.ImageRequest
import com.whithin.voice.data.model.Message
import com.whithin.voice.data.model.stickerImageUrl
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Warms Coil disk/memory cache for avatars and recent chat media so the first scroll
 * does not decode everything from network on the critical path.
 */
@Singleton
class ChatImagePrefetcher @Inject constructor(
    @ApplicationContext private val context: Context,
    private val imageLoader: ImageLoader,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun prefetchRecentMessages(
        messages: List<Message>,
        limit: Int = PREFETCH_MESSAGE_LIMIT,
    ) {
        if (messages.isEmpty()) return
        scope.launch {
            val urls = LinkedHashSet<String>(limit * 2)
            // Newest messages first (repo usually keeps chronological or reverse — take both ends).
            val sample =
                buildList {
                    addAll(messages.takeLast(limit))
                    if (messages.size > limit) addAll(messages.take(limit / 2))
                }
            for (message in sample) {
                resolveAvatarUrl(message.avatarUrlValue)?.let { urls.add(it) }
                val stickerPath =
                    message.sticker?.filePathValue?.takeIf { it.isNotBlank() }
                        ?: message.stickerAlt?.filePathValue?.takeIf { it.isNotBlank() }
                if (!stickerPath.isNullOrBlank()) {
                    urls.add(stickerImageUrl(stickerPath))
                }
                message.mediaFilesValue.take(2).forEach { media ->
                    val thumb = media.thumbnailPathValue ?: media.filePathValue
                    resolveAvatarUrl(thumb)?.let { urls.add(it) }
                }
                if (urls.size >= PREFETCH_URL_CAP) break
            }
            urls.take(PREFETCH_URL_CAP).forEach { url ->
                // Тот же diskCacheKey и memory-bucket, что у чат-фото — префетч реально
                // прогревает то, что потом покажет ImageMessageItem.
                val request = buildChatPhotoImageRequest(context, url, PREFETCH_DECODE_PX, PREFETCH_DECODE_PX)
                runCatching { imageLoader.enqueue(request) }
            }
        }
    }

    companion object {
        private const val PREFETCH_MESSAGE_LIMIT = 40
        private const val PREFETCH_URL_CAP = 48
        /** Ближе к типичной ширине колонки (~360–420dp), bucket совпадёт с чатом. */
        private const val PREFETCH_DECODE_PX = 512
    }
}
