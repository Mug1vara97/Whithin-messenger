package com.whithin.voice.presentation.ui.components

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView

@UnstableApi
@Composable
fun VideoEditOverlay(
    videoUri: Uri,
    onCancel: () -> Unit,
    onDone: (VideoSpatialCrop?) -> Unit,
) {
    val context = LocalContext.current

    var cropRect by remember(videoUri) { mutableStateOf<Rect?>(null) }
    var videoSourceSize by remember(videoUri) { mutableStateOf<Size?>(null) }
    var videoBounds by remember(videoUri) { mutableStateOf<Rect?>(null) }

    LaunchedEffect(videoUri) {
        val metadata = VideoEditExporter.loadMetadata(context, videoUri)
        if (metadata.width > 0 && metadata.height > 0) {
            videoSourceSize = Size(metadata.width.toFloat(), metadata.height.toFloat())
        }
    }

    val exoPlayer =
        remember(videoUri) {
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(videoUri))
                repeatMode = Player.REPEAT_MODE_ONE
                playWhenReady = true
                prepare()
            }
        }
    DisposableEffect(videoUri) {
        onDispose { exoPlayer.release() }
    }

    BackHandler(onBack = onCancel)

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color.Black),
    ) {
        Column(Modifier.fillMaxSize()) {
            BoxWithConstraints(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .statusBarsPadding(),
            ) {
                val viewWidthPx = constraints.maxWidth.toFloat()
                val viewHeightPx = constraints.maxHeight.toFloat()
                val bounds =
                    remember(viewWidthPx, viewHeightPx, videoSourceSize) {
                        fittedMediaBounds(
                            viewWidth = viewWidthPx,
                            viewHeight = viewHeightPx,
                            sourceSize = videoSourceSize,
                        )
                    }
                videoBounds = bounds

                LaunchedEffect(bounds) {
                    cropRect =
                        cropRect
                            ?.coerceInBounds(bounds = bounds, minSize = 96f)
                            ?: bounds
                }

                val activeCropRect = cropRect ?: bounds

                Box(Modifier.fillMaxSize()) {
                    AndroidView(
                        factory = { ctx ->
                            PlayerView(ctx).apply {
                                player = exoPlayer
                                useController = false
                                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                            }
                        },
                        modifier = Modifier.fillMaxSize(),
                    )

                    DraggableCropFrame(
                        cropRect = activeCropRect,
                        mediaBounds = bounds,
                        onChange = { nextRect ->
                            cropRect = nextRect.coerceInBounds(bounds = bounds, minSize = 96f)
                        },
                    )
                }
            }

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .windowInsetsPadding(WindowInsets.navigationBars)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onCancel) {
                    AppText(
                        text = "ОТМЕНА",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
                TextButton(onClick = { cropRect = null }) {
                    AppText(
                        text = "СБРОС",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
                TextButton(
                    onClick = {
                        val bounds = videoBounds ?: return@TextButton
                        val rect = cropRect ?: bounds
                        val normalized = cropRectToNormalized(rect, bounds)
                        onDone(
                            if (normalized.isFullFrame) {
                                null
                            } else {
                                VideoSpatialCrop(
                                    cropRect = rect,
                                    mediaBounds = bounds,
                                )
                            },
                        )
                    },
                ) {
                    AppText(
                        text = "ГОТОВО",
                        color = TelegramMessageUi.AccentBlue,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}
