package com.whithin.voice.audio

/**
 * Voice activity detector — same tuning as web [VOICE_ACTIVATION_VAD_OPTIONS].
 */
class VoiceActivityDetector(
    threshold: Float = DEFAULT_LOCAL_MIC_THRESHOLD,
    private val holdTimeMs: Long = 220L,
    private val activationDebounceMs: Long = 35L,
    private val deactivationDebounceMs: Long = 100L,
    private val minActivationFrames: Int = 2,
    private val smoothingFactor: Float = 0.5f,
    private val onSpeakingChange: (Boolean) -> Unit = {},
) {
    private var threshold: Float = threshold.coerceIn(0f, 255f)

    private var isSpeaking: Boolean = false
    private var lastSpeakingTimeMs: Long = 0L
    private var lastStateChangeTimeMs: Long = 0L
    private var smoothedVolume: Float = 0f
    private var framesAboveThreshold: Int = 0

    fun processFrame(rawLevel: Float) {
        smoothedVolume =
            smoothedVolume * (1f - smoothingFactor) + rawLevel.coerceIn(0f, 255f) * smoothingFactor

        val now = System.currentTimeMillis()
        val wasSpeaking = isSpeaking
        var newSpeakingState = isSpeaking

        if (smoothedVolume > threshold) {
            framesAboveThreshold += 1
            if (framesAboveThreshold >= minActivationFrames) {
                newSpeakingState = true
                lastSpeakingTimeMs = now
            }
        } else {
            framesAboveThreshold = 0
            if (now - lastSpeakingTimeMs > holdTimeMs) {
                newSpeakingState = false
            }
        }

        val timeSinceLastChange = now - lastStateChangeTimeMs
        val debounceMs =
            if (newSpeakingState) activationDebounceMs else deactivationDebounceMs

        if (wasSpeaking != newSpeakingState && timeSinceLastChange >= debounceMs) {
            isSpeaking = newSpeakingState
            lastStateChangeTimeMs = now
            onSpeakingChange(isSpeaking)
        }
    }

    fun forceReset() {
        if (!isSpeaking) return
        isSpeaking = false
        lastSpeakingTimeMs = 0L
        lastStateChangeTimeMs = System.currentTimeMillis()
        framesAboveThreshold = 0
        onSpeakingChange(false)
    }

    fun setThreshold(value: Float) {
        threshold = value.coerceIn(0f, 255f)
    }

    fun getSpeakingState(): Boolean = isSpeaking

    fun release() {
        forceReset()
        smoothedVolume = 0f
        framesAboveThreshold = 0
    }

    companion object {
        /** Web default mic threshold is 14; local capture needs slightly higher gate after speech-band filtering. */
        const val DEFAULT_LOCAL_MIC_THRESHOLD = 20f
        const val DEFAULT_REMOTE_THRESHOLD = 12f

        fun createLocal(onSpeakingChange: (Boolean) -> Unit = {}): VoiceActivityDetector =
            VoiceActivityDetector(
                threshold = DEFAULT_LOCAL_MIC_THRESHOLD,
                holdTimeMs = 220L,
                activationDebounceMs = 65L,
                deactivationDebounceMs = 120L,
                minActivationFrames = 4,
                smoothingFactor = 0.58f,
                onSpeakingChange = onSpeakingChange,
            )

        fun createRemote(onSpeakingChange: (Boolean) -> Unit = {}): VoiceActivityDetector =
            VoiceActivityDetector(
                threshold = DEFAULT_REMOTE_THRESHOLD,
                holdTimeMs = 250L,
                activationDebounceMs = 150L,
                deactivationDebounceMs = 150L,
                onSpeakingChange = onSpeakingChange,
            )
    }
}
