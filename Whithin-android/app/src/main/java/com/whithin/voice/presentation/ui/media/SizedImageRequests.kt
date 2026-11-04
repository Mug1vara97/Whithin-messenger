package com.whithin.voice.presentation.ui.media

import android.content.Context
import coil.request.ImageRequest
import coil.size.Precision
import coil.size.Scale

/** Coil request with an explicit decode size — use for list/header thumbnails. */
fun sizedImageRequest(
    context: Context,
    data: Any,
    sizePx: Int,
    scale: Scale = Scale.FILL,
): ImageRequest {
    val px = sizePx.coerceAtLeast(1)
    return ImageRequest.Builder(context)
        .data(data)
        .size(px)
        .scale(scale)
        .precision(Precision.INEXACT)
        .crossfade(false)
        .build()
}

fun sizedImageRequest(
    context: Context,
    data: Any,
    widthPx: Int,
    heightPx: Int,
    scale: Scale = Scale.FILL,
): ImageRequest {
    val w = widthPx.coerceAtLeast(1)
    val h = heightPx.coerceAtLeast(1)
    return ImageRequest.Builder(context)
        .data(data)
        .size(w, h)
        .scale(scale)
        .precision(Precision.INEXACT)
        .crossfade(false)
        .build()
}
