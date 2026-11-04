package com.whithin.voice.presentation.ui.components

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.HashMap

@Composable
fun VideoThumbnailBox(
    videoUrl: String,
    thumbnailUrl: String? = null,
    contentDescription: String? = null,
    modifier: Modifier = Modifier,
    showPlayButton: Boolean = true,
    playButtonSize: Dp = 40.dp,
    playIconSize: Dp = 24.dp,
    onThumbnailSize: ((width: Int, height: Int) -> Unit)? = null,
) {
    val context = LocalContext.current
    var extractedFrame by remember(videoUrl, thumbnailUrl) { mutableStateOf<Bitmap?>(null) }
    var extracting by remember(videoUrl) { mutableStateOf(false) }

    LaunchedEffect(videoUrl, thumbnailUrl) {
        extractedFrame = null
        // Не трогаем MediaMetadataRetriever, если есть thumbnail — иначе скролл чата лагает.
        if (videoUrl.isBlank() || !thumbnailUrl.isNullOrBlank()) {
            extracting = false
            return@LaunchedEffect
        }
        extracting = true
        extractedFrame =
            withContext(Dispatchers.IO) {
                runCatching {
                    val retriever = MediaMetadataRetriever()
                    try {
                        retriever.setDataSource(videoUrl, HashMap())
                        retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                    } finally {
                        runCatching { retriever.release() }
                    }
                }.getOrNull()
            }
        extractedFrame?.let { frame ->
            if (frame.width > 0 && frame.height > 0) {
                onThumbnailSize?.invoke(frame.width, frame.height)
            }
        }
        extracting = false
    }

    Box(
        modifier =
            modifier.background(Color(0xFF2B2D31)),
        contentAlignment = Alignment.Center,
    ) {
        when {
            !thumbnailUrl.isNullOrBlank() -> {
                SubcomposeAsyncImage(
                    model =
                        ImageRequest.Builder(context)
                            .data(thumbnailUrl)
                            .crossfade(false)
                            .listener(
                                onSuccess = { _, result ->
                                    val drawable = result.drawable
                                    val width = drawable.intrinsicWidth
                                    val height = drawable.intrinsicHeight
                                    if (width > 0 && height > 0) {
                                        onThumbnailSize?.invoke(width, height)
                                    }
                                },
                            )
                            .build(),
                    contentDescription = contentDescription,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    when (painter.state) {
                        is AsyncImagePainter.State.Loading ->
                            VideoThumbnailPlaceholderBox(loading = true)
                        is AsyncImagePainter.State.Error ->
                            VideoThumbnailFrameOrPlaceholder(
                                frame = extractedFrame,
                                loading = extracting,
                            )
                        else -> SubcomposeAsyncImageContent()
                    }
                }
            }
            extractedFrame != null -> {
                Image(
                    bitmap = extractedFrame!!.asImageBitmap(),
                    contentDescription = contentDescription,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
            else -> VideoThumbnailPlaceholderBox(loading = extracting)
        }

        if (showPlayButton) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .size(playButtonSize)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.45f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(playIconSize),
                )
            }
        }
    }
}

@Composable
private fun VideoThumbnailFrameOrPlaceholder(
    frame: Bitmap?,
    loading: Boolean,
) {
    if (frame != null) {
        Image(
            bitmap = frame.asImageBitmap(),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
        )
    } else {
        VideoThumbnailPlaceholderBox(loading = loading)
    }
}

@Composable
private fun VideoThumbnailPlaceholderBox(loading: Boolean) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color(0xFF2B2D31)),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = Color.White.copy(alpha = 0.6f),
                strokeWidth = 2.dp,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}
