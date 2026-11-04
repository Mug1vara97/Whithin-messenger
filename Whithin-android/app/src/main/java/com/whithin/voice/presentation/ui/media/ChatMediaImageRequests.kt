package com.whithin.voice.presentation.ui.media

import android.content.Context
import android.os.Build
import coil.request.ImageRequest
import coil.size.Precision
import coil.size.Scale

/**
 * Chat sticker Coil requests.
 *
 * - [playAnimation]=true: animated WebP/APNG via custom decoder + [AnimatedMediaBytesCache]
 *   (pause playback while scrolling — do not switch this flag on scroll or LazyColumn
 *   will re-decode).
 * - [playAnimation]=false: sized static frame for grids / previews.
 */
fun buildChatStickerImageRequest(
    context: Context,
    url: String,
    sizePx: Int,
    playAnimation: Boolean = true,
): ImageRequest {
    val px = sizePx.coerceAtLeast(1)
    return if (playAnimation) {
        ImageRequest.Builder(context)
            .data(url)
            .memoryCacheKey("$url#chat-sticker-anim-v2")
            .diskCacheKey(url)
            .crossfade(false)
            .allowHardware(false)
            .setParameter(WHITHIN_PREFER_ANIMATED, true)
            .setParameter(WHITHIN_ANIM_BYTES_KEY, url)
            .build()
    } else {
        ImageRequest.Builder(context)
            .data(url)
            .size(px, px)
            .scale(Scale.FIT)
            .precision(Precision.INEXACT)
            .crossfade(false)
            .allowHardware(Build.VERSION.SDK_INT >= 28)
            .memoryCacheKey("$url#chat-sticker-$px")
            .diskCacheKey("$url#chat-sticker-$px")
            .build()
    }
}

/** Стабильный memory-key: не зависит от точных px после пересчёта aspect (иначе фото грузятся дважды). */
fun chatPhotoMemoryCacheKey(url: String, widthPx: Int, heightPx: Int): String {
    val bucket = chatPhotoSizeBucket(widthPx, heightPx)
    return "$url#chat-photo-$bucket"
}

/** Округление размера декода до корзины 64px — один ключ на URL при мелких пересчётах layout. */
fun chatPhotoSizeBucket(widthPx: Int, heightPx: Int): Int {
    val longest = maxOf(widthPx, heightPx).coerceAtLeast(1).coerceAtMost(CHAT_PHOTO_MAX_DECODE_PX)
    return ((longest + 63) / 64) * 64
}

const val CHAT_PHOTO_MAX_DECODE_PX = 1080

fun buildChatPhotoImageRequest(
    context: Context,
    url: String,
    widthPx: Int,
    heightPx: Int,
): ImageRequest {
    val longest = maxOf(widthPx, heightPx).coerceAtLeast(1).coerceAtMost(CHAT_PHOTO_MAX_DECODE_PX)
    val bucket = chatPhotoSizeBucket(widthPx, heightPx)
    return ImageRequest.Builder(context)
        .data(url)
        // INEXACT + FILL: декодируем ≤ bucket×bucket, Crop в UI подгонит бокс.
        .size(bucket, bucket)
        .scale(Scale.FILL)
        .precision(Precision.INEXACT)
        .crossfade(false)
        .allowHardware(true)
        .memoryCacheKey(chatPhotoMemoryCacheKey(url, widthPx, heightPx))
        // Один disk-entry на URL — префетч и чат делят один файл.
        .diskCacheKey(url)
        .build()
}
