package com.whithin.voice.presentation.service

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.whithin.voice.audio.CompositeCaptureAudioProcessor
import com.whithin.voice.audio.RemoteAudioVadSink
import com.whithin.voice.audio.RnnoiseAudioProcessor
import com.whithin.voice.audio.VadCaptureAudioProcessor
import com.whithin.voice.audio.VoiceActivityDetector
import com.whithin.voice.data.local.AppSettingsStore
import com.whithin.voice.presentation.ui.utils.VoiceCallTrackResolver
import com.whithin.voice.presentation.voice.VoiceMuteLogger
import io.livekit.android.room.track.AudioTrack
import io.livekit.android.AudioOptions
import io.livekit.android.LiveKit
import io.livekit.android.LiveKitOverrides
import io.livekit.android.RoomOptions
import io.livekit.android.audio.AudioProcessorOptions
import io.livekit.android.room.Room
import io.livekit.android.room.track.LocalAudioTrackOptions
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.TrackPublication
import io.livekit.android.util.LoggingLevel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LiveKitService @Inject constructor(
    private val appContext: Context,
    private val appSettingsStore: AppSettingsStore,
) {
    private var room: Room? = null
    private var activeRoomName: String = "Voice Call"
    private val rnnoiseProcessor = RnnoiseAudioProcessor()
    private val mainHandler = Handler(Looper.getMainLooper())

    private data class RemoteVadEntry(
        val detector: VoiceActivityDetector,
        val sink: RemoteAudioVadSink,
        val track: AudioTrack,
    )

    private val remoteVadEntries = mutableMapOf<String, RemoteVadEntry>()

    /** UI/socket mute state — playback follows this when set, not only publication.muted. */
    private val remoteMicMutedByUserId = mutableMapOf<String, Boolean>()

    var onRemoteSpeakingChange: ((userId: String, speaking: Boolean) -> Unit)? = null
    
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    
    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted.asStateFlow()
    
    private val _isVideoEnabled = MutableStateFlow(false)
    val isVideoEnabled: StateFlow<Boolean> = _isVideoEnabled.asStateFlow()
    
    private val _isScreenSharing = MutableStateFlow(false)
    val isScreenSharing: StateFlow<Boolean> = _isScreenSharing.asStateFlow()
    
    private val _isSpeakerMode = MutableStateFlow(true) // Default to speaker mode
    val isSpeakerMode: StateFlow<Boolean> = _isSpeakerMode.asStateFlow()

    private val _selectedAudioOutputId = MutableStateFlow(ID_SPEAKER)
    val selectedAudioOutputId: StateFlow<String> = _selectedAudioOutputId.asStateFlow()

    private val _audioOutputDevices = MutableStateFlow<List<AudioOutputDevice>>(emptyList())
    val audioOutputDevices: StateFlow<List<AudioOutputDevice>> = _audioOutputDevices.asStateFlow()

    /** Локальное воспроизведение голосов собеседников (кнопка «наушники» / deafen). */
    private val _isRemoteAudioEnabled = MutableStateFlow(true)
    val isRemoteAudioEnabled: StateFlow<Boolean> = _isRemoteAudioEnabled.asStateFlow()

    private val _isNoiseSuppressed = MutableStateFlow(false)
    val isNoiseSuppressed: StateFlow<Boolean> = _isNoiseSuppressed.asStateFlow()

    private val _localIsSpeaking = MutableStateFlow(false)
    val localIsSpeaking: StateFlow<Boolean> = _localIsSpeaking.asStateFlow()

    private val localVoiceActivityDetector =
        VoiceActivityDetector.createLocal { speaking ->
            if (_isMuted.value) return@createLocal
            mainHandler.post {
                if (!_isMuted.value) {
                    _localIsSpeaking.value = speaking
                }
            }
        }
    private val vadCaptureProcessor = VadCaptureAudioProcessor(localVoiceActivityDetector)
    private val captureAudioProcessor =
        CompositeCaptureAudioProcessor(vadCaptureProcessor, rnnoiseProcessor)

    private val screenShareAudioController = ScreenShareAudioController()
    
    private val audioManager: AudioManager by lazy {
        appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    
    private val powerManager: PowerManager by lazy {
        appContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    }
    
    private var wakeLock: PowerManager.WakeLock? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    
    init {
        LiveKit.loggingLevel = LoggingLevel.INFO
    }

    /** Сброс режима «звонок» вне активного LiveKit-сеанса (например, после краша во время звонка). */
    fun ensureNormalAudioModeIfIdle() {
        if (_isConnected.value || room != null) return
        try {
            if (audioManager.mode != AudioManager.MODE_NORMAL) {
                audioManager.mode = AudioManager.MODE_NORMAL
            }
            audioManager.isSpeakerphoneOn = false
            stopBluetoothRouting()
        } catch (e: Exception) {
            Log.w("LiveKitService", "ensureNormalAudioModeIfIdle failed", e)
        }
    }
    
    suspend fun connect(url: String, token: String, roomName: String = "Voice Call") {
        try {
            val noiseEnabled = appSettingsStore.peekSettings().noiseSuppression
            applyNoiseSuppressionState(noiseEnabled, persist = false)

            val audioCaptureDefaults = buildAudioCaptureDefaults(noiseEnabled)
            val roomOptions =
                RoomOptions(
                    audioTrackCaptureDefaults = audioCaptureDefaults,
                )
            val overrides =
                LiveKitOverrides(
                    audioOptions =
                        AudioOptions(
                            javaAudioDeviceModuleCustomizer = { builder ->
                                builder.setUseHardwareNoiseSuppressor(noiseEnabled)
                                builder.setUseHardwareAcousticEchoCanceler(true)
                            },
                            audioProcessorOptions =
                                AudioProcessorOptions(
                                    capturePostProcessor = captureAudioProcessor,
                                    capturePostBypass = false,
                                ),
                        ),
                )

            room = LiveKit.create(appContext, roomOptions, overrides)
            
            room?.let { r ->
                activeRoomName = roomName
                // Start foreground service BEFORE connecting
                // This is REQUIRED for microphone to work when screen is off (Android 8+)
                val fgsStarted = VoiceCallService.startService(appContext, roomName)
                if (fgsStarted) {
                    Log.d("LiveKitService", "Foreground service started")
                } else {
                    Log.w("LiveKitService", "Foreground service not started (mic permission or FGS policy)")
                }
                
                // Set audio mode for voice communication BEFORE connecting
                // This is critical for microphone to work when screen is off
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                
                // Acquire wake lock to keep device awake during call
                acquireWakeLock()
                
                // Request audio focus for voice call
                requestAudioFocus()
                
                // Connect to room
                r.connect(url, token)

                // Enable microphone on join (same as web client with initialMuted = false)
                r.localParticipant.setMicrophoneEnabled(true)

                // Camera stays disabled by default
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

                _isConnected.value = true
                _isMuted.value = !r.localParticipant.isMicrophoneEnabled()
                _isVideoEnabled.value = false
                _isNoiseSuppressed.value = noiseEnabled
                refreshAudioOutputDevices()
                selectAudioOutput(ID_SPEAKER)
                ensureCaptureProcessorActive(r)
            }
        } catch (e: Exception) {
            // Stop foreground service on error
            VoiceCallService.stopService(appContext)
            releaseWakeLock()
            abandonAudioFocus()
            throw e
        }
    }
    
    suspend fun toggleMute() {
        room?.let { r ->
            val currentState = r.localParticipant.isMicrophoneEnabled()
            r.localParticipant.setMicrophoneEnabled(!currentState)
            _isMuted.value = !r.localParticipant.isMicrophoneEnabled()
            if (_isMuted.value) {
                resetLocalVad()
            }

            // Ensure audio mode is maintained when toggling mute
            // This helps keep microphone access active
            if (!_isMuted.value) {
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                // Re-acquire wake lock if needed
                if (wakeLock?.isHeld != true) {
                    acquireWakeLock()
                }
            }
        }
    }
    
    suspend fun toggleCamera() {
        room?.let { r ->
            val currentState = r.localParticipant.isCameraEnabled()
            r.localParticipant.setCameraEnabled(!currentState)
            _isVideoEnabled.value = r.localParticipant.isCameraEnabled()
        }
    }
    
    suspend fun enableScreenShare(mediaProjectionIntent: Intent) {
        room?.let { r ->
            r.localParticipant.setScreenShareEnabled(true, mediaProjectionIntent)
            _isScreenSharing.value = r.localParticipant.isScreenShareEnabled()
            if (_isScreenSharing.value) {
                VoiceCallService.setScreenSharingActive(appContext, activeRoomName, active = true)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                kotlinx.coroutines.delay(350)
                screenShareAudioController.start(r)
            }
        }
    }

    suspend fun disableScreenShare() {
        room?.let { r ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                screenShareAudioController.stop(r)
            }
            r.localParticipant.setScreenShareEnabled(false, null)
            _isScreenSharing.value = r.localParticipant.isScreenShareEnabled()
            VoiceCallService.setScreenSharingActive(appContext, activeRoomName, active = false)
        }
    }
    
    suspend fun toggleNoiseSuppression(): Boolean {
        val next = !_isNoiseSuppressed.value
        applyNoiseSuppressionState(next, persist = true)
        return next
    }

    suspend fun setNoiseSuppressionEnabled(enabled: Boolean) {
        if (_isNoiseSuppressed.value == enabled) return
        applyNoiseSuppressionState(enabled, persist = true)
    }

    private suspend fun applyNoiseSuppressionState(enabled: Boolean, persist: Boolean) {
        if (persist) {
            appSettingsStore.setNoiseSuppression(enabled)
        }
        rnnoiseProcessor.setEnabled(enabled)
        _isNoiseSuppressed.value = enabled
        room?.let { ensureCaptureProcessorActive(it) }
    }

    private fun ensureCaptureProcessorActive(room: Room) {
        room.audioProcessingController?.let { controller ->
            controller.bypassCapturePostProcessing = false
            controller.capturePostProcessor = captureAudioProcessor
        }
    }

    fun resetLocalVad() {
        localVoiceActivityDetector.forceReset()
        _localIsSpeaking.value = false
    }

    fun attachRemoteVad(userId: String, track: Track, publication: TrackPublication? = null) {
        if (track.kind != Track.Kind.AUDIO) return
        if (publication != null) {
            if (VoiceCallTrackResolver.isScreenShareAudioPublication(publication)) return
            if (VoiceCallTrackResolver.isParticipantMicrophonePublication(publication) &&
                isRemoteMicEffectivelyMuted(userId, publication)
            ) {
                detachRemoteVad(userId)
                return
            }
        }
        val audioTrack = track as? AudioTrack ?: return
        detachRemoteVad(userId)

        val detector =
            VoiceActivityDetector.createRemote { speaking ->
                mainHandler.post {
                    onRemoteSpeakingChange?.invoke(userId, speaking)
                }
            }
        val sink = RemoteAudioVadSink(detector)
        runCatching { audioTrack.addSink(sink) }
            .onFailure { Log.w("LiveKitService", "Failed to attach remote VAD for $userId", it) }
        remoteVadEntries[userId] = RemoteVadEntry(detector, sink, audioTrack)
    }

    fun detachRemoteVad(userId: String) {
        remoteVadEntries.remove(userId)?.let { entry ->
            runCatching { entry.track.removeSink(entry.sink) }
            entry.detector.release()
        }
    }

    fun detachAllRemoteVad() {
        remoteVadEntries.keys.toList().forEach { detachRemoteVad(it) }
    }

    private fun buildAudioCaptureDefaults(noiseEnabled: Boolean): LocalAudioTrackOptions {
        return LocalAudioTrackOptions(
            noiseSuppression = noiseEnabled,
            echoCancellation = true,
            autoGainControl = true,
            highPassFilter = noiseEnabled,
            typingNoiseDetection = noiseEnabled,
        )
    }

    fun toggleSpeakerMode() {
        val nextId = if (_isSpeakerMode.value) ID_EARPIECE else ID_SPEAKER
        selectAudioOutput(nextId)
    }

    fun refreshAudioOutputDevices() {
        val phoneModel = Build.MODEL.ifBlank { "Телефон" }
        val devices = mutableListOf(
            AudioOutputDevice(
                id = ID_SPEAKER,
                title = "Динамик",
                subtitle = phoneModel,
                type = AudioOutputType.SPEAKER,
            ),
            AudioOutputDevice(
                id = ID_EARPIECE,
                title = "Телефон",
                subtitle = phoneModel,
                type = AudioOutputType.EARPIECE,
            ),
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            outputs
                .filter { device ->
                    device.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        device.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                }
                .distinctBy { it.id }
                .forEach { device ->
                    val name = device.productName?.toString()?.trim().orEmpty()
                    devices.add(
                        AudioOutputDevice(
                            id = "${ID_BLUETOOTH_PREFIX}${device.id}",
                            title = name.ifBlank { "Bluetooth" },
                            subtitle = "Bluetooth",
                            type = AudioOutputType.BLUETOOTH,
                        ),
                    )
                }
        }

        if (devices.none { it.type == AudioOutputType.BLUETOOTH } &&
            (audioManager.isBluetoothScoOn || audioManager.isBluetoothA2dpOn)
        ) {
            devices.add(
                AudioOutputDevice(
                    id = ID_BLUETOOTH_GENERIC,
                    title = "Bluetooth",
                    subtitle = "Bluetooth",
                    type = AudioOutputType.BLUETOOTH,
                ),
            )
        }

        _audioOutputDevices.value = devices
    }

    fun selectAudioOutput(deviceId: String) {
        val device =
            _audioOutputDevices.value.firstOrNull { it.id == deviceId }
                ?: when (deviceId) {
                    ID_EARPIECE ->
                        AudioOutputDevice(ID_EARPIECE, "Телефон", null, AudioOutputType.EARPIECE)
                    else ->
                        AudioOutputDevice(ID_SPEAKER, "Динамик", null, AudioOutputType.SPEAKER)
                }

        stopBluetoothRouting()

        when (device.type) {
            AudioOutputType.SPEAKER -> {
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                audioManager.isSpeakerphoneOn = true
                _isSpeakerMode.value = true
            }
            AudioOutputType.EARPIECE -> {
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                audioManager.isSpeakerphoneOn = false
                _isSpeakerMode.value = false
            }
            AudioOutputType.BLUETOOTH -> {
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                audioManager.isSpeakerphoneOn = false
                _isSpeakerMode.value = false
                routeToBluetooth(device.id)
            }
        }

        _selectedAudioOutputId.value = device.id
        Log.d("LiveKitService", "Audio output selected: ${device.title} (${device.id})")
    }

    private fun routeToBluetooth(deviceId: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val targetId =
                deviceId.removePrefix(ID_BLUETOOTH_PREFIX).toIntOrNull()
            val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val target =
                outputs.firstOrNull { info ->
                    (info.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        info.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) &&
                        (targetId == null || info.id == targetId)
                }
            if (target != null && audioManager.setCommunicationDevice(target)) {
                return
            }
        }

        @Suppress("DEPRECATION")
        runCatching {
            audioManager.startBluetoothSco()
            audioManager.isBluetoothScoOn = true
        }.onFailure {
            Log.w("LiveKitService", "Failed to route audio to Bluetooth", it)
        }
    }

    private fun stopBluetoothRouting() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audioManager.clearCommunicationDevice()
        }
        @Suppress("DEPRECATION")
        runCatching {
            if (audioManager.isBluetoothScoOn) {
                audioManager.stopBluetoothSco()
                audioManager.isBluetoothScoOn = false
            }
        }
    }

    fun setRemoteAudioEnabled(enabled: Boolean) {
        _isRemoteAudioEnabled.value = enabled
        if (!enabled) {
            detachAllRemoteVad()
        }
        applyRemoteAudioPlaybackState()
    }

    fun setRemoteMicMuteState(userId: String, muted: Boolean, reason: String) {
        val previous = remoteMicMutedByUserId[userId]
        remoteMicMutedByUserId[userId] = muted
        VoiceMuteLogger.d(
            "setRemoteMicMuteState userId=$userId muted=$muted (was=$previous) reason=$reason",
        )
    }

    fun clearRemoteMicMuteStates() {
        if (remoteMicMutedByUserId.isNotEmpty()) {
            VoiceMuteLogger.d("clearRemoteMicMuteStates count=${remoteMicMutedByUserId.size}")
        }
        remoteMicMutedByUserId.clear()
    }

    fun applyPlaybackToAudioTrack(
        track: Track,
        publication: TrackPublication? = null,
        userId: String? = null,
    ) {
        if (track.kind != Track.Kind.AUDIO) return
        val shouldPlay = shouldPlayRemoteAudioPublication(publication, userId)
        setAudioTrackPlaybackEnabled(track, shouldPlay, publication, userId)
    }

    fun applyRemoteAudioPlaybackState() {
        room?.remoteParticipants?.values?.forEach { participant ->
            syncRemoteParticipantPlayback(participant)
        }
    }

    fun syncRemoteParticipantPlayback(participant: io.livekit.android.room.participant.Participant) {
        val userId = participant.identity?.value
        VoiceMuteLogger.d(
            "syncRemoteParticipantPlayback userId=$userId " +
                "uiMuted=${userId?.let { remoteMicMutedByUserId[it] }} " +
                "publications=${participant.audioTrackPublications.size}",
        )
        participant.audioTrackPublications.forEach { (publication, subscribedTrack) ->
            applyPlaybackToPublication(publication, subscribedTrack, userId)
            if (VoiceCallTrackResolver.isParticipantMicrophonePublication(publication)) {
                if (userId != null) {
                    syncRemoteMicrophoneVad(userId, publication, subscribedTrack ?: publication.track)
                }
            }
        }
    }

    private fun isRemoteMicEffectivelyMuted(userId: String?, publication: TrackPublication): Boolean {
        val uiMuted = userId?.let { remoteMicMutedByUserId[it] }
        val publicationMuted = publication.muted
        return uiMuted ?: publicationMuted
    }

    private fun shouldPlayRemoteAudioPublication(
        publication: TrackPublication?,
        userId: String? = null,
    ): Boolean {
        if (!_isRemoteAudioEnabled.value) return false
        if (publication == null) return true
        if (VoiceCallTrackResolver.isScreenShareAudioPublication(publication)) return true
        if (VoiceCallTrackResolver.isParticipantMicrophonePublication(publication)) {
            return !isRemoteMicEffectivelyMuted(userId, publication)
        }
        return !publication.muted
    }

    private fun syncRemoteMicrophoneVad(
        userId: String,
        publication: TrackPublication,
        track: Track?,
    ) {
        val effectivelyMuted = isRemoteMicEffectivelyMuted(userId, publication)
        VoiceMuteLogger.d(
            "syncRemoteMicrophoneVad userId=$userId " +
                "uiMuted=${remoteMicMutedByUserId[userId]} publicationMuted=${publication.muted} " +
                "effectiveMuted=$effectivelyMuted hasTrack=${track != null}",
        )
        if (!_isRemoteAudioEnabled.value || effectivelyMuted || track == null) {
            detachRemoteVad(userId)
            return
        }
        attachRemoteVad(userId, track, publication)
    }

    private fun applyPlaybackToPublication(
        publication: TrackPublication,
        subscribedTrack: Track?,
        userId: String?,
    ) {
        if (publication.kind != Track.Kind.AUDIO) return
        val track = subscribedTrack ?: publication.track ?: return
        applyPlaybackToAudioTrack(track, publication, userId)
    }

    private fun setAudioTrackPlaybackEnabled(
        track: Track,
        enabled: Boolean,
        publication: TrackPublication?,
        userId: String?,
    ) {
        val source = publication?.source?.name ?: publication?.name ?: "unknown"
        VoiceMuteLogger.d(
            "setAudioTrackPlaybackEnabled userId=$userId source=$source " +
                "trackSid=${track.sid} enabled=$enabled publicationMuted=${publication?.muted} " +
                "uiMuted=${userId?.let { remoteMicMutedByUserId[it] }} remoteAudioOn=${_isRemoteAudioEnabled.value}",
        )
        runCatching {
            if (enabled) {
                track.start()
            } else {
                track.stop()
            }
        }.onFailure {
            VoiceMuteLogger.w("Failed to update remote audio playback state", it)
        }
    }

    fun getRoom(): Room? = room
    
    suspend fun disconnect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            screenShareAudioController.stop(room)
        }
        room?.disconnect()
        room = null
        detachAllRemoteVad()
        clearRemoteMicMuteStates()
        resetLocalVad()
        captureAudioProcessor.release()
        onRemoteSpeakingChange = null
        _isConnected.value = false
        _isMuted.value = false
        _isVideoEnabled.value = false
        _isScreenSharing.value = false
        _isRemoteAudioEnabled.value = true
        _isNoiseSuppressed.value = false
        
        // Stop foreground service
        VoiceCallService.stopService(appContext)
        Log.d("LiveKitService", "Foreground service stopped")
        
        // Release wake lock
        releaseWakeLock()
        
        // Abandon audio focus
        abandonAudioFocus()
        
        stopBluetoothRouting()

        // Reset audio mode
        audioManager.mode = AudioManager.MODE_NORMAL
        audioManager.isSpeakerphoneOn = false
        _selectedAudioOutputId.value = ID_SPEAKER
        _audioOutputDevices.value = emptyList()
    }

    companion object {
        const val ID_SPEAKER = "speaker"
        const val ID_EARPIECE = "earpiece"
        const val ID_BLUETOOTH_GENERIC = "bluetooth"
        private const val ID_BLUETOOTH_PREFIX = "bt-"
    }
    
    private fun acquireWakeLock() {
        try {
            if (wakeLock == null) {
                // Use SCREEN_DIM_WAKE_LOCK to keep CPU and screen partially awake
                // This helps maintain microphone access when screen is off
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "LiveKitVoice::WakeLock"
                ).apply {
                    // Use setReferenceCounted(false) to prevent automatic release
                    setReferenceCounted(false)
                    // Acquire without timeout - we'll release manually
                    acquire()
                }
                Log.d("LiveKitService", "WakeLock acquired (PARTIAL_WAKE_LOCK)")
            } else if (!wakeLock!!.isHeld) {
                // Re-acquire if it was released
                wakeLock!!.acquire()
                Log.d("LiveKitService", "WakeLock re-acquired")
            }
        } catch (e: Exception) {
            Log.e("LiveKitService", "Failed to acquire WakeLock", e)
        }
    }
    
    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                    Log.d("LiveKitService", "WakeLock released")
                }
                wakeLock = null
            }
        } catch (e: Exception) {
            Log.e("LiveKitService", "Failed to release WakeLock", e)
        }
    }
    
    private fun requestAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                
                // Use AUDIOFOCUS_GAIN instead of AUDIOFOCUS_GAIN_TRANSIENT for continuous audio capture
                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener { focusChange ->
                        when (focusChange) {
                            AudioManager.AUDIOFOCUS_GAIN -> {
                                Log.d("LiveKitService", "Audio focus gained")
                                // Ensure audio mode is still set correctly
                                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                            }
                            AudioManager.AUDIOFOCUS_LOSS -> {
                                Log.w("LiveKitService", "Audio focus lost permanently")
                            }
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                                Log.w("LiveKitService", "Audio focus lost temporarily")
                            }
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                                Log.w("LiveKitService", "Audio focus lost, can duck")
                            }
                        }
                    }
                    .build()
                
                val result = audioManager.requestAudioFocus(audioFocusRequest!!)
                if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    Log.d("LiveKitService", "Audio focus requested and granted (AUDIOFOCUS_GAIN)")
                } else {
                    Log.w("LiveKitService", "Audio focus request denied: $result")
                }
            } else {
                @Suppress("DEPRECATION")
                // Use AUDIOFOCUS_GAIN for continuous audio capture
                val result = audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN
                )
                if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    Log.d("LiveKitService", "Audio focus requested and granted (legacy, AUDIOFOCUS_GAIN)")
                } else {
                    Log.w("LiveKitService", "Audio focus request denied (legacy): $result")
                }
            }
        } catch (e: Exception) {
            Log.e("LiveKitService", "Failed to request audio focus", e)
        }
    }
    
    private fun abandonAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let {
                    audioManager.abandonAudioFocusRequest(it)
                    audioFocusRequest = null
                    Log.d("LiveKitService", "Audio focus abandoned")
                }
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
                Log.d("LiveKitService", "Audio focus abandoned (legacy)")
            }
        } catch (e: Exception) {
            Log.e("LiveKitService", "Failed to abandon audio focus", e)
        }
    }
}
