package com.whithin.voice.presentation.ui.components

import android.graphics.drawable.Animatable
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImagePainter
import coil.compose.rememberAsyncImagePainter
import com.whithin.voice.data.model.stickerImageUrl
import com.whithin.voice.data.model.stickerIsVideo
import com.whithin.voice.presentation.ui.media.ChatAnimationPlayback
import com.whithin.voice.presentation.ui.media.buildChatStickerImageRequest

/** true, пока LazyColumn чата скроллится. */
val LocalChatListScrolling = staticCompositionLocalOf { false }

/**
 * false во время скролла и короткий settle после fling — не стартуем FrameSeqDecoder пачкой.
 * Декодер при этом не пересоздаём (см. [StickerMedia]).
 */
val LocalChatAnimationsAllowed = staticCompositionLocalOf { true }

@Composable
fun StickerMedia(
    filePath: String,
    contentType: String?,
    contentDescription: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    previewSizeDp: Dp = 56.dp,
) {
    val url = stickerImageUrl(filePath)
    val isLegacyWebm = stickerIsVideo(contentType, filePath)
    val context = LocalContext.current
    val px = with(LocalDensity.current) { previewSizeDp.roundToPx().coerceAtLeast(1) }
    val animationsAllowed = LocalChatAnimationsAllowed.current

    if (isLegacyWebm) {
        val loader = remember { StickerThumbnailLoader.get(context) }
        var frame by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }
        LaunchedEffect(url) {
            frame = loader.loadVideoFrame(url)
        }
        val bitmap = frame
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = contentDescription,
                contentScale = contentScale,
                modifier = modifier,
            )
        }
        return
    }

    // Always use the animated request so scroll toggles only pause/resume — no re-decode.
    val request =
        remember(url, px) {
            buildChatStickerImageRequest(
                context = context,
                url = url,
                sizePx = px,
                playAnimation = true,
            )
        }
    val painter = rememberAsyncImagePainter(model = request)

    LaunchedEffect(animationsAllowed, painter.state) {
        val drawable =
            (painter.state as? AsyncImagePainter.State.Success)
                ?.result
                ?.drawable as? Animatable
                ?: return@LaunchedEffect
        if (!animationsAllowed) {
            ChatAnimationPlayback.stop(drawable)
        } else {
            ChatAnimationPlayback.startIfAllowed(drawable)
        }
    }

    Image(
        painter = painter,
        contentDescription = contentDescription,
        contentScale = contentScale,
        modifier = modifier,
    )
}
