package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

internal enum class CropDragHandle {
    Move,
    Left,
    Right,
    Top,
    Bottom,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

@Composable
internal fun DraggableCropFrame(
    cropRect: Rect,
    mediaBounds: Rect,
    onChange: (Rect) -> Unit,
    modifier: Modifier = Modifier,
) {
    val handleTouchRadius = 28.dp
    val minCropSize = 96.dp
    val latestCropRect by rememberUpdatedState(cropRect)
    val latestMediaBounds by rememberUpdatedState(mediaBounds)

    Box(modifier.fillMaxSize()) {
        CropFrameOverlay(cropRect = cropRect)

        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        val handleRadiusPx = handleTouchRadius.toPx()
                        val minCropSizePx = minCropSize.toPx()
                        var dragHandle: CropDragHandle? = null
                        var activeRect: Rect? = null
                        detectDragGestures(
                            onDragStart = { start ->
                                val rect = latestCropRect
                                dragHandle = rect.dragHandleAt(start, handleRadiusPx)
                                activeRect = rect
                            },
                            onDragEnd = {
                                dragHandle = null
                                activeRect = null
                            },
                            onDragCancel = {
                                dragHandle = null
                                activeRect = null
                            },
                        ) { change, dragAmount ->
                            val handle = dragHandle
                            val rect = activeRect
                            if (handle != null && rect != null) {
                                change.consume()
                                val bounds = latestMediaBounds
                                val nextRect =
                                    rect
                                        .drag(handle, Offset(dragAmount.x, dragAmount.y), minCropSizePx)
                                        .coerceInBounds(bounds, minCropSizePx)
                                activeRect = nextRect
                                onChange(nextRect)
                            }
                        }
                    },
        )
    }
}

@Composable
internal fun CropFrameOverlay(cropRect: Rect) {
    Canvas(Modifier.fillMaxSize()) {
        val overlayPath =
            Path().apply {
                fillType = PathFillType.EvenOdd
                addRect(Rect(Offset.Zero, size))
                addRect(cropRect)
            }
        drawPath(overlayPath, Color.Black.copy(alpha = 0.55f))

        val left = cropRect.left
        val top = cropRect.top
        val right = cropRect.right
        val bottom = cropRect.bottom
        val gridColor = Color.White.copy(alpha = 0.35f)
        val gridStroke = 1.dp.toPx()

        val thirdW = cropRect.width / 3f
        val thirdH = cropRect.height / 3f
        drawLine(gridColor, Offset(left + thirdW, top), Offset(left + thirdW, bottom), gridStroke)
        drawLine(gridColor, Offset(left + thirdW * 2f, top), Offset(left + thirdW * 2f, bottom), gridStroke)
        drawLine(gridColor, Offset(left, top + thirdH), Offset(right, top + thirdH), gridStroke)
        drawLine(gridColor, Offset(left, top + thirdH * 2f), Offset(right, top + thirdH * 2f), gridStroke)

        val cornerLen = 22.dp.toPx()
        val stroke = 3.dp.toPx()
        val color = Color.White

        drawLine(color, Offset(left, top), Offset(left + cornerLen, top), stroke)
        drawLine(color, Offset(left, top), Offset(left, top + cornerLen), stroke)
        drawLine(color, Offset(right, top), Offset(right - cornerLen, top), stroke)
        drawLine(color, Offset(right, top), Offset(right, top + cornerLen), stroke)
        drawLine(color, Offset(left, bottom), Offset(left + cornerLen, bottom), stroke)
        drawLine(color, Offset(left, bottom), Offset(left, bottom - cornerLen), stroke)
        drawLine(color, Offset(right, bottom), Offset(right - cornerLen, bottom), stroke)
        drawLine(color, Offset(right, bottom), Offset(right, bottom - cornerLen), stroke)
    }
}

internal fun fittedMediaBounds(
    viewWidth: Float,
    viewHeight: Float,
    sourceSize: Size?,
): Rect {
    val sourceWidth = sourceSize?.width?.takeIf { it > 0f } ?: viewWidth
    val sourceHeight = sourceSize?.height?.takeIf { it > 0f } ?: viewHeight
    val scale = minOf(viewWidth / sourceWidth, viewHeight / sourceHeight)
    val fittedWidth = sourceWidth * scale
    val fittedHeight = sourceHeight * scale
    val left = (viewWidth - fittedWidth) / 2f
    val top = (viewHeight - fittedHeight) / 2f
    return Rect(
        left = left,
        top = top,
        right = left + fittedWidth,
        bottom = top + fittedHeight,
    )
}

