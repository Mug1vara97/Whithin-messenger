package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.net.Uri
import android.view.TextureView
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.presentation.ui.media.MediaAspectCache
import com.whithin.voice.presentation.ui.media.reportMediaThumbnailBounds
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun VideoMessageItem(
    mediaFile: MediaFile,
    timestamp: String = "",
    modifier: Modifier = Modifier,
    showTimeBadge: Boolean = true,
    clipShape: Shape = RoundedCornerShape(TelegramMessageUi.MediaCornerRadius),
    layoutMaxWidth: Dp? = null,
    isVideoNote: Boolean = false,
    isOwn: Boolean = false,
    status: String? = null,
    onVideoNoteOpen: () -> Unit = {},
    onVideoClick: () -> Unit = {}
) {
    val telegramMax = rememberTelegramBubbleMaxWidth()
    val maxBubbleW = layoutMaxWidth ?: telegramMax

    val videoUrl = remember(mediaFile.filePath, mediaFile.filePathAlt) { buildMessageMediaUrl(mediaFile.filePathValue) }

    if (isVideoNote) {
        VideoNoteCircleItem(
            videoUrl = videoUrl,
            contentDescription = mediaFile.fileName ?: "Video note",
            layoutMaxWidth = maxBubbleW,
            onOpen = onVideoNoteOpen,
            modifier = modifier,
        )
        return
    }

    val context = LocalContext.current
    val screenW = LocalConfiguration.current.screenWidthDp.dp
    val thumbnailUrl =
        remember(mediaFile.thumbnailPath, mediaFile.thumbnailPathAlt) {
            mediaFile.thumbnailPathValue?.let { buildMessageMediaUrl(it) }?.takeIf { it.isNotBlank() }
        }

    remember(context) { MediaAspectCache.ensureLoaded(context); Unit }
    var intrinsic by
        remember(videoUrl) {
            MediaAspectCache.seed(videoUrl, mediaFile)
            mutableStateOf(MediaAspectCache.get(videoUrl))
        }

    // Telegram sizes videos exactly like photos; unknown size → 16:9 until the thumbnail tells us.
    val (boxW, boxH) =
        remember(maxBubbleW, screenW, intrinsic) {
            val size = intrinsic
            if (size != null) {
                telegramPhotoSizeDp(size.width, size.height, maxBubbleW, screenW)
            } else {
                telegramPhotoSizeDp(16, 9, maxBubbleW, screenW)
            }
        }

    val badgeLabel = remember(mediaFile) { videoBadgeLabel(mediaFile) }

    Box(
        modifier =
            modifier
                .width(boxW)
                .height(boxH)
                .clip(clipShape)
                .reportMediaThumbnailBounds(videoUrl)
                .clickable(onClick = onVideoClick),
    ) {
        VideoThumbnailBox(
            videoUrl = videoUrl,
            thumbnailUrl = thumbnailUrl,
            contentDescription = mediaFile.fileName ?: "Video",
            modifier =
                Modifier
                    .width(boxW)
                    .height(boxH),
            playButtonSize = 48.dp,
            playIconSize = 30.dp,
            onThumbnailSize = { w, h ->
                if (intrinsic == null && w > 0 && h > 0) {
                    MediaAspectCache.put(videoUrl, w, h)
                    intrinsic = IntSize(w, h)
                }
            },
        )

        if (badgeLabel.isNotBlank()) {
            MediaPill(
                text = badgeLabel,
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp),
            )
        }

        if (showTimeBadge && timestamp.isNotEmpty()) {
            val formattedTime = remember(timestamp) { formatTimestamp(timestamp) }
            MediaTimeBadge(
                time = formattedTime,
                isOwn = isOwn,
                status = status,
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .padding(6.dp),
            )
        }
    }
}

