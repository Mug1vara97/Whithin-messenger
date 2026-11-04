package com.whithin.voice.data.local

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

class StickerThumbnailLoader(
    private val context: Context,
) {
    private val frameCache = ConcurrentHashMap<String, Bitmap>()

    suspend fun loadVideoFrame(uri: String): Bitmap? =
        withContext(Dispatchers.IO) {
            frameCache[uri]?.let { return@withContext it }
            runCatching {
                val retriever = MediaMetadataRetriever()
                try {
                    when {
                        uri.startsWith("http://") || uri.startsWith("https://") ->
                            retriever.setDataSource(uri, emptyMap())
                        uri.startsWith("content://") || uri.startsWith("file://") ->
                            retriever.setDataSource(context, Uri.parse(uri))
                        else -> retriever.setDataSource(uri)
                    }
                    retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                } finally {
                    retriever.release()
                }
            }.getOrNull()?.also { frameCache[uri] = it }
        }
}
