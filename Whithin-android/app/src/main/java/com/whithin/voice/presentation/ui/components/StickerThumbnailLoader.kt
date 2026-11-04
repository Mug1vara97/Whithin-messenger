package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.util.LruCache
import com.whithin.voice.presentation.ui.media.ProfileMediaLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.withContext

class StickerThumbnailLoader private constructor(context: Context) {
    private val cache = LruCache<String, Bitmap>(96)

    suspend fun loadVideoFrame(url: String): Bitmap? =
        withContext(Dispatchers.IO) {
            cache.get(url)?.let { return@withContext it }

            thumbnailSemaphore.acquire()
            try {
                cache.get(url)?.let { return@withContext it }

                ProfileMediaLogger.d("thumbnail load start url=$url")
                val bitmap =
                    runCatching {
                        val retriever = MediaMetadataRetriever()
                        try {
                            retriever.setDataSource(url, emptyMap())
                            retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                        } finally {
                            runCatching { retriever.release() }
                        }
                    }.onFailure { error ->
                        ProfileMediaLogger.e("thumbnail load failed url=$url", error)
                    }.getOrNull()

                if (bitmap != null) {
                    cache.put(url, bitmap)
                    ProfileMediaLogger.d(
                        "thumbnail load ok url=$url size=${bitmap.width}x${bitmap.height}",
                    )
                } else {
                    ProfileMediaLogger.w("thumbnail load empty url=$url")
                }
                bitmap
            } finally {
                thumbnailSemaphore.release()
            }
        }

    companion object {
        private val thumbnailSemaphore = Semaphore(2)

        @Volatile
        private var instance: StickerThumbnailLoader? = null

        fun get(context: Context): StickerThumbnailLoader =
            instance ?: synchronized(this) {
                instance ?: StickerThumbnailLoader(context.applicationContext).also { instance = it }
            }
    }
}
