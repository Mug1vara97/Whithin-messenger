package com.whithin.voice.presentation.ui.components

import android.graphics.Bitmap
import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas

@Composable
internal fun TransformedImagePreview(
    bitmap: Bitmap,
    viewWidth: Float,
    viewHeight: Float,
    quarterTurns: Int,
    straightenDegrees: Float,
    mirrored: Boolean,
    modifier: Modifier = Modifier,
) {
    val drawMatrix =
        remember(bitmap, viewWidth, viewHeight, quarterTurns, straightenDegrees, mirrored) {
            ImageTransformMath.buildDrawMatrix(
                sourceWidth = bitmap.width,
                sourceHeight = bitmap.height,
                viewWidth = viewWidth,
                viewHeight = viewHeight,
                quarterTurns = quarterTurns,
                straightenDegrees = straightenDegrees,
                mirrored = mirrored,
            )
        }
    val paint =
        remember {
            Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        }

    Canvas(modifier.fillMaxSize()) {
        drawIntoCanvas { canvas ->
            canvas.nativeCanvas.drawBitmap(bitmap, drawMatrix, paint)
        }
    }
}
