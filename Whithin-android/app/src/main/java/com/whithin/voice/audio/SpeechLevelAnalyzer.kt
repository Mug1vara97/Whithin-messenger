package com.whithin.voice.audio

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.sqrt

/** Speech-focused band — same intent as web [SPEECH_BAND_MIN_HZ] / [SPEECH_BAND_MAX_HZ]. */
private const val SPEECH_BAND_MIN_HZ = 200.0
private const val SPEECH_BAND_MAX_HZ = 3200.0

/**
 * Measures level in the speech band (200–3200 Hz) for local mic VAD.
 * Full-band RMS is too sensitive to rumble and room noise.
 */
internal class SpeechBandLevelMeter(
    sampleRateHz: Int,
) {
    private val samplePeriod = 1.0 / sampleRateHz.coerceAtLeast(8_000)

    private val highPassAlpha =
        run {
            val rc = 1.0 / (2.0 * PI * SPEECH_BAND_MIN_HZ)
            rc / (rc + samplePeriod)
        }
    private val lowPassAlpha =
        run {
            val rc = 1.0 / (2.0 * PI * SPEECH_BAND_MAX_HZ)
            samplePeriod / (rc + samplePeriod)
        }

    private var highPassOut = 0.0
    private var highPassIn = 0.0
    private var lowPassOut = 0.0

    fun measureFloatPcmLevel(buffer: ByteBuffer, numFrames: Int): Float {
        if (numFrames <= 0) return 0f

        val savedOrder = buffer.order()
        buffer.order(ByteOrder.nativeOrder())

        val start = buffer.position()
        var sumSq = 0.0
        for (i in 0 until numFrames) {
            val sample = buffer.getFloat(start + i * Float.SIZE_BYTES).toDouble()
            highPassOut = highPassAlpha * (highPassOut + sample - highPassIn)
            highPassIn = sample
            lowPassOut += lowPassAlpha * (highPassOut - lowPassOut)
            sumSq += lowPassOut * lowPassOut
        }
        buffer.order(savedOrder)

        val rms = sqrt(sumSq / numFrames)
        return (rms * SpeechLevelAnalyzer.RMS_TO_LEVEL_SCALE).toFloat().coerceIn(0f, 255f)
    }

    fun reset() {
        highPassOut = 0.0
        highPassIn = 0.0
        lowPassOut = 0.0
    }
}

internal object SpeechLevelAnalyzer {
    /**
     * Maps float capture PCM RMS to 0–255 (web VAD byte-frequency scale).
     * LiveKit capture post-processor uses float samples; [numFrames] is the sample count (mono).
     */
    const val RMS_TO_LEVEL_SCALE = 1800.0

    fun measureFloatPcmLevel(buffer: ByteBuffer, numFrames: Int): Float {
        if (numFrames <= 0) return 0f

        val savedOrder = buffer.order()
        buffer.order(ByteOrder.nativeOrder())

        val start = buffer.position()
        var sumSq = 0.0
        for (i in 0 until numFrames) {
            val sample = buffer.getFloat(start + i * Float.SIZE_BYTES).toDouble()
            sumSq += sample * sample
        }
        buffer.order(savedOrder)

        val rms = sqrt(sumSq / numFrames)
        return (rms * RMS_TO_LEVEL_SCALE).toFloat().coerceIn(0f, 255f)
    }

    fun measureShortPcmLevel(
        buffer: ByteBuffer,
        numFrames: Int,
        channels: Int,
    ): Float {
        val sampleCount = numFrames * channels.coerceAtLeast(1)
        if (sampleCount <= 0) return 0f

        val savedOrder = buffer.order()
        buffer.order(ByteOrder.LITTLE_ENDIAN)

        val start = buffer.position()
        var sumSq = 0.0
        for (i in 0 until sampleCount) {
            val sample = buffer.getShort(start + i * Short.SIZE_BYTES) / 32768.0
            sumSq += sample * sample
        }
        buffer.order(savedOrder)

        val rms = sqrt(sumSq / sampleCount)
        return (rms * RMS_TO_LEVEL_SCALE).toFloat().coerceIn(0f, 255f)
    }
}
