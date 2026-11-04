package com.whithin.voice.presentation.ui.media

import android.content.Context
import coil.request.ImageRequest
import coil.size.Scale

fun isAnimatedRasterImagePath(path: String?): Boolean {
    if (path.isNullOrBlank()) return false
    // Не считаем все .png анимированными — иначе стикеры/фото в чате
    // декодятся без size на software bitmap и лагает скролл.
    return path.contains(".webp", ignoreCase = true) ||
        path.contains(".gif", ignoreCase = true) ||
        path.contains(".apng", ignoreCase = true) ||
        path.contains("avatar-decoration", ignoreCase = true) ||
        path.contains("nameplate", ignoreCase = true)
}

fun isAnimatedRasterImageUrl(url: String?): Boolean {
    if (url.isNullOrBlank()) return false
    return url.contains(".webp", ignoreCase = true) ||
        url.contains(".gif", ignoreCase = true) ||
        url.contains(".apng", ignoreCase = true) ||
        url.contains("avatar-decoration", ignoreCase = true) ||
        url.contains("nameplate", ignoreCase = true)
}

internal const val PROFILE_ANIM_CACHE_SUFFIX = "#profile-anim-v4"

fun profileMediaCacheKey(url: String, animated: Boolean): String =
    if (animated) "$url$PROFILE_ANIM_CACHE_SUFFIX" else url

/**
 * Coil turns animated WebP/GIF into a static bitmap when [ImageRequest.size] is set.
 * Profile decorations must keep the animated drawable.
 */
fun buildProfileMediaImageRequest(
    context: Context,
    url: String,
    mediaPath: String? = null,
    decodeSizePx: Int,
): ImageRequest {
    val animated = isAnimatedRasterImagePath(mediaPath) || isAnimatedRasterImageUrl(url)
    val cacheKey = profileMediaCacheKey(url, animated)
    val builder =
        ImageRequest.Builder(context)
            .data(url)
            .diskCacheKey(cacheKey)
            .memoryCacheKey(cacheKey)
            .crossfade(false)

    return if (animated) {
        builder
            .allowHardware(false)
            .scale(Scale.FIT)
            .setParameter(WHITHIN_PREFER_ANIMATED, true)
            .setParameter(WHITHIN_ANIM_BYTES_KEY, url)
            .build()
    } else {
        builder
            .size(decodeSizePx)
            .build()
    }
}
