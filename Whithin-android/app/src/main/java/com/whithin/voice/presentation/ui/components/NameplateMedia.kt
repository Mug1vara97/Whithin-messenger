package com.whithin.voice.presentation.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp

/**
 * Nameplate media on Android: WebM via [ProfileWebmVideoView], WebP/APNG/GIF via [ProfileAnimatedImageView].
 *
 * Lists must pass [playAnimation]=false (and keep limiter) — otherwise every row starts
 * FrameSeqDecoder / ExoPlayer and scroll janks.
 */
@Composable
fun NameplateMedia(
    nameplate: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    mediaAlignment: Alignment = Alignment.CenterEnd,
    previewSizeDp: Dp,
    playAnimation: Boolean = true,
    /** Only for a single profile/header preview — never in Lazy lists. */
    bypassWebmLimiter: Boolean = false,
) {
    LoopingProfileMedia(
        mediaPath = nameplate,
        modifier = modifier,
        contentScale = contentScale,
        mediaAlignment = mediaAlignment,
        previewSizeDp = previewSizeDp,
        animateWebm = playAnimation,
        bypassWebmLimiter = bypassWebmLimiter && playAnimation,
        playAnimation = playAnimation,
    )
}
