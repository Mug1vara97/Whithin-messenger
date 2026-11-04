package com.whithin.voice.presentation.ui.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Path
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan
import kotlin.random.Random

/**
 * Порт [org.telegram.ui.Components.BlobDrawable] из DrKLO/Telegram —
 * органика вокруг кнопки записи (RecordCircle big/tiny waves).
 */
internal class TelegramBlobDrawable(
    n: Int,
    private val random: Random = Random.Default,
) {
    var minRadius: Float = 0f
    var maxRadius: Float = 0f
    var cubicBezierK: Float = 1f

    private val nPoints = n.coerceAtLeast(3)
    private val lFactor = ((4.0 / 3.0) * tan(PI / (2.0 * nPoints))).toFloat()

    private val radius = FloatArray(nPoints)
    private val angle = FloatArray(nPoints)
    private val radiusNext = FloatArray(nPoints)
    private val angleNext = FloatArray(nPoints)
    private val progress = FloatArray(nPoints)
    private val speed = FloatArray(nPoints)

    private val pointStart = FloatArray(4)
    private val pointEnd = FloatArray(4)
    private val matrix = Matrix()

    var amplitude: Float = 0f
        private set
    private var animateToAmplitude = 0f
    private var animateAmplitudeDiff = 0f

    fun generateBlob() {
        for (i in 0 until nPoints) {
            generateBlob(radius, angle, i)
            generateBlob(radiusNext, angleNext, i)
            progress[i] = 0f
        }
    }

    private fun generateBlob(r: FloatArray, a: FloatArray, i: Int) {
        // Сток Telegram BlobDrawable (+чуть больше угла для видимых изгибов).
        val angleDif = 360f / nPoints * 0.08f
        val radDif = (maxRadius - minRadius).coerceAtLeast(0f)
        r[i] = minRadius + abs(random.nextFloat()) * radDif
        a[i] = 360f / nPoints * i + random.nextFloat() * angleDif
        speed[i] = 0.017f + 0.003f * abs(random.nextFloat())
    }

    fun setValue(value: Float, isBig: Boolean) {
        // Как Telegram RecordCircle.setAmplitude — линейная нормализация 0…1.
        animateToAmplitude = value.coerceIn(0f, 1f)
        val animationSpeed = if (isBig) 1f - 0.65f else 1f - 0.45f
        animateAmplitudeDiff =
            if (animateToAmplitude > amplitude) {
                (animateToAmplitude - amplitude) / (100f + 300f * animationSpeed)
            } else {
                (animateToAmplitude - amplitude) / (100f + 500f * animationSpeed)
            }
    }

    fun updateAmplitude(dtMs: Long) {
        if (animateToAmplitude == amplitude) return
        amplitude += animateAmplitudeDiff * dtMs
        if (animateAmplitudeDiff > 0f) {
            if (amplitude > animateToAmplitude) amplitude = animateToAmplitude
        } else {
            if (amplitude < animateToAmplitude) amplitude = animateToAmplitude
        }
    }

    fun update(amplitude: Float, speedScale: Float) {
        for (i in 0 until nPoints) {
            progress[i] += (speed[i] * MIN_SPEED) + amplitude * speed[i] * MAX_SPEED * speedScale
            if (progress[i] >= 1f) {
                progress[i] = 0f
                radius[i] = radiusNext[i]
                angle[i] = angleNext[i]
                generateBlob(radiusNext, angleNext, i)
            }
        }
    }

    fun buildPath(cX: Float, cY: Float, out: Path) {
        out.reset()
        for (i in 0 until nPoints) {
            val p = progress[i]
            val nextIndex = if (i + 1 < nPoints) i + 1 else 0
            val pNext = progress[nextIndex]
            val r1 = radius[i] * (1f - p) + radiusNext[i] * p
            val r2 = radius[nextIndex] * (1f - pNext) + radiusNext[nextIndex] * pNext
            val angle1 = angle[i] * (1f - p) + angleNext[i] * p
            val angle2 = angle[nextIndex] * (1f - pNext) + angleNext[nextIndex] * pNext

            val l = lFactor * (min(r1, r2) + (max(r1, r2) - min(r1, r2)) / 2f) * cubicBezierK

            matrix.reset()
            matrix.rotateZ(angle1)
            // Map relative points then translate — Compose Matrix rotates around origin.
            pointStart[0] = 0f
            pointStart[1] = -r1
            pointStart[2] = l
            pointStart[3] = -r1
            matrix.mapPoints(pointStart)

            matrix.reset()
            matrix.rotateZ(angle2)
            pointEnd[0] = 0f
            pointEnd[1] = -r2
            pointEnd[2] = -l
            pointEnd[3] = -r2
            matrix.mapPoints(pointEnd)

            val sx = cX + pointStart[0]
            val sy = cY + pointStart[1]
            val scx1 = cX + pointStart[2]
            val scy1 = cY + pointStart[3]
            val ecx1 = cX + pointEnd[2]
            val ecy1 = cY + pointEnd[3]
            val ex = cX + pointEnd[0]
            val ey = cY + pointEnd[1]

            if (i == 0) {
                out.moveTo(sx, sy)
            }
            out.cubicTo(scx1, scy1, ecx1, ecy1, ex, ey)
        }
        out.close()
    }

    companion object {
        const val MAX_SPEED = 8.2f
        const val MIN_SPEED = 0.8f
        const val SCALE_BIG_MIN = 0.878f
        const val SCALE_SMALL_MIN = 0.926f
        /** WaveDrawable.CIRCLE_ALPHA_1 — внешняя (big) волна. */
        const val CIRCLE_ALPHA_BIG = 0.30f
        /** WaveDrawable.CIRCLE_ALPHA_2 — внутренняя (tiny) волна. */
        const val CIRCLE_ALPHA_TINY = 0.15f
        const val FORM_BIG_MAX = 0.6f
        const val FORM_SMALL_MAX = 0.6f
    }
}

private fun Matrix.mapPoints(pts: FloatArray) {
    // map 2 points: (x0,y0) and (x1,y1)
    val a = map(Offset(pts[0], pts[1]))
    val b = map(Offset(pts[2], pts[3]))
    pts[0] = a.x
    pts[1] = a.y
    pts[2] = b.x
    pts[3] = b.y
}
