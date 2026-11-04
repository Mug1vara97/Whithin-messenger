package com.whithin.voice.presentation.ui.media

import android.content.Context
import android.content.SharedPreferences
import android.util.LruCache
import androidx.compose.ui.unit.IntSize
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.size.Precision
import coil.size.Scale
import com.whithin.voice.data.model.MediaFile

/**
 * Intrinsic size cache for chat photos / video thumbnails.
 *
 * Telegram ships photo/video dimensions inside the message, so layout is final on first
 * draw. Our backend does not send them yet, so we remember the size the first time a
 * thumbnail is decoded (memory + SharedPreferences) and reuse it on the next open — after
 * that the chat lays media out exactly like Telegram would with known dimensions.
 *
 * Server-side `width`/`height` (if present on [MediaFile]) seed the cache and always win.
 */
object MediaAspectCache {
    private const val PREFS_NAME = "media_aspect_cache"
    private const val MAX_PERSISTED = 3000

    private val cache = LruCache<String, Long>(4096)

    @Volatile
    private var prefs: SharedPreferences? = null

    fun ensureLoaded(context: Context) {
        if (prefs != null) return
        synchronized(this) {
            if (prefs != null) return
            val p = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val all = p.all
            if (all.size > MAX_PERSISTED) {
                p.edit().clear().apply()
            } else {
                for ((k, v) in all) {
                    val s = v as? String ?: continue
                    val sep = s.indexOf('x')
                    if (sep <= 0) continue
                    val w = s.substring(0, sep).toIntOrNull() ?: continue
                    val h = s.substring(sep + 1).toIntOrNull() ?: continue
                    if (w > 0 && h > 0) cache.put(k, pack(w, h))
                }
            }
            prefs = p
        }
    }

    fun get(url: String): IntSize? {
        if (url.isBlank()) return null
        val packed = cache.get(url) ?: return null
        return IntSize((packed ushr 32).toInt(), (packed and 0xFFFFFFFFL).toInt())
    }

    fun put(url: String, width: Int, height: Int) {
        if (url.isBlank() || width <= 0 || height <= 0) return
        val packed = pack(width, height)
        if (cache.get(url) == packed) return
        cache.put(url, packed)
        prefs?.edit()?.putString(url, "${width}x$height")?.apply()
    }

    /** Seeds the cache from server-provided dimensions (no-op when absent). */
    fun seed(url: String, media: MediaFile) {
        val w = media.widthValue
        val h = media.heightValue
        if (w > 0 && h > 0) put(url, w, h)
    }

    /**
     * Decodes a tiny version of [url] to learn its aspect ratio.
     * Cheap (thumbnails are small, result is cached by Coil) and runs off the main thread.
     */
    suspend fun probe(context: Context, url: String): IntSize? {
        get(url)?.let { return it }
        if (url.isBlank()) return null
        val request =
            ImageRequest.Builder(context)
                .data(url)
                .size(96, 96)
                .scale(Scale.FIT)
                .precision(Precision.INEXACT)
                .allowHardware(false)
                .memoryCacheKey("$url#aspect-probe")
                .diskCacheKey(url)
                .build()
        val result = runCatching { context.imageLoader.execute(request) }.getOrNull()
        val drawable = (result as? SuccessResult)?.drawable ?: return null
        val w = drawable.intrinsicWidth
        val h = drawable.intrinsicHeight
        if (w <= 0 || h <= 0) return null
        put(url, w, h)
        return IntSize(w, h)
    }

    private fun pack(w: Int, h: Int): Long = (w.toLong() shl 32) or (h.toLong() and 0xFFFFFFFFL)
}
