package com.whithin.voice.data.local

import android.content.Context
import coil.ImageLoader
import coil.request.ImageRequest
import com.whithin.voice.data.model.Sticker
import com.whithin.voice.data.model.stickerImageUrl
import com.whithin.voice.data.model.stickerIsVideo
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StickerCacheManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val okHttpClient: OkHttpClient,
    private val imageLoader: ImageLoader,
) {
    private val diskDir = File(context.cacheDir, "sticker_media").apply { mkdirs() }

    val thumbnailLoader = StickerThumbnailLoader(context.applicationContext)

    suspend fun preloadStickers(stickers: List<Sticker>) {
        if (stickers.isEmpty()) return
        withContext(Dispatchers.IO) {
            stickers.take(40).forEach { sticker ->
                val url = stickerImageUrl(sticker.filePathValue)
                if (stickerIsVideo(sticker.contentTypeValue, sticker.filePathValue)) {
                    ensureCached(url)
                    thumbnailLoader.loadVideoFrame(localPlaybackUri(url))
                } else {
                    imageLoader.enqueue(
                        ImageRequest.Builder(context)
                            .data(url)
                            .size(112)
                            .diskCacheKey(url)
                            .memoryCacheKey(url)
                            .build(),
                    )
                }
            }
        }
    }

    fun isCached(remoteUrl: String): Boolean {
        val file = fileForUrl(remoteUrl)
        return file.exists() && file.length() > 0
    }

    suspend fun ensureCached(remoteUrl: String): File? =
        withContext(Dispatchers.IO) {
            val target = fileForUrl(remoteUrl)
            if (target.exists() && target.length() > 0) return@withContext target
            runCatching {
                val request = Request.Builder().url(remoteUrl).get().build()
                okHttpClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) return@runCatching null
                    val body = response.body ?: return@runCatching null
                    target.parentFile?.mkdirs()
                    target.outputStream().use { out -> body.byteStream().copyTo(out) }
                    target
                }
            }.getOrNull()
        }

    fun localPlaybackUri(remoteUrl: String): String {
        val file = fileForUrl(remoteUrl)
        return if (file.exists() && file.length() > 0) {
            file.toURI().toString()
        } else {
            remoteUrl
        }
    }

    private fun fileForUrl(url: String): File {
        val hash = MessageDigest.getInstance("SHA-256")
            .digest(url.toByteArray())
            .joinToString("") { "%02x".format(it) }
        val ext = url.substringAfterLast('.', "bin").take(8)
        return File(diskDir, "$hash.$ext")
    }
}
