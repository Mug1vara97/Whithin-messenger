package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Crop
import androidx.media3.effect.Presentation
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * Перекодирует кружок в квадрат 640×640: «запекает» ориентацию в пиксели (rotation metadata → 0).
 */
@OptIn(UnstableApi::class)
internal object VideoNoteExporter {
    private const val TAG = "VideoNoteExporter"
    private const val OUTPUT_SIZE = 640

    suspend fun export(
        context: Context,
        input: File,
        sensorRotationDegrees: Int,
        useFrontCamera: Boolean,
    ): File {
        if (!input.exists() || input.length() <= 0L) return input

        val width = readVideoWidth(input)
        val height = readVideoHeight(input)
        val metadataRotation = readVideoRotation(input)
        val (baseRotation, bakeRotation) =
            resolveBakeRotation(
                metadataRotation = metadataRotation,
                sensorRotationDegrees = sensorRotationDegrees,
                width = width,
                height = height,
                useFrontCamera = useFrontCamera,
            )

        Log.d(
            TAG,
            "export ${input.name} ${width}x$height meta=$metadataRotation sensor=$sensorRotationDegrees " +
                "base=$baseRotation bake=$bakeRotation front=$useFrontCamera",
        )

        val output = File(context.cacheDir, "video_note_export_${System.currentTimeMillis()}.mp4")
        val cropRotation = if (metadataRotation != 0) metadataRotation else bakeRotation
        val crop = computeCenterSquareCrop(width, height, cropRotation)

        val transformBuilder = ScaleAndRotateTransformation.Builder()
        if (bakeRotation != 0) {
            transformBuilder.setRotationDegrees(bakeRotation.toFloat())
        }
        if (useFrontCamera) {
            transformBuilder.setScale(-1f, 1f)
        }

        return suspendCoroutine { cont ->
            val mediaItem = MediaItem.fromUri(Uri.fromFile(input))
            val videoEffects =
                listOf(
                    transformBuilder.build(),
                    Crop(crop.left, crop.right, crop.bottom, crop.top),
                    Presentation.createForWidthAndHeight(
                        OUTPUT_SIZE,
                        OUTPUT_SIZE,
                        Presentation.LAYOUT_SCALE_TO_FIT,
                    ),
                )
            val editedMediaItem =
                EditedMediaItem.Builder(mediaItem)
                    .setEffects(Effects(emptyList(), videoEffects))
                    .build()

            val transformer = Transformer.Builder(context).build()
            transformer.addListener(
                object : Transformer.Listener {
                    override fun onCompleted(
                        composition: Composition,
                        exportResult: ExportResult,
                    ) {
                        cont.resume(output)
                    }

                    override fun onError(
                        composition: Composition,
                        exportResult: ExportResult,
                        exportException: ExportException,
                    ) {
                        Log.e(TAG, "export failed, using raw file", exportException)
                        output.delete()
                        cont.resume(input)
                    }
                },
            )
            transformer.start(editedMediaItem, output.absolutePath)
        }
    }

    /**
     * Media3 при чтении файла уже учитывает rotation metadata.
     * Поэтому при metadata != 0 не докручиваем кадр ещё раз.
     * Если metadata = 0 (CameraX иногда так пишет), берём угол с сенсора на момент записи.
     */
    internal fun resolveBakeRotation(
        metadataRotation: Int,
        sensorRotationDegrees: Int,
        width: Int,
        height: Int,
        useFrontCamera: Boolean,
    ): Pair<Int, Int> {
        val base =
            when {
                metadataRotation != 0 -> 0
                sensorRotationDegrees != 0 -> sensorRotationDegrees % 360
                width > 0 && height > 0 && width > height -> 90
                else -> 0
            }
        val bake =
            if (useFrontCamera && metadataRotation == 0) {
                (base + 180) % 360
            } else {
                base
            }
        return base to bake
    }

    private data class CropRect(
        val left: Float,
        val right: Float,
        val bottom: Float,
        val top: Float,
    )

    private fun computeCenterSquareCrop(
        width: Int,
        height: Int,
        bakeRotation: Int,
    ): CropRect {
        if (width <= 0 || height <= 0) {
            return CropRect(-1f, 1f, -1f, 1f)
        }

        val rotatedSwap = bakeRotation % 180 != 0
        val frameW = if (rotatedSwap) height.toFloat() else width.toFloat()
        val frameH = if (rotatedSwap) width.toFloat() else height.toFloat()
        val aspect = frameW / frameH

        return if (aspect >= 1f) {
            val edge = 1f / aspect
            CropRect(-edge, edge, -1f, 1f)
        } else {
            CropRect(-1f, 1f, -aspect, aspect)
        }
    }

    private fun readVideoRotation(file: File): Int {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
                ?.toIntOrNull() ?: 0
        } catch (e: Exception) {
            Log.w(TAG, "read rotation", e)
            0
        } finally {
            runCatching { retriever.release() }
        }
    }

    private fun readVideoWidth(file: File): Int {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                ?.toIntOrNull() ?: 0
        } catch (e: Exception) {
            0
        } finally {
            runCatching { retriever.release() }
        }
    }

    private fun readVideoHeight(file: File): Int {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                ?.toIntOrNull() ?: 0
        } catch (e: Exception) {
            0
        } finally {
            runCatching { retriever.release() }
        }
    }
}
