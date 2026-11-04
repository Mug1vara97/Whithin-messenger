@file:OptIn(ExperimentalFoundationApi::class)

package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.whithin.voice.data.local.StickerCacheManager
import com.whithin.voice.data.model.Sticker
import com.whithin.voice.data.model.stickerImageUrl
import com.whithin.voice.presentation.ui.media.buildChatStickerImageRequest

@Composable
fun StickerAnimatedGridItem(
    sticker: Sticker,
    cacheManager: StickerCacheManager,
    modifier: Modifier = Modifier,
    previewSizeDp: Dp = 56.dp,
    /** Grid cells should stay static; long-press preview may animate. */
    playAnimation: Boolean = false,
) {
    val remoteUrl = stickerImageUrl(sticker.filePathValue)
    val isLegacyWebm = sticker.isVideoSticker
    val context = LocalContext.current
    val px = with(LocalDensity.current) { previewSizeDp.roundToPx().coerceAtLeast(1) }

    if (isLegacyWebm) {
        var frame by remember(remoteUrl) { mutableStateOf<android.graphics.Bitmap?>(null) }

        LaunchedEffect(remoteUrl) {
            cacheManager.ensureCached(remoteUrl)
            frame = cacheManager.thumbnailLoader.loadVideoFrame(cacheManager.localPlaybackUri(remoteUrl))
        }

        val bitmap = frame
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Стикер",
                contentScale = ContentScale.Fit,
                modifier = modifier,
            )
        }
        return
    }

    val request =
        remember(remoteUrl, px, playAnimation) {
            buildChatStickerImageRequest(
                context = context,
                url = remoteUrl,
                sizePx = px,
                playAnimation = playAnimation,
            )
        }
    AsyncImage(
        model = request,
        contentDescription = "Стикер",
        contentScale = ContentScale.Fit,
        modifier = modifier,
    )
}

@Composable
fun StickerGridCell(
    sticker: Sticker,
    cacheManager: StickerCacheManager,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(60.dp)
                .combinedClickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                    onClick = onClick,
                    onLongClick = onLongClick,
                ),
        contentAlignment = Alignment.Center,
    ) {
        StickerAnimatedGridItem(
            sticker = sticker,
            cacheManager = cacheManager,
            modifier =
                Modifier
                    .widthIn(max = 60.dp)
                    .heightIn(max = 60.dp),
            previewSizeDp = 60.dp,
            playAnimation = false,
        )
    }
}

@Composable
fun StickerLongPressPreviewOverlay(
    sticker: Sticker,
    cacheManager: StickerCacheManager,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.48f))
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                    onClick = onDismiss,
                ),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(196.dp)
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                        onClick = {},
                    ),
            contentAlignment = Alignment.Center,
        ) {
            StickerAnimatedGridItem(
                sticker = sticker,
                cacheManager = cacheManager,
                modifier = Modifier.size(180.dp),
                previewSizeDp = 180.dp,
                playAnimation = true,
            )
        }
    }
}