internal fun Rect.dragHandleAt(
    point: Offset,
    radius: Float,
): CropDragHandle? {
    val nearLeft = kotlin.math.abs(point.x - left) <= radius
    val nearRight = kotlin.math.abs(point.x - right) <= radius
    val nearTop = kotlin.math.abs(point.y - top) <= radius
    val nearBottom = kotlin.math.abs(point.y - bottom) <= radius

    return when {
        nearLeft && nearTop -> CropDragHandle.TopLeft
        nearRight && nearTop -> CropDragHandle.TopRight
        nearLeft && nearBottom -> CropDragHandle.BottomLeft
        nearRight && nearBottom -> CropDragHandle.BottomRight
        nearLeft && point.y in top..bottom -> CropDragHandle.Left
        nearRight && point.y in top..bottom -> CropDragHandle.Right
        nearTop && point.x in left..right -> CropDragHandle.Top
        nearBottom && point.x in left..right -> CropDragHandle.Bottom
        contains(point) -> CropDragHandle.Move
        else -> null
    }
}

internal fun Rect.drag(
    handle: CropDragHandle,
    delta: Offset,
    minSize: Float,
): Rect {
    var nextLeft = left
    var nextTop = top
    var nextRight = right
    var nextBottom = bottom

    when (handle) {
        CropDragHandle.Move -> {
            nextLeft += delta.x
            nextRight += delta.x
            nextTop += delta.y
            nextBottom += delta.y
        }
        CropDragHandle.Left -> nextLeft = (nextLeft + delta.x).coerceAtMost(nextRight - minSize)
        CropDragHandle.Right -> nextRight = (nextRight + delta.x).coerceAtLeast(nextLeft + minSize)
        CropDragHandle.Top -> nextTop = (nextTop + delta.y).coerceAtMost(nextBottom - minSize)
        CropDragHandle.Bottom -> nextBottom = (nextBottom + delta.y).coerceAtLeast(nextTop + minSize)
        CropDragHandle.TopLeft -> {
            nextLeft = (nextLeft + delta.x).coerceAtMost(nextRight - minSize)
            nextTop = (nextTop + delta.y).coerceAtMost(nextBottom - minSize)
        }
        CropDragHandle.TopRight -> {
            nextRight = (nextRight + delta.x).coerceAtLeast(nextLeft + minSize)
            nextTop = (nextTop + delta.y).coerceAtMost(nextBottom - minSize)
        }
        CropDragHandle.BottomLeft -> {
            nextLeft = (nextLeft + delta.x).coerceAtMost(nextRight - minSize)
            nextBottom = (nextBottom + delta.y).coerceAtLeast(nextTop + minSize)
        }
        CropDragHandle.BottomRight -> {
            nextRight = (nextRight + delta.x).coerceAtLeast(nextLeft + minSize)
            nextBottom = (nextBottom + delta.y).coerceAtLeast(nextTop + minSize)
        }
    }

    return Rect(nextLeft, nextTop, nextRight, nextBottom)
}

internal fun Rect.coerceInBounds(
    bounds: Rect,
    minSize: Float,
): Rect {
    val maxWidth = bounds.width.coerceAtLeast(0f)
    val maxHeight = bounds.height.coerceAtLeast(0f)
    if (maxWidth <= 0f || maxHeight <= 0f) {
        return bounds
    }
    val minAllowedWidth = minSize.coerceAtMost(maxWidth)
    val minAllowedHeight = minSize.coerceAtMost(maxHeight)
    val width = width.coerceIn(minAllowedWidth, maxWidth)
    val height = height.coerceIn(minAllowedHeight, maxHeight)
    val minLeft = bounds.left
    val maxLeft = (bounds.right - width).coerceAtLeast(minLeft)
    val minTop = bounds.top
    val maxTop = (bounds.bottom - height).coerceAtLeast(minTop)
    val nextLeft = left.coerceIn(minLeft, maxLeft)
    val nextTop = top.coerceIn(minTop, maxTop)
    return Rect(
        left = nextLeft,
        top = nextTop,
        right = nextLeft + width,
        bottom = nextTop + height,
    )
}

internal fun cropRectToNormalized(
    cropRect: Rect,
    mediaBounds: Rect,
): NormalizedCropRect {
    val fx0 = ((cropRect.left - mediaBounds.left) / mediaBounds.width).coerceIn(0f, 1f)
    val fx1 = ((cropRect.right - mediaBounds.left) / mediaBounds.width).coerceIn(0f, 1f)
    val fy0 = ((cropRect.top - mediaBounds.top) / mediaBounds.height).coerceIn(0f, 1f)
    val fy1 = ((cropRect.bottom - mediaBounds.top) / mediaBounds.height).coerceIn(0f, 1f)
    return NormalizedCropRect(fx0, fx1, fy0, fy1)
}

internal data class NormalizedCropRect(
    val left: Float,
    val right: Float,
    val top: Float,
    val bottom: Float,
) {
    val isFullFrame: Boolean
        get() = left <= 0.01f && right >= 0.99f && top <= 0.01f && bottom >= 0.99f
}
