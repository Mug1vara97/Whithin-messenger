package com.whithin.voice.presentation.ui.media

import android.graphics.drawable.Animatable
import android.widget.ImageView
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import coil.imageLoader
import coil.request.Disposable
import coil.request.ImageRequest
import coil.size.Scale

private fun ContentScale.toImageViewScaleType(): ImageView.ScaleType =
    when (this) {
        ContentScale.Crop -> ImageView.ScaleType.CENTER_CROP
        ContentScale.FillBounds -> ImageView.ScaleType.FIT_XY
        ContentScale.Inside -> ImageView.ScaleType.CENTER_INSIDE
        else -> ImageView.ScaleType.FIT_CENTER
    }

private class ProfileAnimViewState {
    var loadedUrl: String? = null
    var disposable: Disposable? = null
}

private fun ImageView.animState(): ProfileAnimViewState =
    (tag as? ProfileAnimViewState) ?: ProfileAnimViewState().also { tag = it }

/**
 * Compose AsyncImage does not reliably repaint custom animated drawables (APNG / penfeizhou WebP).
 * ImageView invalidates on every animation frame.
 */
@Composable
fun ProfileAnimatedImageView(
    url: String,
    mediaPath: String?,
    decodeSizePx: Int,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    playAnimation: Boolean = true,
) {
    val context = LocalContext.current
    val imageLoader = context.imageLoader
    val scaleType = remember(contentScale) { contentScale.toImageViewScaleType() }
    val animated =
        remember(url, mediaPath) {
            isAnimatedRasterImagePath(mediaPath) || isAnimatedRasterImageUrl(url)
        }
    val cacheKey = remember(url, animated) { profileMediaCacheKey(url, animated) }

    DisposableEffect(url, mediaPath, animated, cacheKey) {
        ProfileMediaLogger.i(
            "ProfileAnimatedImageView compose url=$url path=$mediaPath animated=$animated " +
                "play=$playAnimation cacheKey=$cacheKey decodePx=$decodeSizePx",
        )
        onDispose {
            ProfileMediaLogger.i("ProfileAnimatedImageView dispose url=$url")
        }
    }

    key(url) {
        AndroidView(
            modifier = modifier,
            factory = { ctx ->
                ImageView(ctx).apply {
                    this.scaleType = scaleType
                    adjustViewBounds = true
                }
            },
            update = { imageView ->
                imageView.scaleType = scaleType
                val state = imageView.animState()
                if (state.loadedUrl == url) {
                    val drawable = imageView.drawable as? Animatable
                    if (drawable != null) {
                        if (playAnimation) {
                            ChatAnimationPlayback.startIfAllowed(drawable)
                        } else {
                            ChatAnimationPlayback.stop(drawable)
                        }
                    }
                    return@AndroidView
                }

                state.disposable?.dispose()
                state.loadedUrl = url

                ProfileMediaLogger.i("ProfileAnimatedImageView enqueue url=$url animated=$animated")

                val request =
                    ImageRequest.Builder(context)
                        .data(url)
                        .target(imageView)
                        .diskCacheKey(cacheKey)
                        .memoryCacheKey(cacheKey)
                        .crossfade(false)
                        .apply {
                            if (animated) {
                                allowHardware(false)
                                scale(Scale.FIT)
                                setParameter(WHITHIN_PREFER_ANIMATED, true)
                                setParameter(WHITHIN_ANIM_BYTES_KEY, url)
                            } else {
                                size(decodeSizePx)
                            }
                        }
                        .listener(
                            onStart = {
                                ProfileMediaLogger.i("ProfileAnimatedImageView load start url=$url")
                            },
                            onSuccess = { _, result ->
                                val drawable = result.drawable
                                ProfileMediaLogger.i(
                                    "ProfileAnimatedImageView load ok url=$url ${describeDrawable(drawable)}",
                                )
                                if (drawable is Animatable) {
                                    if (playAnimation) {
                                        ChatAnimationPlayback.startIfAllowed(drawable)
                                    } else {
                                        ChatAnimationPlayback.stop(drawable)
                                    }
                                    ProfileMediaLogger.i(
                                        "ProfileAnimatedImageView play=$playAnimation url=$url " +
                                            "after=${describeDrawable(drawable)}",
                                    )
                                } else {
                                    ProfileMediaLogger.w(
                                        "ProfileAnimatedImageView not animatable url=$url drawable=${drawable.javaClass.name}",
                                    )
                                }
                            },
                            onError = { _, result ->
                                ProfileMediaLogger.e(
                                    "ProfileAnimatedImageView load error url=$url",
                                    result.throwable,
                                )
                            },
                            onCancel = {
                                ProfileMediaLogger.w("ProfileAnimatedImageView load cancelled url=$url")
                            },
                        )
                        .build()

                state.disposable = imageLoader.enqueue(request)
            },
            onRelease = { imageView ->
                ProfileMediaLogger.i("ProfileAnimatedImageView release url=$url")
                val state = imageView.tag as? ProfileAnimViewState
                state?.disposable?.dispose()
                imageView.tag = null
                (imageView.drawable as? Animatable)?.let { ChatAnimationPlayback.stop(it) }
                imageView.setImageDrawable(null)
            },
        )
    }
}
