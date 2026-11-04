package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.net.Uri
import androidx.compose.ui.geometry.Rect
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class ImageEditTransform(
    val viewWidth: Float,
    val imageAreaHeight: Float,
    val cropRect: Rect,
    val straightenDegrees: Float,
    val quarterTurns: Int,
    val mirrored: Boolean,
)

object ImageEditExporter {
    suspend fun loadPreviewBitmap(
        context: Context,
        uri: Uri,
        maxSide: Int = 2048,
    ): Bitmap =
        withContext(Dispatchers.IO) {
            loadOrientedBitmap(context, uri, maxSide)
        }

    suspend fun export(
        context: Context,
        sourceUri: Uri,
        transform: ImageEditTransform,
    ): Uri =
        withContext(Dispatchers.IO) {
            val bitmap = loadOrientedBitmap(context, sourceUri, maxSide = 4096)
            val output =
                renderCrop(
                    source = bitmap,
                    transform = transform,
                )
            if (output != bitmap) {
                bitmap.recycle()
            }
            saveToCache(context, output)
        }

    internal fun loadOrientedBitmap(context: Context, uri: Uri, maxSide: Int): Bitmap {
        val bytes =
            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: error("Cannot open image")
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > maxSide) {
            sample *= 2
        }
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        var bitmap =
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
                ?: error("Cannot decode image")
        val orientation =
            runCatching {
                ExifInterface(bytes.inputStream()).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        val degrees =
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        if (degrees != 0f) {
            val rotated = rotateBitmap(bitmap, degrees)
            if (rotated != bitmap) bitmap.recycle()
            bitmap = rotated
        }
        return bitmap
    }

    private fun rotateBitmap(source: Bitmap, degrees: Float): Bitmap {
        if (degrees == 0f) return source
        val matrix = Matrix().apply { postRotate(degrees) }
        val rotated =
            Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
        if (rotated != source) source.recycle()
        return rotated
    }

    private fun renderCrop(source: Bitmap, transform: ImageEditTransform): Bitmap {
        val crop = transform.cropRect
        val outW = crop.width.toInt().coerceAtLeast(1)
        val outH = crop.height.toInt().coerceAtLeast(1)
        val output = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val matrix =
            ImageTransformMath.buildDrawMatrix(
                sourceWidth = source.width,
                sourceHeight = source.height,
                viewWidth = transform.viewWidth,
                viewHeight = transform.imageAreaHeight,
                quarterTurns = transform.quarterTurns,
                straightenDegrees = transform.straightenDegrees,
                mirrored = transform.mirrored,
            )
        canvas.translate(-crop.left, -crop.top)
        canvas.drawBitmap(source, matrix, null)
        return output
    }

    private fun saveToCache(context: Context, bitmap: Bitmap): Uri {
        val file = File(context.cacheDir, "edited_image_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)
            out.flush()
        }
        bitmap.recycle()
        return Uri.fromFile(file)
    }
}

fun isImageUri(context: Context, uri: Uri): Boolean {
    return context.contentResolver.getType(uri)?.startsWith("image/") == true
}
