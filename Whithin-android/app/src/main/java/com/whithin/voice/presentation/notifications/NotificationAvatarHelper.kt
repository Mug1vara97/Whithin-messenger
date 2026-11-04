package com.whithin.voice.presentation.notifications

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Shader
import android.graphics.Typeface
import androidx.core.graphics.createBitmap
import java.net.URL
import kotlin.math.min

internal object NotificationAvatarHelper {
    fun loadBitmap(url: String?): Bitmap? {
        val raw = url?.trim().orEmpty()
        if (raw.isBlank()) return null
        val resolved = resolveMediaUrl(raw)
        return runCatching {
            URL(resolved).openStream().use { stream ->
                BitmapFactory.decodeStream(stream)
            }
        }.getOrNull()
    }

    fun letterAvatar(name: String, colorHex: String?, sizePx: Int = 256): Bitmap {
        val label = name.trim().firstOrNull()?.uppercaseChar()?.toString().orEmpty().ifBlank { "?" }
        val backgroundColor =
            runCatching {
                android.graphics.Color.parseColor(colorHex?.trim().orEmpty().ifBlank { "#5865F2" })
            }.getOrElse { android.graphics.Color.parseColor("#5865F2") }
        val bitmap = createBitmap(sizePx, sizePx)
        val canvas = Canvas(bitmap)
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = backgroundColor }
        canvas.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, fill)
        val textPaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = android.graphics.Color.WHITE
                typeface = Typeface.DEFAULT_BOLD
                textAlign = Paint.Align.CENTER
                textSize = sizePx * 0.42f
            }
        val bounds = Rect()
        textPaint.getTextBounds(label, 0, label.length, bounds)
        canvas.drawText(
            label,
            sizePx / 2f,
            sizePx / 2f - bounds.exactCenterY(),
            textPaint,
        )
        return bitmap
    }

    fun scaleForLargeIcon(source: Bitmap, maxSize: Int = 256): Bitmap {
        val largest = min(source.width, source.height)
        if (largest <= maxSize) return source
        val scale = maxSize.toFloat() / largest.toFloat()
        val width = (source.width * scale).toInt().coerceAtLeast(1)
        val height = (source.height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(source, width, height, true)
    }

    fun avatarForNotification(
        name: String,
        avatarUrl: String?,
        colorHex: String?,
        sizePx: Int = 256,
    ): Bitmap {
        val loaded = loadBitmap(avatarUrl)
        if (loaded != null) {
            return toCircularBitmap(loaded, sizePx)
        }
        return letterAvatar(name, colorHex, sizePx)
    }

    private fun toCircularBitmap(source: Bitmap, sizePx: Int): Bitmap {
        val square = centerCropToSquare(source, sizePx)
        val output = createBitmap(sizePx, sizePx)
        val canvas = Canvas(output)
        val paint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = BitmapShader(square, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
            }
        canvas.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, paint)
        return output
    }

    private fun centerCropToSquare(source: Bitmap, sizePx: Int): Bitmap {
        val dim = min(source.width, source.height)
        val x = (source.width - dim) / 2
        val y = (source.height - dim) / 2
        val cropped = Bitmap.createBitmap(source, x, y, dim, dim)
        return if (dim == sizePx) {
            cropped
        } else {
            Bitmap.createScaledBitmap(cropped, sizePx, sizePx, true)
        }
    }

    private fun resolveMediaUrl(raw: String): String {
        return when {
            raw.startsWith("http://") || raw.startsWith("https://") -> raw
            raw.startsWith("/uploads/") -> "https://whithin.ru$raw"
            raw.startsWith("uploads/") -> "https://whithin.ru/$raw"
            else -> "https://whithin.ru/uploads/$raw"
        }
    }
}
