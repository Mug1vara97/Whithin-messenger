package com.whithin.voice.presentation.ui.components

import android.graphics.Matrix
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

internal object ImageTransformMath {
    private const val LANDSCAPE_HORIZONTAL_MARGIN_RATIO = 0.09f
    private const val PORTRAIT_HORIZONTAL_MARGIN_RATIO = 0.05f
    private const val VERTICAL_MARGIN_RATIO = 0.05f

    fun fitScale(
        viewWidth: Float,
        viewHeight: Float,
        sourceWidth: Float,
        sourceHeight: Float,
        quarterTurns: Int = 0,
        straightenDegrees: Float = 0f,
    ): Float {
        if (sourceWidth <= 0f || sourceHeight <= 0f) return 1f
        val radians = Math.toRadians((straightenDegrees + quarterTurns * 90f).toDouble()).toFloat()
        val cosA = abs(cos(radians))
        val sinA = abs(sin(radians))
        val rotatedBoundWidth = sourceWidth * cosA + sourceHeight * sinA
        val rotatedBoundHeight = sourceWidth * sinA + sourceHeight * cosA
        val isLandscapeDisplay = rotatedBoundWidth > rotatedBoundHeight
        val horizontalMargin =
            viewWidth *
                if (isLandscapeDisplay) {
                    LANDSCAPE_HORIZONTAL_MARGIN_RATIO
                } else {
                    PORTRAIT_HORIZONTAL_MARGIN_RATIO
                }
        val verticalMargin = viewHeight * VERTICAL_MARGIN_RATIO
        val availableWidth = (viewWidth - horizontalMargin * 2f).coerceAtLeast(1f)
        val availableHeight = (viewHeight - verticalMargin * 2f).coerceAtLeast(1f)
        return min(availableWidth / rotatedBoundWidth, availableHeight / rotatedBoundHeight)
    }

    fun computeDisplayedBounds(
        viewWidth: Float,
        viewHeight: Float,
        sourceWidth: Float,
        sourceHeight: Float,
        quarterTurns: Int,
        straightenDegrees: Float,
        mirrored: Boolean,
    ): Rect {
        val sourceW = sourceWidth.coerceAtLeast(1f)
        val sourceH = sourceHeight.coerceAtLeast(1f)
        val scale =
            fitScale(
                viewWidth = viewWidth,
                viewHeight = viewHeight,
                sourceWidth = sourceW,
                sourceHeight = sourceH,
                quarterTurns = quarterTurns,
                straightenDegrees = straightenDegrees,
            )
        val halfW = sourceW * scale / 2f
        val halfH = sourceH * scale / 2f
        val centerX = viewWidth / 2f
        val centerY = viewHeight / 2f
        val radians = Math.toRadians((straightenDegrees + quarterTurns * 90f).toDouble()).toFloat()
        val cosA = cos(radians)
        val sinA = sin(radians)

        val localCorners =
            listOf(
                Offset(-halfW, -halfH),
                Offset(halfW, -halfH),
                Offset(halfW, halfH),
                Offset(-halfW, halfH),
            )

        val viewCorners =
            localCorners.map { corner ->
                val mirroredX = if (mirrored) -corner.x else corner.x
                val rotatedX = mirroredX * cosA - corner.y * sinA
                val rotatedY = mirroredX * sinA + corner.y * cosA
                Offset(centerX + rotatedX, centerY + rotatedY)
            }

        return Rect(
            left = viewCorners.minOf { it.x },
            top = viewCorners.minOf { it.y },
            right = viewCorners.maxOf { it.x },
            bottom = viewCorners.maxOf { it.y },
        )
    }

    fun buildDrawMatrix(
        sourceWidth: Int,
        sourceHeight: Int,
        viewWidth: Float,
        viewHeight: Float,
        quarterTurns: Int,
        straightenDegrees: Float,
        mirrored: Boolean,
    ): Matrix {
        val sourceW = sourceWidth.toFloat()
        val sourceH = sourceHeight.toFloat()
        val scale =
            fitScale(
                viewWidth = viewWidth,
                viewHeight = viewHeight,
                sourceWidth = sourceW,
                sourceHeight = sourceH,
                quarterTurns = quarterTurns,
                straightenDegrees = straightenDegrees,
            )
        return Matrix().apply {
            postTranslate(-sourceW / 2f, -sourceH / 2f)
            if (mirrored) {
                postScale(-scale, scale)
            } else {
                postScale(scale, scale)
            }
            postRotate(straightenDegrees + quarterTurns * 90f)
            postTranslate(viewWidth / 2f, viewHeight / 2f)
        }
    }
}
