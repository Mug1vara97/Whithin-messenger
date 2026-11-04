package com.whithin.voice.presentation.ui.media

import android.util.LruCache

/**
 * Shared raw bytes for animated WebP/APNG.
 * Coil does not reliably memory-cache Animatable drawables, so LazyColumn recycle
 * used to re-read ~3MB from disk on every bind — this cache keeps that to once per URL.
 */
object AnimatedMediaBytesCache {
    private const val MAX_CACHE_BYTES = 48 * 1024 * 1024

    private val lock = Any()
    private val cache =
        object : LruCache<String, ByteArray>(MAX_CACHE_BYTES) {
            override fun sizeOf(
                key: String,
                value: ByteArray,
            ): Int = value.size.coerceAtLeast(1)
        }

    fun getOrPut(
        key: String,
        loader: () -> ByteArray,
    ): ByteArray {
        synchronized(lock) {
            cache.get(key)?.let { return it }
        }
        val bytes = loader()
        synchronized(lock) {
            cache.put(key, bytes)
        }
        return bytes
    }
}
