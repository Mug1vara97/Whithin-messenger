package com.whithin.voice.audio

import io.livekit.android.audio.AudioProcessorInterface
import java.nio.ByteBuffer

/** Runs local VAD on every capture frame — independent of RNNoise bypass. */
class VadCaptureAudioProcessor(
    private val detector: VoiceActivityDetector,
) : AudioProcessorInterface {
    private var speechBandMeter: SpeechBandLevelMeter? = null

    override fun getName(): String = "WhithinVadCapture"

    override fun isEnabled(): Boolean = true

    override fun initializeAudioProcessing(sampleRateHz: Int, numChannels: Int) {
        speechBandMeter = SpeechBandLevelMeter(sampleRateHz)
    }

    override fun resetAudioProcessing(newRate: Int) {
        speechBandMeter = SpeechBandLevelMeter(newRate)
    }

    override fun processAudio(numBands: Int, numFrames: Int, buffer: ByteBuffer) {
        if (numFrames <= 0) return
        val meter = speechBandMeter ?: return
        val level = meter.measureFloatPcmLevel(buffer, numFrames)
        detector.processFrame(level)
    }
}
