package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.components.AppText as Text
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class PendingMediaSend(
    val uri: Uri,
    val mimeType: String? = null,
    val displayName: String? = null,
    val isVideoNote: Boolean = false,
)

fun resolvePendingMediaSend(context: Context, uri: Uri, isVideoNote: Boolean = false): PendingMediaSend {
    val mime = context.contentResolver.getType(uri) ?: inferMimeTypeFromUri(uri)
    var name: String? = null
    var sizeBytes = 0L
    context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (cursor.moveToFirst()) {
            if (nameIndex >= 0) name = cursor.getString(nameIndex)
            if (sizeIndex >= 0) sizeBytes = cursor.getLong(sizeIndex).coerceAtLeast(0L)
        }
    }
    return PendingMediaSend(
        uri = uri,
        mimeType = mime,
        displayName = name,
        isVideoNote = isVideoNote,
    )
}

fun resolveEditedImageSend(uri: Uri): PendingMediaSend {
    return PendingMediaSend(
        uri = uri,
        mimeType = "image/jpeg",
        displayName = "photo.jpg",
        isVideoNote = false,
    )
}

fun inferMimeTypeFromUri(uri: Uri): String? {
    val ext = uri.lastPathSegment?.substringAfterLast('.', "")?.lowercase().orEmpty()
    return when (ext) {
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "gif" -> "image/gif"
        "webp" -> "image/webp"
        "bmp" -> "image/bmp"
        "heic", "heif" -> "image/heic"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        "mov" -> "video/quicktime"
        "mkv" -> "video/x-matroska"
        else -> null
    }
}

@Composable
private fun MediaSendPreview(
    pending: PendingMediaSend,
    modifier: Modifier = Modifier,
) {
    val mime = pending.mimeType.orEmpty().lowercase()
    val isImage = mime.startsWith("image/") || inferMimeTypeFromUri(pending.uri)?.startsWith("image/") == true

    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        when {
            isImage -> {
                val context = LocalContext.current
                val h = with(LocalDensity.current) { 420.dp.roundToPx() }
                val request =
                    remember(pending.uri, h) {
                        sizedImageRequest(context, pending.uri, 1080, h)
                    }
                AsyncImage(
                    model = request,
                    contentDescription = null,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Fit,
                )
            }
            else -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFF2B2D31)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Default.AttachFile,
                            contentDescription = null,
                            tint = TelegramMessageUi.AccentBlue,
                            modifier = Modifier.size(36.dp),
                        )
                    }
                    Text(
                        text = pending.displayName ?: "Файл",
                        color = Color.White,
                        fontSize = 15.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@UnstableApi
@Composable
private fun VideoSendPreview(
    exoPlayer: ExoPlayer,
    trimStartMs: Long,
    trimEndMs: Long,
    spatialCrop: VideoSpatialCrop?,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(trimStartMs) {
        exoPlayer.seekTo(trimStartMs)
    }

    LaunchedEffect(trimStartMs, trimEndMs, exoPlayer) {
        while (true) {
            delay(150L)
            if (exoPlayer.isPlaying && exoPlayer.currentPosition >= trimEndMs) {
                exoPlayer.seekTo(trimStartMs)
            }
        }
    }

    Box(
        modifier = modifier.padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                }
            },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp)),
        )
        spatialCrop?.let {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.Black.copy(alpha = 0.55f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
            ) {
                Text(
                    text = "Обрезка",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
        IconButton(
            onClick = {
                if (exoPlayer.isPlaying) {
                    exoPlayer.pause()
                } else {
                    if (exoPlayer.currentPosition !in trimStartMs until trimEndMs) {
                        exoPlayer.seekTo(trimStartMs)
                    }
                    exoPlayer.play()
                }
            },
            modifier =
                Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.45f)),
        ) {
            Icon(
                Icons.Default.Movie,
                contentDescription = "Воспроизвести",
                tint = Color.White,
                modifier = Modifier.size(32.dp),
            )
        }
    }
}

