package com.whithin.voice.audio

import livekit.org.webrtc.AudioTrackSink
import java.nio.ByteBuffer

/** Local VAD on remote participant audio — same role as web initializeRemoteVAD. */
class RemoteAudioVadSink(
    private val detector: VoiceActivityDetector,
) : AudioTrackSink {
    override fun onData(
        audioData: ByteBuffer,
        bitsPerSample: Int,
        sampleRate: Int,
        numberOfChannels: Int,
        numberOfFrames: Int,
        absoluteCaptureTimestampMs: Long,
    ) {
        if (bitsPerSample != 16 || numberOfFrames <= 0) return
        val level =
            SpeechLevelAnalyzer.measureShortPcmLevel(
                audioData,
                numberOfFrames,
                numberOfChannels,
            )
        detector.processFrame(level)
    }
}
