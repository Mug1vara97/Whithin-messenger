package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private enum class TrimDragMode {
    Start,
    End,
    Scrub,
}

@Composable
fun VideoTrimTimeline(
    videoUri: Uri,
    durationMs: Long,
    startMs: Long,
    endMs: Long,
    playbackPositionMs: Long,
    onRangeChange: (Long, Long) -> Unit,
    onSeek: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (durationMs <= 0L) return

    val context = LocalContext.current
    val minDurationMs = 1000L
    val latestStartMs by rememberUpdatedState(startMs)
    val latestEndMs by rememberUpdatedState(endMs)
    val latestPlaybackMs by rememberUpdatedState(playbackPositionMs)

    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxWidth()
                .height(52.dp),
    ) {
        val frameCount = (maxWidth.value / 28f).toInt().coerceIn(10, 18)
        var thumbnails by remember(videoUri, frameCount) { mutableStateOf<List<ImageBitmap>>(emptyList()) }
        var retainedBitmaps by remember(videoUri, frameCount) { mutableStateOf<List<Bitmap>>(emptyList()) }

        LaunchedEffect(videoUri, durationMs, frameCount) {
            val loaded = loadVideoThumbnails(context, videoUri, durationMs, frameCount)
            retainedBitmaps.forEach { bitmap ->
                if (!bitmap.isRecycled) bitmap.recycle()
            }
            retainedBitmaps = loaded
            thumbnails = loaded.map { it.asImageBitmap() }
        }

        DisposableEffect(videoUri, frameCount) {
            onDispose {
                retainedBitmaps.forEach { bitmap ->
                    if (!bitmap.isRecycled) bitmap.recycle()
                }
                retainedBitmaps = emptyList()
                thumbnails = emptyList()
            }
        }

        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Color(0xFF1C1C1E), RoundedCornerShape(8.dp)),
        ) {
            if (thumbnails.isEmpty()) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .background(Color(0xFF2E2E32)),
                )
            } else {
                Row(modifier = Modifier.fillMaxSize()) {
                    thumbnails.forEach { frame ->
                        Image(
                            bitmap = frame,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier =
                                Modifier
                                    .weight(1f)
                                    .fillMaxHeight(),
                        )
                    }
                }
            }

            Canvas(Modifier.fillMaxSize()) {
                val width = size.width
                val height = size.height
                val startX = (startMs.toFloat() / durationMs) * width
                val endX = (endMs.toFloat() / durationMs) * width
                val selectionWidth = (endX - startX).coerceAtLeast(1f)

                if (startX > 0f) {
                    drawRect(
                        color = Color.Black.copy(alpha = 0.62f),
                        topLeft = Offset.Zero,
                        size = Size(startX, height),
                    )
                }
                if (endX < width) {
                    drawRect(
                        color = Color.Black.copy(alpha = 0.62f),
                        topLeft = Offset(endX, 0f),
                        size = Size(width - endX, height),
                    )
                }

                val borderWidth = 2.dp.toPx()
                drawRect(
                    color = Color.White,
                    topLeft = Offset(startX, 0f),
                    size = Size(selectionWidth, borderWidth),
                )
                drawRect(
                    color = Color.White,
                    topLeft = Offset(startX, height - borderWidth),
                    size = Size(selectionWidth, borderWidth),
                )

                val handleWidth = 4.dp.toPx()
                val handleHeight = height + 8.dp.toPx()
                val handleTop = -4.dp.toPx()
                drawRoundRect(
                    color = Color.White,
                    topLeft = Offset(startX - handleWidth / 2f, handleTop),
                    size = Size(handleWidth, handleHeight),
                    cornerRadius = CornerRadius(2f, 2f),
                )
                drawRoundRect(
                    color = Color.White,
                    topLeft = Offset(endX - handleWidth / 2f, handleTop),
                    size = Size(handleWidth, handleHeight),
                    cornerRadius = CornerRadius(2f, 2f),
                )

                val playheadX =
                    ((latestPlaybackMs.coerceIn(startMs, endMs).toFloat() / durationMs) * width)
                        .coerceIn(startX, endX)
                drawLine(
                    color = Color.White,
                    start = Offset(playheadX, 2.dp.toPx()),
                    end = Offset(playheadX, height - 2.dp.toPx()),
                    strokeWidth = 2.dp.toPx(),
                )
            }

            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .pointerInput(durationMs) {
                            val handleRadiusPx = 22.dp.toPx()
                            var dragMode: TrimDragMode? = null
                            var activeStartMs = 0L
                            var activeEndMs = durationMs

                            fun positionToMs(x: Float): Long {
                                val width = size.width.toFloat().coerceAtLeast(1f)
                                return (x / width * durationMs).toLong().coerceIn(0L, durationMs)
                            }

                            detectDragGestures(
                                onDragStart = { offset ->
                                    val width = size.width.toFloat()
                                    activeStartMs = latestStartMs
                                    activeEndMs = latestEndMs
                                    val startX = (activeStartMs.toFloat() / durationMs) * width
                                    val endX = (activeEndMs.toFloat() / durationMs) * width
                                    dragMode =
                                        when {
                                            kotlin.math.abs(offset.x - startX) <= handleRadiusPx -> TrimDragMode.Start
                                            kotlin.math.abs(offset.x - endX) <= handleRadiusPx -> TrimDragMode.End
                                            offset.x in startX..endX -> TrimDragMode.Scrub
                                            else -> null
                                        }
                                    if (dragMode == TrimDragMode.Scrub) {
                                        onSeek(positionToMs(offset.x).coerceIn(activeStartMs, activeEndMs))
                                    }
                                },
                                onDragEnd = { dragMode = null },
                                onDragCancel = { dragMode = null },
                            ) { change, dragAmount ->
                                val mode = dragMode ?: return@detectDragGestures
                                change.consume()
                                val width = size.width.toFloat().coerceAtLeast(1f)
                                when (mode) {
                                    TrimDragMode.Start -> {
                                        val deltaMs = (dragAmount.x / width * durationMs).toLong()
                                        val nextStart =
                                            (activeStartMs + deltaMs).coerceIn(0L, activeEndMs - minDurationMs)
                                        activeStartMs = nextStart
                                        onRangeChange(nextStart, activeEndMs)
                                    }
                                    TrimDragMode.End -> {
                                        val deltaMs = (dragAmount.x / width * durationMs).toLong()
                                        val nextEnd =
                                            (activeEndMs + deltaMs).coerceIn(activeStartMs + minDurationMs, durationMs)
                                        activeEndMs = nextEnd
                                        onRangeChange(activeStartMs, nextEnd)
                                    }
                                    TrimDragMode.Scrub -> {
                                        val nextPosition =
                                            positionToMs(change.position.x).coerceIn(activeStartMs, activeEndMs)
                                        onSeek(nextPosition)
                                    }
                                }
                            }
                        },
            )
        }
    }
}

private suspend fun loadVideoThumbnails(
    context: Context,
    uri: Uri,
    durationMs: Long,
    frameCount: Int,
): List<Bitmap> =
    withContext(Dispatchers.IO) {
        if (durationMs <= 0L || frameCount <= 0) return@withContext emptyList()
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, uri)
            val count = frameCount.coerceAtLeast(1)
            val stepMs = (durationMs / count).coerceAtLeast(1L)
            buildList {
                repeat(count) { index ->
                    val timeUs = (stepMs * index).coerceAtMost(durationMs - 1) * 1000L
                    val frame =
                        retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                            ?: retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                    if (frame != null) add(scaleBitmapForThumbnail(frame, 96))
                }
            }
        } catch (_: Exception) {
            emptyList()
        } finally {
            retriever.release()
        }
    }

private fun scaleBitmapForThumbnail(source: Bitmap, targetWidth: Int): Bitmap {
    if (source.width <= targetWidth) return source
    val ratio = targetWidth.toFloat() / source.width
    val targetHeight = (source.height * ratio).toInt().coerceAtLeast(1)
    val scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
    if (scaled !== source && !source.isRecycled) {
        source.recycle()
    }
    return scaled
}