@UnstableApi
@Composable
fun MediaSendOverlay(
    pending: PendingMediaSend,
    chatTitle: String,
    onDismiss: () -> Unit,
    onEditImage: () -> Unit = {},
    onEditVideo: () -> Unit = {},
    videoSpatialCrop: VideoSpatialCrop? = null,
    onSend: (caption: String, fileUri: Uri) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var caption by remember(pending.uri) { mutableStateOf("") }
    var exporting by remember { mutableStateOf(false) }
    var videoMetadata by remember(pending.uri) { mutableStateOf<VideoMetadata?>(null) }
    var trimStartMs by remember(pending.uri) { mutableLongStateOf(0L) }
    var trimEndMs by remember(pending.uri) { mutableLongStateOf(0L) }
    var playbackPositionMs by remember(pending.uri) { mutableLongStateOf(0L) }

    val mime = pending.mimeType.orEmpty().lowercase()
    val isImage = mime.startsWith("image/") || inferMimeTypeFromUri(pending.uri)?.startsWith("image/") == true
    val isVideo = (mime.startsWith("video/") || pending.isVideoNote) && !isImage

    val exoPlayer =
        remember(pending.uri, isVideo) {
            if (!isVideo) {
                null
            } else {
                ExoPlayer.Builder(context).build().apply {
                    setMediaItem(MediaItem.fromUri(pending.uri))
                    playWhenReady = false
                    prepare()
                }
            }
        }

    DisposableEffect(pending.uri, isVideo) {
        onDispose { exoPlayer?.release() }
    }

    LaunchedEffect(exoPlayer) {
        val player = exoPlayer ?: return@LaunchedEffect
        while (true) {
            playbackPositionMs = player.currentPosition
            delay(32L)
        }
    }

    LaunchedEffect(pending.uri) {
        if (!isVideo) return@LaunchedEffect
        var sizeBytes = 0L
        context.contentResolver.query(pending.uri, null, null, null, null)?.use { cursor ->
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst() && sizeIndex >= 0) {
                sizeBytes = cursor.getLong(sizeIndex).coerceAtLeast(0L)
            }
        }
        val metadata = VideoEditExporter.loadMetadata(context, pending.uri, sizeBytes)
        videoMetadata = metadata
        trimStartMs = 0L
        trimEndMs = metadata.durationMs.coerceAtLeast(1L)
    }

    BackHandler(onBack = onDismiss)

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color.Black),
    ) {
        if (isVideo) {
            val player = exoPlayer ?: return@Box
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .padding(top = 56.dp, bottom = 120.dp),
            ) {
                videoMetadata?.let { metadata ->
                    val trimmedDurationMs = (trimEndMs - trimStartMs).coerceAtLeast(0L)
                    val estimatedSizeBytes =
                        estimateTrimmedVideoSizeBytes(
                            fullSizeBytes = metadata.sizeBytes,
                            fullDurationMs = metadata.durationMs,
                            trimStartMs = trimStartMs,
                            trimEndMs = trimEndMs,
                        )
                    Text(
                        text =
                            buildString {
                                if (metadata.width > 0 && metadata.height > 0) {
                                    append("${metadata.width}x${metadata.height}")
                                }
                                append(", ${formatVideoDuration(trimmedDurationMs)}")
                                val sizeLabel = formatVideoFileSize(estimatedSizeBytes)
                                if (sizeLabel.isNotBlank()) {
                                    append(", $sizeLabel")
                                }
                            },
                        color = Color(0xFF8E8E93),
                        fontSize = 13.sp,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 4.dp),
                    )
                }
                VideoSendPreview(
                    exoPlayer = player,
                    trimStartMs = trimStartMs,
                    trimEndMs = trimEndMs,
                    spatialCrop = videoSpatialCrop,
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                )
                VideoTrimTimeline(
                    videoUri = pending.uri,
                    durationMs = videoMetadata?.durationMs ?: 0L,
                    startMs = trimStartMs,
                    endMs = trimEndMs,
                    playbackPositionMs = playbackPositionMs,
                    onRangeChange = { start, end ->
                        trimStartMs = start
                        trimEndMs = end
                    },
                    onSeek = { positionMs ->
                        playbackPositionMs = positionMs
                        player.seekTo(positionMs)
                    },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        } else {
            MediaSendPreview(
                pending = pending,
                modifier = Modifier.fillMaxSize(),
            )
        }

        Row(
            modifier =
                Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .background(Color.Black.copy(alpha = 0.55f))
                    .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = Color.White)
            }
            Text(
                text = chatTitle,
                color = Color.White,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }

        Row(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars))
                    .background(Color(0xE6000000))
                    .padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isImage || isVideo) {
                IconButton(onClick = if (isVideo) onEditVideo else onEditImage, enabled = !exporting) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = if (isVideo) "Редактировать видео" else "Редактировать фото",
                        tint = TelegramMessageUi.AccentBlue,
                    )
                }
            }
            TextField(
                value = caption,
                onValueChange = { caption = it },
                modifier =
                    Modifier
                        .weight(1f)
                        .padding(start = if (isImage || isVideo) 0.dp else 8.dp),
                placeholder = {
                    Text("Добавить подпись…", color = Color(0xFF8E8E93))
                },
                singleLine = false,
                maxLines = 4,
                shape = RoundedCornerShape(24.dp),
                colors =
                    TextFieldDefaults.colors(
                        focusedContainerColor = Color(0xFF1C1C1E),
                        unfocusedContainerColor = Color(0xFF1C1C1E),
                        disabledContainerColor = Color(0xFF1C1C1E),
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        disabledIndicatorColor = Color.Transparent,
                        cursorColor = TelegramMessageUi.AccentBlue,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                    ),
            )
            if (exporting) {
                CircularProgressIndicator(
                    modifier = Modifier.padding(start = 8.dp).size(48.dp),
                    color = TelegramMessageUi.AccentBlue,
                    strokeWidth = 2.dp,
                )
            } else {
                FloatingActionButton(
                    onClick = {
                        Log.d("MediaSendOverlay", "Send clicked: isVideo=$isVideo, uri=${pending.uri}")
                        if (isVideo) {
                            val metadata = videoMetadata
                            if (metadata == null) {
                                Log.e("MediaSendOverlay", "Video metadata not loaded yet")
                                return@FloatingActionButton
                            }
                            exporting = true
                            scope.launch {
                                runCatching {
                                    VideoEditExporter.exportIfNeeded(
                                        context = context,
                                        sourceUri = pending.uri,
                                        request =
                                            VideoEditRequest(
                                                trimRange = VideoTrimRange(trimStartMs, trimEndMs),
                                                spatialCrop = videoSpatialCrop,
                                            ),
                                        fullDurationMs = metadata.durationMs,
                                    )
                                }.onSuccess { uri ->
                                    exporting = false
                                    onSend(caption.trim(), uri)
                                }.onFailure { error ->
                                    Log.e("MediaSendOverlay", "Failed to export edited video", error)
                                    exporting = false
                                }
                            }
                        } else {
                            onSend(caption.trim(), pending.uri)
                        }
                    },
                    modifier = Modifier.padding(start = 8.dp),
                    containerColor = TelegramMessageUi.AccentBlue,
                    contentColor = Color.White,
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Отправить")
                }
            }
        }
    }
}
