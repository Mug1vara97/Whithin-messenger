package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import androidx.compose.ui.geometry.Rect
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Crop
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

data class VideoTrimRange(
    val startMs: Long,
    val endMs: Long,
)

data class VideoSpatialCrop(
    val cropRect: Rect,
    val mediaBounds: Rect,
)

data class VideoEditRequest(
    val trimRange: VideoTrimRange? = null,
    val spatialCrop: VideoSpatialCrop? = null,
)

data class VideoMetadata(
    val durationMs: Long,
    val width: Int,
    val height: Int,
    val sizeBytes: Long,
)

@UnstableApi
object VideoEditExporter {
    private const val Tag = "VideoEditExporter"

    suspend fun exportIfNeeded(
        context: Context,
        sourceUri: Uri,
        request: VideoEditRequest,
        fullDurationMs: Long,
    ): Uri {
        val trim = request.trimRange
        val crop = request.spatialCrop
        val hasTrim =
            trim != null &&
                (trim.startMs > 0L || trim.endMs < fullDurationMs - 250L)
        val hasCrop =
            crop != null &&
                !cropRectToNormalized(crop.cropRect, crop.mediaBounds).isFullFrame
        if (!hasTrim && !hasCrop) {
            return sourceUri
        }
        return export(context, sourceUri, request, fullDurationMs)
    }

    suspend fun export(
        context: Context,
        sourceUri: Uri,
        request: VideoEditRequest,
        fullDurationMs: Long,
    ): Uri =
        withContext(Dispatchers.Main) {
            val appContext = context.applicationContext
            val trim = request.trimRange
            val startMs = trim?.startMs?.coerceAtLeast(0L) ?: 0L
            val endMs = trim?.endMs?.coerceAtMost(fullDurationMs) ?: fullDurationMs
            val crop = request.spatialCrop

            val mediaItemBuilder = MediaItem.Builder().setUri(sourceUri)
            if (startMs > 0L || endMs < fullDurationMs) {
                mediaItemBuilder.setClippingConfiguration(
                    MediaItem.ClippingConfiguration.Builder()
                        .setStartPositionMs(startMs)
                        .setEndPositionMs(endMs.coerceAtLeast(startMs + 500L))
                        .build(),
                )
            }

            val videoEffects =
                buildList {
                    crop?.let { spatial ->
                        val normalized = cropRectToNormalized(spatial.cropRect, spatial.mediaBounds)
                        if (!normalized.isFullFrame) {
                            val cropEffect = normalized.toMedia3Crop()
                            Log.d(
                                Tag,
                                "Applying video crop: left=${normalized.left}, right=${normalized.right}, top=${normalized.top}, bottom=${normalized.bottom}",
                            )
                            add(cropEffect)
                        }
                    }
                }

            val editedMediaItem =
                EditedMediaItem.Builder(mediaItemBuilder.build())
                    .setEffects(Effects(emptyList(), videoEffects))
                    .build()

            val outputFile = File(appContext.cacheDir, "edited_video_${System.currentTimeMillis()}.mp4")
            suspendCancellableCoroutine { continuation ->
                val transformer = Transformer.Builder(appContext).build()
                transformer.addListener(
                    object : Transformer.Listener {
                        override fun onCompleted(
                            composition: Composition,
                            exportResult: ExportResult,
                        ) {
                            Log.d(Tag, "Video export completed: ${outputFile.absolutePath}, size=${outputFile.length()}")
                            if (continuation.isActive) {
                                continuation.resume(Uri.fromFile(outputFile))
                            }
                        }

                        override fun onError(
                            composition: Composition,
                            exportResult: ExportResult,
                            exportException: ExportException,
                        ) {
                            Log.e(Tag, "Video export failed", exportException)
                            outputFile.delete()
                            if (continuation.isActive) {
                                continuation.resumeWithException(exportException)
                            }
                        }
                    },
                )
                continuation.invokeOnCancellation {
                    transformer.cancel()
                    outputFile.delete()
                }
                try {
                    transformer.start(editedMediaItem, outputFile.absolutePath)
                } catch (t: Throwable) {
                    Log.e(Tag, "Video export could not start", t)
                    outputFile.delete()
                    if (continuation.isActive) {
                        continuation.resumeWithException(t)
                    }
                }
            }
        }

    fun loadMetadata(
        context: Context,
        uri: Uri,
        fallbackSizeBytes: Long = 0L,
    ): VideoMetadata {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, uri)
            VideoMetadata(
                durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L,
                width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0,
                height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0,
                sizeBytes = fallbackSizeBytes,
            )
        } finally {
            retriever.release()
        }
    }
}

private fun NormalizedCropRect.toMedia3Crop(): Crop {
    val leftNdc = (left * 2f - 1f).coerceIn(-1f, 1f)
    val rightNdc = (right * 2f - 1f).coerceIn(-1f, 1f)
    val topNdc = (1f - top * 2f).coerceIn(-1f, 1f)
    val bottomNdc = (1f - bottom * 2f).coerceIn(-1f, 1f)
    return Crop(leftNdc, rightNdc, bottomNdc, topNdc)
}

fun resolveEditedVideoSend(uri: Uri, displayName: String? = null): PendingMediaSend {
    return PendingMediaSend(
        uri = uri,
        mimeType = "video/mp4",
        displayName = displayName ?: "video.mp4",
        isVideoNote = false,
    )
}

fun isVideoUri(context: Context, uri: Uri): Boolean {
    val mime = context.contentResolver.getType(uri).orEmpty()
    if (mime.startsWith("video/")) return true
    val ext = uri.lastPathSegment?.substringAfterLast('.', "")?.lowercase().orEmpty()
    return ext in setOf("mp4", "webm", "mov", "mkv", "3gp")
}

fun formatVideoDuration(durationMs: Long): String {
    val totalSeconds = (durationMs / 1000L).coerceAtLeast(0L)
    val minutes = totalSeconds / 60L
    val seconds = totalSeconds % 60L
    return "%d:%02d".format(minutes, seconds)
}

fun estimateTrimmedVideoSizeBytes(
    fullSizeBytes: Long,
    fullDurationMs: Long,
    trimStartMs: Long,
    trimEndMs: Long,
): Long {
    if (fullSizeBytes <= 0L || fullDurationMs <= 0L) return fullSizeBytes
    val trimmedMs = (trimEndMs - trimStartMs).coerceIn(0L, fullDurationMs)
    return (fullSizeBytes.toDouble() * trimmedMs / fullDurationMs).toLong()
}

fun formatVideoFileSize(bytes: Long): String {
    if (bytes <= 0L) return ""
    val mb = bytes / (1024.0 * 1024.0)
    return if (mb >= 0.95) {
        String.format(java.util.Locale.getDefault(), "~%.1f МБ", mb)
    } else {
        val kb = bytes / 1024.0
        String.format(java.util.Locale.getDefault(), "~%.0f КБ", kb)
    }
}
