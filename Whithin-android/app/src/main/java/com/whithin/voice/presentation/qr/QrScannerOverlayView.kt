package com.whithin.voice.presentation.qr

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.util.TypedValue
import android.view.View
import kotlin.math.min

class QrScannerOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#A6000000")
        style = Paint.Style.FILL
    }

    private val cornerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2F8CFF")
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeWidth = dp(4f)
    }

    private val clearAreaPath = Path()
    private val rect = RectF()

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val frameSize = min(width, height) * 0.62f
        val left = (width - frameSize) / 2f
        val top = (height - frameSize) / 2f
        val right = left + frameSize
        val bottom = top + frameSize
        rect.set(left, top, right, bottom)

        clearAreaPath.reset()
        clearAreaPath.fillType = Path.FillType.EVEN_ODD
        clearAreaPath.addRect(0f, 0f, width.toFloat(), height.toFloat(), Path.Direction.CW)
        clearAreaPath.addRoundRect(rect, dp(16f), dp(16f), Path.Direction.CCW)
        canvas.drawPath(clearAreaPath, maskPaint)

        drawCorners(canvas, rect)
    }

    private fun drawCorners(canvas: Canvas, frame: RectF) {
        val cornerLen = frame.width() * 0.16f

        // Top-left.
        canvas.drawLine(frame.left, frame.top + cornerLen, frame.left, frame.top, cornerPaint)
        canvas.drawLine(frame.left, frame.top, frame.left + cornerLen, frame.top, cornerPaint)

        // Top-right.
        canvas.drawLine(frame.right - cornerLen, frame.top, frame.right, frame.top, cornerPaint)
        canvas.drawLine(frame.right, frame.top, frame.right, frame.top + cornerLen, cornerPaint)

        // Bottom-left.
        canvas.drawLine(frame.left, frame.bottom - cornerLen, frame.left, frame.bottom, cornerPaint)
        canvas.drawLine(frame.left, frame.bottom, frame.left + cornerLen, frame.bottom, cornerPaint)

        // Bottom-right.
        canvas.drawLine(frame.right - cornerLen, frame.bottom, frame.right, frame.bottom, cornerPaint)
        canvas.drawLine(frame.right, frame.bottom - cornerLen, frame.right, frame.bottom, cornerPaint)
    }

    private fun dp(value: Float): Float {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics
        )
    }
}
