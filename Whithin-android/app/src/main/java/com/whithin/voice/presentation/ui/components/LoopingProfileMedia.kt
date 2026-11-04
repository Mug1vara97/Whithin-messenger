package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.ui.media.ProfileAnimatedImageView
import com.whithin.voice.presentation.ui.media.ProfileMediaLogger
import com.whithin.voice.presentation.ui.media.ProfileWebmPlaybackLimiter
import com.whithin.voice.presentation.ui.media.isProfileMediaVideo
import com.whithin.voice.presentation.ui.media.resolveAndroidProfileImageUrl
import com.whithin.voice.presentation.ui.media.resolveProfileMediaUrl

/**
 * Avatar decoration, nameplate ([NameplateMedia]), and other looping profile media.
 * - WebP/APNG/GIF: [ProfileAnimatedImageView] (ImageView + Coil animated decoders).
 * - WebM: ExoPlayer via [ProfileWebmVideoView], static poster underneath.
 */
@Composable
fun LoopingProfileMedia(
    mediaPath: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    mediaAlignment: Alignment = Alignment.Center,
    previewSizeDp: Dp = 128.dp,
    animateWebm: Boolean = true,
    bypassWebmLimiter: Boolean = false,
    /** false = keep decoded drawable, stop Animatable (chat scroll). */
    playAnimation: Boolean = true,
) {
    val url = remember(mediaPath) { resolveProfileMediaUrl(mediaPath) }
    if (url.isNullOrBlank()) return

    val isVideo = isProfileMediaVideo(mediaPath)
    val webpFallbackUrl =
        remember(mediaPath, isVideo, url) {
            if (!isVideo || url.startsWith("asset://")) return@remember null
            val alt = resolveAndroidProfileImageUrl(mediaPath) ?: return@remember null
            if (alt.equals(url, ignoreCase = true)) null else alt
        }
    val px = with(LocalDensity.current) { previewSizeDp.roundToPx().coerceAtLeast(1) }

    DisposableEffect(url, isVideo, animateWebm, webpFallbackUrl, bypassWebmLimiter) {
        ProfileMediaLogger.i(
            "LoopingProfileMedia path=$mediaPath url=$url webpFallback=$webpFallbackUrl " +
                "isVideo=$isVideo animateWebm=$animateWebm bypassLimiter=$bypassWebmLimiter",
        )
        onDispose {
            ProfileMediaLogger.i("LoopingProfileMedia dispose url=$url")
        }
    }

    if (isVideo) {
        val videoSlotAcquired =
            when {
                !animateWebm -> false
                bypassWebmLimiter -> true
                else -> rememberWebmVideoSlot(url)
            }

        Box(modifier = modifier, contentAlignment = mediaAlignment) {
            ProfileVideoThumbnail(
                url = url,
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale,
                mediaAlignment = mediaAlignment,
            )
            if (videoSlotAcquired) {
                ProfileWebmVideoView(
                    url = url,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = contentScale,
                )
            }
            if (!webpFallbackUrl.isNullOrBlank()) {
                ProfileAnimatedImageView(
                    url = webpFallbackUrl,
                    mediaPath = mediaPath?.replace(Regex("\\.webm$", RegexOption.IGNORE_CASE), ".webp"),
                    decodeSizePx = px,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = contentScale,
                    playAnimation = playAnimation,
                )
            }
        }
        return
    }

    Box(modifier = modifier, contentAlignment = mediaAlignment) {
        ProfileAnimatedImageView(
            url = url,
            mediaPath = mediaPath,
            decodeSizePx = px,
            modifier = Modifier.fillMaxSize(),
            contentScale = contentScale,
            playAnimation = playAnimation,
        )
    }
}

@Composable
private fun rememberWebmVideoSlot(url: String): Boolean {
    var acquired by remember(url) { mutableStateOf(false) }

    LaunchedEffect(url) {
        acquired = ProfileWebmPlaybackLimiter.tryAcquire()
        ProfileMediaLogger.d("webm video slot url=$url acquired=$acquired")
    }

    DisposableEffect(url, acquired) {
        onDispose {
            if (acquired) {
                ProfileWebmPlaybackLimiter.release()
                ProfileMediaLogger.d("webm video slot released url=$url")
            }
        }
    }

    return acquired
}
