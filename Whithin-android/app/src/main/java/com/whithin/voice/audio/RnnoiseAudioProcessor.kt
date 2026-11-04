package com.whithin.voice.audio

import android.util.Log
import io.livekit.android.audio.AudioProcessorInterface
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

/**
 * RNNoise capture post-processor — same algorithm family as web [NoiseSuppressionManager] (rnnoise mode).
 */
class RnnoiseAudioProcessor : AudioProcessorInterface {
    private val enabled = AtomicBoolean(false)
  private var nativeHandle: Long = 0
    private var frameSize: Int = 0
    private var sampleRateHz: Int = 0
    private val frameScratch = FloatArray(512)

    fun setEnabled(value: Boolean) {
        enabled.set(value)
    }

    override fun getName(): String = "WhithinRnnoise"

    override fun initializeAudioProcessing(sampleRateHz: Int, numChannels: Int) {
        this.sampleRateHz = sampleRateHz
        if (numChannels != 1) {
            Log.w(TAG, "RNNoise expects mono input, got channels=$numChannels")
        }
        if (nativeHandle == 0L) {
            nativeHandle = RnnoiseNative.nativeCreate()
            frameSize = RnnoiseNative.nativeGetFrameSize().coerceAtLeast(1)
        }
        Log.d(TAG, "initialized sampleRate=$sampleRateHz frameSize=$frameSize")
    }

    override fun isEnabled(): Boolean = enabled.get()

    override fun processAudio(numBands: Int, numFrames: Int, buffer: ByteBuffer) {
        if (!enabled.get() || nativeHandle == 0L || numFrames <= 0 || !buffer.hasRemaining()) {
            return
        }

        val effectiveFrameSize = frameSize.coerceAtLeast(1)
        buffer.order(ByteOrder.nativeOrder())

        var offset = 0
        while (offset + effectiveFrameSize <= numFrames) {
            readFloatFrame(buffer, offset, effectiveFrameSize, frameScratch)
            RnnoiseNative.nativeProcessFrame(nativeHandle, frameScratch, 0, effectiveFrameSize)
            writeFloatFrame(buffer, offset, effectiveFrameSize, frameScratch)
            offset += effectiveFrameSize
        }
    }

    override fun resetAudioProcessing(newRate: Int) {
        if (newRate != sampleRateHz) {
            releaseNative()
            sampleRateHz = newRate
        }
    }

    fun release() {
        releaseNative()
    }

    private fun releaseNative() {
        if (nativeHandle != 0L) {
            RnnoiseNative.nativeDestroy(nativeHandle)
            nativeHandle = 0L
        }
    }

    private fun readFloatFrame(
        buffer: ByteBuffer,
        frameOffset: Int,
        frameSize: Int,
        out: FloatArray,
    ) {
        val start = buffer.position()
        val baseIndex = start + frameOffset * Float.SIZE_BYTES
        for (i in 0 until frameSize) {
            out[i] = buffer.getFloat(baseIndex + i * Float.SIZE_BYTES)
        }
    }

    private fun writeFloatFrame(
        buffer: ByteBuffer,
        frameOffset: Int,
        frameSize: Int,
        values: FloatArray,
    ) {
        val start = buffer.position()
        val baseIndex = start + frameOffset * Float.SIZE_BYTES
        for (i in 0 until frameSize) {
            buffer.putFloat(baseIndex + i * Float.SIZE_BYTES, values[i])
        }
    }

    companion object {
        private const val TAG = "RnnoiseAudioProcessor"
    }
}
