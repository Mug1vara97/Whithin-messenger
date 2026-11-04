package com.whithin.voice.audio

import io.livekit.android.audio.AudioProcessorInterface
import java.nio.ByteBuffer

/** VAD always runs; RNNoise runs only when enabled. */
class CompositeCaptureAudioProcessor(
    private val vadProcessor: VadCaptureAudioProcessor,
    private val rnnoiseProcessor: RnnoiseAudioProcessor,
) : AudioProcessorInterface {
    override fun getName(): String = "WhithinCaptureChain"

    override fun isEnabled(): Boolean = true

    override fun initializeAudioProcessing(sampleRateHz: Int, numChannels: Int) {
        vadProcessor.initializeAudioProcessing(sampleRateHz, numChannels)
        rnnoiseProcessor.initializeAudioProcessing(sampleRateHz, numChannels)
    }

    override fun resetAudioProcessing(newRate: Int) {
        vadProcessor.resetAudioProcessing(newRate)
        rnnoiseProcessor.resetAudioProcessing(newRate)
    }

    override fun processAudio(numBands: Int, numFrames: Int, buffer: ByteBuffer) {
        vadProcessor.processAudio(numBands, numFrames, buffer)
        if (rnnoiseProcessor.isEnabled()) {
            rnnoiseProcessor.processAudio(numBands, numFrames, buffer)
        }
    }

    fun release() {
        rnnoiseProcessor.release()
    }
}