@Composable
private fun VideoNoteCircleItem(
    videoUrl: String,
    contentDescription: String,
    layoutMaxWidth: Dp,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val playbackId = remember(videoUrl) { "video-note:$videoUrl" }
    val player =
        remember(videoUrl) {
            ExoPlayer.Builder(context).build().apply {
                repeatMode = Player.REPEAT_MODE_OFF
                setMediaItem(MediaItem.fromUri(Uri.parse(videoUrl)))
                prepare()
            }
        }

    var isPlaying by remember(videoUrl) { mutableStateOf(false) }
    var isEnded by remember(videoUrl) { mutableStateOf(false) }
    var isLoading by remember(videoUrl) { mutableStateOf(true) }
    var hasOpened by remember(videoUrl) { mutableStateOf(false) }
    var progress by remember(videoUrl) { mutableFloatStateOf(0f) }
    val expandedSize =
        remember(layoutMaxWidth) {
            minOf(layoutMaxWidth, 300.dp).coerceAtLeast(200.dp)
        }
    val outerSize by animateDpAsState(
        targetValue = if (hasOpened) expandedSize else 200.dp,
        animationSpec = tween(durationMillis = 180),
        label = "videoNoteOuterSize",
    )
    val videoSize = outerSize

    LaunchedEffect(ChatPlaybackCoordinator.activePlaybackId, player) {
        if (ChatPlaybackCoordinator.activePlaybackId != playbackId && player.isPlaying) {
            player.pause()
            hasOpened = false
        }
    }

    DisposableEffect(player) {
        val listener =
            object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    isLoading = playbackState == Player.STATE_BUFFERING || playbackState == Player.STATE_IDLE
                    if (playbackState == Player.STATE_READY) {
                        isEnded = false
                    }
                    if (playbackState == Player.STATE_ENDED) {
                        isPlaying = false
                        isEnded = true
                        hasOpened = false
                        progress = 1f
                        ChatPlaybackCoordinator.deactivate(playbackId)
                    }
                }

                override fun onIsPlayingChanged(playing: Boolean) {
                    isPlaying = playing
                }
            }
        player.addListener(listener)
        onDispose {
            ChatPlaybackCoordinator.deactivate(playbackId)
            player.removeListener(listener)
            player.clearVideoSurface()
            player.release()
        }
    }

    LaunchedEffect(player, isPlaying) {
        while (isPlaying) {
            val duration = player.duration
            if (duration > 0) {
                progress = (player.currentPosition.toFloat() / duration.toFloat()).coerceIn(0f, 1f)
            }
            delay(33)
        }
    }

    fun togglePlayback() {
        if (isEnded) {
            player.seekTo(0)
            progress = 0f
            isEnded = false
        }
        if (player.isPlaying) {
            player.pause()
            hasOpened = false
            ChatPlaybackCoordinator.deactivate(playbackId)
        } else {
            hasOpened = true
            ChatPlaybackCoordinator.activate(playbackId)
            onOpen()
            player.play()
        }
    }

    fun seekToProgress(value: Float) {
        val duration = player.duration
        if (duration <= 0) return
        val clamped = value.coerceIn(0f, 1f)
        hasOpened = true
        ChatPlaybackCoordinator.activate(playbackId)
        progress = clamped
        player.seekTo((duration * clamped).toLong())
    }

    Box(
        modifier =
            modifier
                .size(outerSize)
                .clickable(onClick = ::togglePlayback),
        contentAlignment = Alignment.TopStart,
    ) {
        Box(
            modifier =
                Modifier
                    .size(videoSize)
                    .align(Alignment.Center)
                    .graphicsLayer {
                        shape = CircleShape
                        clip = true
                    }
                    .background(Color(0xFF1A1C1F)),
        ) {
            AndroidView(
                factory = { ctx ->
                    TextureView(ctx).apply {
                        player.setVideoTextureView(this)
                    }
                },
                update = { player.setVideoTextureView(it) },
                modifier = Modifier.fillMaxSize(),
            )

            if (hasOpened && !isEnded) {
                Canvas(
                    modifier =
                        Modifier
                            .matchParentSize()
                            .pointerInput(player) {
                                fun progressForPosition(position: Offset): Float {
                                    val center = Offset(size.width / 2f, size.height / 2f)
                                    val angle = atan2(position.y - center.y, position.x - center.x)
                                    val raw = ((angle + PI / 2.0) / (2.0 * PI)).toFloat()
                                    return if (raw < 0f) raw + 1f else raw
                                }

                                detectDragGestures(
                                    onDragStart = { offset ->
                                        seekToProgress(progressForPosition(offset))
                                    },
                                    onDrag = { change, _ ->
                                        seekToProgress(progressForPosition(change.position))
                                        change.consume()
                                    },
                                )
                            },
                ) {
                    val strokeWidth = 3.dp.toPx()
                    val inset = 10.dp.toPx()
                    val arcSize = Size(size.width - inset * 2f, size.height - inset * 2f)
                    val center = Offset(size.width / 2f, size.height / 2f)
                    val radius = arcSize.width / 2f

                    drawArc(
                        color = Color.White.copy(alpha = 0.24f),
                        startAngle = -90f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = Offset(inset, inset),
                        size = arcSize,
                        style = Stroke(width = strokeWidth),
                    )
                    drawArc(
                        color = Color.White.copy(alpha = 0.92f),
                        startAngle = -90f,
                        sweepAngle = 360f * progress,
                        useCenter = false,
                        topLeft = Offset(inset, inset),
                        size = arcSize,
                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
                    )

                    val thumbAngle = (-90f + 360f * progress) * (PI.toFloat() / 180f)
                    drawCircle(
                        color = Color.White,
                        radius = 6.dp.toPx(),
                        center =
                            Offset(
                                x = center.x + cos(thumbAngle) * radius,
                                y = center.y + sin(thumbAngle) * radius,
                            ),
                    )
                }
            }

            if (!isPlaying || isEnded || isLoading) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = if (isLoading) 0.34f else 0.18f)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(28.dp),
                            color = Color.White.copy(alpha = 0.72f),
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Box(
                            modifier =
                                Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .background(Color.Black.copy(alpha = 0.42f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = contentDescription,
                                tint = Color.White,
                                modifier = Modifier.size(34.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun formatDuration(durationMs: Long): String {
    val totalSeconds = durationMs / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format("%d:%02d", minutes, seconds)
}

private fun formatTimestamp(timestamp: String): String {
    return try {
        val instant = Instant.parse(timestamp)
        val localTime = instant.atZone(ZoneId.systemDefault())
        localTime.format(DateTimeFormatter.ofPattern("HH:mm"))
    } catch (e: Exception) {
        timestamp.takeIf { it.length <= 5 } ?: timestamp.substringAfterLast("T").substringBefore(".").take(5)
    }
}
