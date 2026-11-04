package com.whithin.voice.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.VoiceChannelParticipant
import com.whithin.voice.data.model.ProfileRealtimeUpdate
import com.whithin.voice.data.model.applyProfileUpdate
import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.data.repository.VoiceRepository
import com.whithin.voice.data.signalr.NotificationHub
import com.whithin.voice.data.signalr.ServerHub
import com.whithin.voice.data.socketio.VoiceSocketService
import com.whithin.voice.domain.model.Participant
import com.whithin.voice.presentation.service.AudioOutputDevice
import com.whithin.voice.presentation.service.LiveKitService
import dagger.hilt.android.lifecycle.HiltViewModel
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.room.Room
import io.livekit.android.room.participant.RemoteParticipant
import io.livekit.android.room.track.Track
import android.content.Intent
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import android.util.Log
import javax.inject.Inject
import com.whithin.voice.presentation.ui.utils.VoiceCallTrackResolver
import com.whithin.voice.presentation.voice.VoiceMuteLogger
import com.whithin.voice.util.ChatCallSignalingState
import com.whithin.voice.util.OutgoingCallRingtone

data class VoiceRoomUiState(
    val isConnected: Boolean = false,
    val isJoining: Boolean = false,
    val isMinimized: Boolean = false,
    val sessionRoomId: String = "",
    val sessionUserId: String = "",
    val sessionUserName: String = "",
    val sessionReturnTo: String = "",
    val roomName: String = "",
    val userName: String = "",
    val isMuted: Boolean = false,
    val isVideoEnabled: Boolean = false,
    val isScreenSharing: Boolean = false,
    val isAudioEnabled: Boolean = true,
    val isSpeakerMode: Boolean = true, // true = speaker, false = earpiece
    val isNoiseSuppressed: Boolean = false,
    val audioOutputDevices: List<AudioOutputDevice> = emptyList(),
    val selectedAudioOutputId: String = LiveKitService.ID_SPEAKER,
    val localAvatarUrl: String? = null,
    val localAvatarColor: String = "#5865f2",
    val localBannerUrl: String? = null,
    val localNameplate: String? = null,
    val localAvatarDecoration: String? = null,
    val localIsSpeaking: Boolean = false,
    val participants: List<Participant> = emptyList(),
    val gridRefreshTick: Int = 0,
    val error: String? = null
)

@HiltViewModel
class VoiceRoomViewModel @Inject constructor(
    private val repository: VoiceRepository,
    private val liveKitService: LiveKitService,
    private val voiceSocketService: VoiceSocketService,
    private val authRepository: AuthRepository,
    private val chatRepository: ChatRepository,
    private val notificationHub: NotificationHub,
    private val serverHub: ServerHub,
) : ViewModel() {
    private data class ParticipantVisuals(
        val avatar: String?,
        val avatarColor: String?,
        val banner: String?,
        val nameplate: String? = null,
        val avatarDecoration: String? = null,
    )
    
    private val _uiState = MutableStateFlow(VoiceRoomUiState())
    val uiState: StateFlow<VoiceRoomUiState> = _uiState.asStateFlow()
    
    private val participantsMap = mutableMapOf<String, Participant>()
    private val participantMetaByUserId = mutableMapOf<String, VoiceChannelParticipant>()
    private val profileRequestedUserIds = mutableSetOf<String>()
    private val profileVisualsByUserId = mutableMapOf<String, ParticipantVisuals>()
    private var currentRoomId: String? = null
    private var currentUserId: String? = null
    private var isLeavingRoom: Boolean = false
    private var socketSyncRoomId: String? = null
    private var socketSyncUserId: String? = null
    private var lastEmittedSpeaking: Boolean? = null

    private val speakingStateChangedListener: (String?, String?, Boolean) -> Unit =
        { _, eventUserId, speaking ->
            val targetUserId = eventUserId
            val localUserId = currentUserId
            if (
                !targetUserId.isNullOrBlank() &&
                (localUserId == null || targetUserId != localUserId)
            ) {
                participantsMap[targetUserId]?.let { current ->
                    val effectiveSpeaking = speaking && !current.isMuted
                    if (current.isSpeaking != effectiveSpeaking) {
                        participantsMap[targetUserId] = current.copy(isSpeaking = effectiveSpeaking)
                        updateParticipantsList()
                    }
                }
            }
        }

    private val voiceChannelParticipantsListener: (String, List<VoiceChannelParticipant>) -> Unit =
        { channelId, participants ->
            handleVoiceChannelParticipantsUpdate(channelId, participants)
        }

    private val voiceChannelUserLeftListener: (String, String) -> Unit = { channelId, leftUserId ->
        val roomId = socketSyncRoomId
        if (roomId != null && channelId == roomId && participantsMap.remove(leftUserId) != null) {
            participantMetaByUserId.remove(leftUserId)
            updateParticipantsList()
        }
    }
    
    init {
        viewModelScope.launch {
            merge(
                notificationHub.profileUpdatedEvents,
                serverHub.memberProfileUpdatedEvents,
            ).collect { update ->
                applyProfileRealtimeUpdate(update)
            }
        }
        // Observe LiveKit service states
        viewModelScope.launch {
            liveKitService.isConnected.collect { isConnected ->
                _uiState.update { it.copy(isConnected = isConnected) }
            }
        }
        
        viewModelScope.launch {
            liveKitService.isMuted.collect { isMuted ->
                _uiState.update {
                    it.copy(
                        isMuted = isMuted,
                        localIsSpeaking = if (isMuted) false else it.localIsSpeaking,
                    )
                }
                if (isMuted) {
                    liveKitService.resetLocalVad()
                }
            }
        }

        viewModelScope.launch {
            liveKitService.localIsSpeaking.collect { speaking ->
                applyLocalSpeaking(speaking)
            }
        }
        
        viewModelScope.launch {
            liveKitService.isVideoEnabled.collect { isVideoEnabled ->
                _uiState.update { it.copy(isVideoEnabled = isVideoEnabled) }
                bumpGridRefresh()
            }
        }
        
        viewModelScope.launch {
            liveKitService.isScreenSharing.collect { isScreenSharing ->
                _uiState.update { it.copy(isScreenSharing = isScreenSharing) }
                bumpGridRefresh()
            }
        }
        
        viewModelScope.launch {
            liveKitService.isSpeakerMode.collect { isSpeakerMode ->
                _uiState.update { it.copy(isSpeakerMode = isSpeakerMode) }
            }
        }

        viewModelScope.launch {
            liveKitService.audioOutputDevices.collect { devices ->
                _uiState.update { it.copy(audioOutputDevices = devices) }
            }
        }

        viewModelScope.launch {
            liveKitService.selectedAudioOutputId.collect { deviceId ->
                _uiState.update { it.copy(selectedAudioOutputId = deviceId) }
            }
        }

        viewModelScope.launch {
            liveKitService.isNoiseSuppressed.collect { isNoiseSuppressed ->
                _uiState.update { it.copy(isNoiseSuppressed = isNoiseSuppressed) }
            }
        }
        
        // Room listeners will be setup after connection in joinRoom()
    }
    
    private var eventListenerJob: kotlinx.coroutines.Job? = null
    private var participantPollingJob: kotlinx.coroutines.Job? = null
    
    private fun setupRoomEventListeners(room: Room) {
        // Cancel previous listener if exists
        eventListenerJob?.cancel()
        
        eventListenerJob = viewModelScope.launch {
            try {
                Log.d("VoiceRoomViewModel", "Starting to collect room events")
                Log.d("VoiceRoomViewModel", "Room events type: ${room.events::class.simpleName}")
                
                // BroadcastEventBus implements EventListenable which has collect extension function
                // This is the proper way to collect events from BroadcastEventBus
                room.events.collect { event ->
                    Log.d("VoiceRoomViewModel", "Received room event: ${event::class.simpleName}")
                    when (event) {
                        is RoomEvent.ParticipantConnected -> {
                            val participant = event.participant as? RemoteParticipant
                            participant?.let { remoteParticipant ->
                                val identity = remoteParticipant.identity?.value
                                Log.d("VoiceRoomViewModel", "ParticipantConnected - identity: $identity")
                                
                                if (identity != null) {
                                    // Add participant immediately
                                    addParticipant(remoteParticipant)
                                    
                                    // Explicitly subscribe to all audio and video tracks of the new participant
                                    // This ensures all existing participants can see/hear the new participant
                                    // LiveKit automatically subscribes to tracks by default (autoSubscribe = true)
                                    // Tracks will be available via TrackSubscribed events
                                    Log.d("VoiceRoomViewModel", "New participant connected, tracks will auto-subscribe")
                                } else {
                                    Log.w("VoiceRoomViewModel", "ParticipantConnected - identity is null, skipping")
                                }
                            }
                        }
                        is RoomEvent.ParticipantDisconnected -> {
                            val identity = event.participant.identity?.value ?: return@collect
                            removeParticipant(identity)
                        }
                        is RoomEvent.TrackPublished -> {
                            val participant = event.participant as? RemoteParticipant
                            val publication = event.publication
                            val identity = participant?.identity?.value
                            
                            Log.d("VoiceRoomViewModel", "TrackPublished - participant: $identity, kind: ${publication.kind}, sid: ${publication.sid}")
                            
                            if (publication.kind == Track.Kind.VIDEO) {
                                bumpGridRefresh()
                            }
                        }
                        is RoomEvent.TrackSubscribed -> {
                            val participant = event.participant as? RemoteParticipant
                            val identity = participant?.identity?.value ?: return@collect
                            if (event.track.kind == Track.Kind.AUDIO) {
                                val uiMuted =
                                    participantsMap[identity]?.isMuted
                                        ?: participant?.let {
                                            VoiceCallTrackResolver.isRemoteMicrophoneMuted(it)
                                        }
                                        ?: false
                                liveKitService.setRemoteMicMuteState(
                                    identity,
                                    uiMuted,
                                    "track-subscribed",
                                )
                                VoiceMuteLogger.d(
                                    "TrackSubscribed audio identity=$identity uiMuted=$uiMuted " +
                                        "publicationMuted=${event.publication.muted} source=${event.publication.source}",
                                )
                                liveKitService.applyPlaybackToAudioTrack(
                                    event.track,
                                    event.publication,
                                    identity,
                                )
                                participant?.let { liveKitService.syncRemoteParticipantPlayback(it) }
                            } else if (
                                event.track.kind == Track.Kind.VIDEO &&
                                event.publication.source == Track.Source.CAMERA
                            ) {
                                updateParticipantTrack(identity, isVideo = true, hasTrack = true)
                            }
                            if (event.track.kind == Track.Kind.VIDEO) {
                                bumpGridRefresh()
                            }
                        }
                        is RoomEvent.TrackUnsubscribed -> {
                            val participant = event.participant as? RemoteParticipant
                            val identity = participant?.identity?.value ?: return@collect
                            if (event.track.kind == Track.Kind.AUDIO) {
                                liveKitService.detachRemoteVad(identity)
                            } else if (
                                event.track.kind == Track.Kind.VIDEO &&
                                event.publications.source == Track.Source.CAMERA
                            ) {
                                updateParticipantTrack(identity, isVideo = true, hasTrack = false)
                            }
                            if (event.track.kind == Track.Kind.VIDEO) {
                                bumpGridRefresh()
                            }
                        }
                        is RoomEvent.TrackUnpublished -> {
                            if (event.publication.kind == Track.Kind.VIDEO) {
                                bumpGridRefresh()
                            }
                        }
                        is RoomEvent.TrackMuted -> {
                            val participant = event.participant as? RemoteParticipant
                            val identity = participant?.identity?.value
                            val publication = event.publication

                            VoiceMuteLogger.d(
                                "TrackMuted identity=$identity kind=${publication.kind} " +
                                    "source=${publication.source} publicationMuted=${publication.muted} " +
                                    "isMic=${VoiceCallTrackResolver.isParticipantMicrophonePublication(publication)}",
                            )

                            if (identity != null && VoiceCallTrackResolver.isParticipantMicrophonePublication(publication)) {
                                participantsMap[identity]?.let { participantModel ->
                                    val updated = participantModel.copy(isMuted = true, isSpeaking = false)
                                    participantsMap[identity] = updated
                                    updateParticipantsList()
                                } ?: run {
                                    participant?.let { addParticipant(it) }
                                }
                                applyRemoteMicMuteState(identity, muted = true, reason = "livekit-track-muted")
                            }
                        }
                        is RoomEvent.TrackUnmuted -> {
                            val participant = event.participant as? RemoteParticipant
                            val identity = participant?.identity?.value
                            val publication = event.publication

                            VoiceMuteLogger.d(
                                "TrackUnmuted identity=$identity kind=${publication.kind} " +
                                    "source=${publication.source} publicationMuted=${publication.muted} " +
                                    "isMic=${VoiceCallTrackResolver.isParticipantMicrophonePublication(publication)}",
                            )

                            if (identity != null && VoiceCallTrackResolver.isParticipantMicrophonePublication(publication)) {
                                participantsMap[identity]?.let { participantModel ->
                                    val updated = participantModel.copy(isMuted = false)
                                    participantsMap[identity] = updated
                                    updateParticipantsList()
                                } ?: run {
                                    participant?.let { addParticipant(it) }
                                }
                                applyRemoteMicMuteState(identity, muted = false, reason = "livekit-track-unmuted")
                            }
                        }
                        is RoomEvent.ActiveSpeakersChanged -> {
                            // Per-participant isSpeaking flows handle UI updates faster.
                        }
                        is RoomEvent.Disconnected -> {
                            Log.w(
                                "VoiceRoomViewModel",
                                "Room disconnected by server (${event.reason}), leaving local call UI",
                            )
                            leaveRoom(skipCallSignaling = true)
                        }
                        else -> {}
                    }
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                Log.d("VoiceRoomViewModel", "Event collection cancelled")
                throw e
            } catch (e: Exception) {
                // Handle error, but don't crash
                Log.e("VoiceRoomViewModel", "Error in room event listener", e)
            }
        }
    }
    
    fun joinRoom(
        roomId: String,
        userName: String,
        userId: String,
        displayName: String = roomId,
        avatar: String? = null,
        avatarColor: String? = null,
        banner: String? = null,
        returnTo: String = "",
    ) {
        viewModelScope.launch {
            if (currentRoomId == roomId) {
                if (_uiState.value.isConnected) {
                    _uiState.update {
                        it.copy(
                            isMinimized = false,
                            sessionRoomId = roomId,
                            sessionUserId = userId,
                            sessionUserName = userName.ifBlank { it.sessionUserName },
                            sessionReturnTo = returnTo.ifBlank { it.sessionReturnTo },
                            userName = userName.ifBlank { it.userName },
                            localAvatarUrl = avatar ?: it.localAvatarUrl,
                            localAvatarColor = avatarColor ?: it.localAvatarColor,
                            localBannerUrl = banner ?: it.localBannerUrl,
                            localNameplate = it.localNameplate,
                            localAvatarDecoration = it.localAvatarDecoration,
                        )
                    }
                    return@launch
                }
                if (_uiState.value.isJoining) {
                    Log.d("VoiceRoomViewModel", "Already joining room $roomId, skipping duplicate join")
                    return@launch
                }
            }

            currentRoomId = roomId
            currentUserId = userId
            isLeavingRoom = false
            profileRequestedUserIds.remove(userId)

            val localVisuals = resolveLocalJoinVisuals(userId, avatar, avatarColor, banner)

            _uiState.update { 
                it.copy(
                    isJoining = true,
                    isMinimized = false,
                    sessionRoomId = roomId,
                    sessionUserId = userId,
                    sessionUserName = userName,
                    sessionReturnTo = returnTo,
                    roomName = displayName,
                    userName = userName,
                    localAvatarUrl = localVisuals.avatar,
                    localAvatarColor = localVisuals.avatarColor ?: it.localAvatarColor,
                    localBannerUrl = localVisuals.banner,
                    localNameplate = localVisuals.nameplate,
                    localAvatarDecoration = localVisuals.avatarDecoration,
                    localIsSpeaking = false,
                    error = null
                )
            }
            
            try {
                val tokenResponse =
                    repository.getToken(
                        roomId,
                        userName,
                        userId,
                        localVisuals.avatar,
                        localVisuals.avatarColor,
                        localVisuals.banner,
                        localVisuals.nameplate,
                    )
                setupSocketSync(roomId, userId)
                requestParticipantVisuals(userId)
                liveKitService.connect(tokenResponse.url, tokenResponse.token, displayName)
                voiceSocketService.emitMuteState(false)

                // Wait a bit for connection to fully establish
                kotlinx.coroutines.delay(200)
                
                // Setup listeners after connection
                liveKitService.getRoom()?.let { room ->
                    Log.d("VoiceRoomViewModel", "Setting up room listeners, existing participants: ${room.remoteParticipants.size}")
                    
                    // Setup event listeners FIRST to catch participants that connect during setup
                    setupRoomEventListeners(room)
                    
                    // Add existing participants AFTER setting up listeners
                    // This ensures we catch both existing and new participants
                    room.remoteParticipants.values.forEach { participant ->
                        if (participant is RemoteParticipant) {
                            val identity = participant.identity?.value
                            Log.d("VoiceRoomViewModel", "Found existing participant: $identity")
                            if (identity != null && !participantsMap.containsKey(identity)) {
                                addParticipant(participant)
                                // Explicitly subscribe to all audio and video tracks of existing participants
                                // This ensures new participants can see/hear all existing participants
                                // LiveKit automatically subscribes to tracks by default
                                // Tracks will be available via TrackSubscribed events
                                Log.d("VoiceRoomViewModel", "Existing participant found, tracks will auto-subscribe")
                            }
                        }
                    }
                    
                    liveKitService.applyRemoteAudioPlaybackState()
                    liveKitService.onRemoteSpeakingChange = { userId, speaking ->
                        applyParticipantSpeaking(userId, speaking, isLocal = false)
                    }
                    room.remoteParticipants.values.forEach { participant ->
                        val identity = participant.identity?.value ?: return@forEach
                        participant.audioTrackPublications.forEach { (publication, track) ->
                            track?.let { liveKitService.attachRemoteVad(identity, it, publication) }
                        }
                    }

                    // Start periodic check for new participants (fallback if events don't work)
                    startParticipantPolling(room)
                }
                
                _uiState.update { 
                    it.copy(
                        isJoining = false,
                        isConnected = true
                    )
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isJoining = false,
                        error = e.message ?: "Failed to join room"
                    )
                }
            }
        }
    }
    
    fun minimizeCall() {
        val state = _uiState.value
        if (!state.isConnected && !state.isJoining) return
        _uiState.update { it.copy(isMinimized = true) }
    }

    fun expandCall() {
        _uiState.update { it.copy(isMinimized = false) }
    }

    fun leaveRoom(skipCallSignaling: Boolean = false) {
        if (isLeavingRoom) return
        isLeavingRoom = true

        viewModelScope.launch {
            val roomIdToLeave = currentRoomId
            val session = ChatCallSignalingState.session.value
            val signalingChatId = session.chatId.ifBlank { roomIdToLeave.orEmpty() }

            if (!skipCallSignaling && signalingChatId.isNotBlank()) {
                if (session.isAnswered && session.callAnsweredAt != null) {
                    chatRepository.endCall(
                        signalingChatId,
                        ChatCallSignalingState.hangupDurationSeconds() ?: 1,
                    )
                } else if (session.withRinging) {
                    chatRepository.cancelOutgoingCall(signalingChatId)
                }
            }
            ChatCallSignalingState.clear()
            OutgoingCallRingtone.stop()

            currentRoomId = null
            roomIdToLeave?.let { voiceSocketService.unsubscribeFromChannel(it) }

            // Cancel event listener
            eventListenerJob?.cancel()
            eventListenerJob = null
            
            // Cancel polling
            participantPollingJob?.cancel()
            participantPollingJob = null

            try {
                roomIdToLeave?.let { repository.leaveRoom(it) }
                roomIdToLeave?.let { voiceSocketService.requestChannelParticipants(it) }
            } catch (e: Exception) {
                Log.e("VoiceRoomViewModel", "Error while leaving socket room", e)
            }

            try {
                liveKitService.disconnect()
            } finally {
                clearSpeakingObservers()
                participantsMap.clear()
                participantMetaByUserId.clear()
                profileRequestedUserIds.clear()
                profileVisualsByUserId.clear()
                clearSocketSyncCallbacks()
                _uiState.update {
                    VoiceRoomUiState()
                }
                currentUserId = null
                isLeavingRoom = false
            }
        }
    }
    
    private fun startParticipantPolling(room: Room) {
        // Cancel previous polling if exists
        participantPollingJob?.cancel()
        
        participantPollingJob = viewModelScope.launch {
            while (true) {
                kotlinx.coroutines.delay(1000) // Check every second
                
                try {
                    val currentParticipants = room.remoteParticipants.values
                        .filterIsInstance<RemoteParticipant>()
                        .mapNotNull { it.identity?.value }
                    
                    Log.d("VoiceRoomViewModel", "Polling: Found ${currentParticipants.size} remote participants: $currentParticipants")
                    Log.d("VoiceRoomViewModel", "Polling: Current map has ${participantsMap.size} participants: ${participantsMap.keys}")
                    
                    // Check for new participants
                    currentParticipants.forEach { identity ->
                        if (!participantsMap.containsKey(identity)) {
                            Log.d("VoiceRoomViewModel", "Polling: Found new participant not in map: $identity")
                            room.remoteParticipants.values
                                .filterIsInstance<RemoteParticipant>()
                                .find { it.identity?.value == identity }
                                ?.let { participant ->
                                    Log.d("VoiceRoomViewModel", "Polling: Adding participant: $identity")
                                    addParticipant(participant)
                                    
                                    // LiveKit automatically subscribes to tracks by default
                                    // Tracks will be available via TrackSubscribed events
                                    Log.d("VoiceRoomViewModel", "Polling: Found participant $identity, tracks will auto-subscribe")
                                }
                        }
                    }
                    
                    // LiveKit mute=true only — never unmute from polling (socket/TrackUnmuted are authoritative).
                    currentParticipants.forEach { identity ->
                        room.remoteParticipants.values
                            .filterIsInstance<RemoteParticipant>()
                            .find { it.identity?.value == identity }
                            ?.let { participant ->
                                val liveKitMuted =
                                    VoiceCallTrackResolver.isRemoteMicrophoneMuted(participant)
                                if (!liveKitMuted) return@let
                                participantsMap[identity]?.let { participantModel ->
                                    if (!participantModel.isMuted) {
                                        VoiceMuteLogger.d(
                                            "Polling livekit mute identity=$identity (socket/ui was unmuted)",
                                        )
                                        val updated =
                                            participantModel.copy(isMuted = true, isSpeaking = false)
                                        participantsMap[identity] = updated
                                        updateParticipantsList()
                                        applyRemoteMicMuteState(
                                            identity,
                                            muted = true,
                                            reason = "polling-livekit-muted",
                                        )
                                    }
                                }
                            }
                    }
                    
                    // Check for disconnected participants
                    val disconnectedParticipants = participantsMap.keys.filter { it !in currentParticipants }
                    disconnectedParticipants.forEach { identity ->
                        Log.d("VoiceRoomViewModel", "Polling: Removing disconnected participant: $identity")
                        removeParticipant(identity)
                    }
                } catch (e: Exception) {
                    Log.e("VoiceRoomViewModel", "Error in participant polling", e)
                }
            }
        }
    }
    
    fun toggleMute() {
        viewModelScope.launch {
            liveKitService.toggleMute()
            val isMuted = liveKitService.getRoom()?.localParticipant?.isMicrophoneEnabled()?.not()
                ?: _uiState.value.isMuted
            voiceSocketService.emitMuteState(isMuted)
            if (isMuted) {
                liveKitService.resetLocalVad()
                _uiState.update { it.copy(localIsSpeaking = false) }
                lastEmittedSpeaking = false
                voiceSocketService.emitSpeaking(false)
            }
        }
    }
    
    fun toggleVideo() {
        viewModelScope.launch {
            liveKitService.toggleCamera()
        }
    }
    
    fun enableScreenShare(mediaProjectionIntent: Intent) {
        viewModelScope.launch {
            liveKitService.enableScreenShare(mediaProjectionIntent)
            bumpGridRefresh()
        }
    }

    fun disableScreenShare() {
        viewModelScope.launch {
            liveKitService.disableScreenShare()
            bumpGridRefresh()
        }
    }
    
    fun toggleAudio() {
        val newEnabled = !_uiState.value.isAudioEnabled
        _uiState.update { it.copy(isAudioEnabled = newEnabled) }
        liveKitService.setRemoteAudioEnabled(newEnabled)
        voiceSocketService.emitAudioState(
            isEnabled = newEnabled,
            isGlobalAudioMuted = !newEnabled,
            userId = currentUserId
        )
    }
    
    fun toggleSpeakerMode() {
        liveKitService.toggleSpeakerMode()
    }

    fun setNoiseSuppression(enabled: Boolean) {
        viewModelScope.launch {
            liveKitService.setNoiseSuppressionEnabled(enabled)
        }
    }

    fun refreshAudioOutputDevices() {
        liveKitService.refreshAudioOutputDevices()
    }

    fun selectAudioOutput(device: AudioOutputDevice) {
        liveKitService.selectAudioOutput(device.id)
    }
    
    fun getRoom() = liveKitService.getRoom()
    
    private fun addParticipant(participant: RemoteParticipant) {
        val identity = participant.identity?.value ?: return
        val meta = participantMetaByUserId[identity]
        
        Log.d("VoiceRoomViewModel", "addParticipant - identity: $identity, current map size: ${participantsMap.size}")
        
        // Determine initial mute state:
        // - If isMicrophoneEnabled() returns false, participant is muted
        // - Otherwise, default to unmuted (microphone is enabled by default)
        // We'll update this state when TrackMuted/TrackUnmuted events fire
        val isMuted = VoiceCallTrackResolver.isRemoteMicrophoneMuted(participant)
        
        // Check if participant already exists to avoid duplicates
        if (participantsMap.containsKey(identity)) {
            // Update existing participant
            participantsMap[identity] = participantsMap[identity]!!.copy(
                name = participant.name ?: meta?.userName ?: identity,
                isMuted = isMuted,
                hasVideo = participantHasCameraVideo(participant),
                hasAudio = participant.audioTrackPublications.isNotEmpty(),
                isGlobalAudioMuted = meta?.isAudioDisabled ?: participantsMap[identity]!!.isGlobalAudioMuted,
                avatarUrl = meta?.avatar ?: participantsMap[identity]!!.avatarUrl,
                avatarColor = meta?.avatarColor ?: participantsMap[identity]!!.avatarColor,
                bannerUrl = meta?.banner ?: participantsMap[identity]!!.bannerUrl,
                nameplate = meta?.nameplate ?: participantsMap[identity]!!.nameplate,
                avatarDecoration = meta?.avatarDecoration ?: participantsMap[identity]!!.avatarDecoration,
            )
            Log.d("VoiceRoomViewModel", "Updated existing participant: $identity, isMuted: $isMuted")
        } else {
            // Add new participant
            val participantModel = Participant(
                identity = identity,
                name = participant.name ?: meta?.userName ?: identity,
                isMuted = isMuted,
                hasVideo = participantHasCameraVideo(participant),
                hasAudio = participant.audioTrackPublications.isNotEmpty(),
                isGlobalAudioMuted = meta?.isAudioDisabled ?: false,
                avatarUrl = meta?.avatar,
                avatarColor = meta?.avatarColor ?: "#5865f2",
                bannerUrl = meta?.banner,
                nameplate = meta?.nameplate,
                avatarDecoration = meta?.avatarDecoration,
            )
            participantsMap[identity] = participantModel
            Log.d("VoiceRoomViewModel", "Added new participant: $identity, isMuted: $isMuted, new map size: ${participantsMap.size}")
        }
        applyCachedParticipantVisuals(identity)
        updateParticipantsList()
        requestParticipantVisuals(identity)
        liveKitService.setRemoteMicMuteState(identity, isMuted, "add-participant")
        participant.let { liveKitService.syncRemoteParticipantPlayback(it) }
    }
    
    private fun removeParticipant(identity: String) {
        liveKitService.detachRemoteVad(identity)
        participantsMap.remove(identity)
        updateParticipantsList()
    }
    
    private fun updateParticipantTrack(identity: String, isVideo: Boolean, hasTrack: Boolean) {
        participantsMap[identity]?.let { participant ->
            val updated = if (isVideo) {
                participant.copy(hasVideo = hasTrack)
            } else {
                participant.copy(hasAudio = hasTrack)
            }
            participantsMap[identity] = updated
            updateParticipantsList()
        } ?: run {
            // If participant not found, try to get it from room and add it
            liveKitService.getRoom()?.remoteParticipants?.values?.find {
                it.identity?.value == identity
            }?.let { remoteParticipant ->
                if (remoteParticipant is RemoteParticipant) {
                    addParticipant(remoteParticipant)
                }
            }
        }
    }
    
    private fun updateParticipantsList() {
        val participantsList = participantsMap.values.toList()
        _uiState.update { currentState ->
            currentState.copy(participants = participantsList)
        }
    }

    private fun bumpGridRefresh() {
        _uiState.update { it.copy(gridRefreshTick = it.gridRefreshTick + 1) }
    }

    private fun syncRemoteParticipantPlaybackById(identity: String) {
        val remote =
            liveKitService.getRoom()
                ?.remoteParticipants
                ?.values
                ?.find { it.identity?.value == identity }
                ?: run {
                    VoiceMuteLogger.d("syncRemoteParticipantPlaybackById identity=$identity remote=missing")
                    return
                }
        liveKitService.syncRemoteParticipantPlayback(remote)
    }

    private fun applyRemoteMicMuteState(identity: String, muted: Boolean, reason: String) {
        VoiceMuteLogger.d(
            "applyRemoteMicMuteState identity=$identity muted=$muted reason=$reason " +
                "uiWas=${participantsMap[identity]?.isMuted}",
        )
        liveKitService.setRemoteMicMuteState(identity, muted, reason)
        syncRemoteParticipantPlaybackById(identity)
    }

    private fun participantHasCameraVideo(participant: RemoteParticipant): Boolean {
        return participant.isCameraEnabled() &&
            participant.getTrackPublication(Track.Source.CAMERA)?.track != null
    }

    private fun requestParticipantVisuals(userId: String) {
        if (userId.isBlank()) return
        if (!profileRequestedUserIds.add(userId)) return
        viewModelScope.launch {
            val profile = authRepository.getUserProfileVisuals(userId)
            if (profile == null) {
                // Allow retry on next participant/sync update if request failed.
                profileRequestedUserIds.remove(userId)
                return@launch
            }
            val avatar = profile.avatar?.takeIf { it.isNotBlank() }
            val avatarColor = profile.avatarColor?.takeIf { it.isNotBlank() }
            val banner = profile.banner?.takeIf { it.isNotBlank() }
            val nameplate = profile.nameplate?.takeIf { it.isNotBlank() }
            val avatarDecoration = profile.avatarDecoration?.takeIf { it.isNotBlank() }

            profileVisualsByUserId[userId] = ParticipantVisuals(
                avatar = avatar,
                avatarColor = avatarColor,
                banner = banner,
                nameplate = nameplate,
                avatarDecoration = avatarDecoration,
            )
            applyCachedParticipantVisuals(userId)
            updateParticipantsList()
        }
    }

    private fun applyCachedParticipantVisuals(userId: String) {
        val visuals = profileVisualsByUserId[userId] ?: return
        participantsMap[userId]?.let { current ->
            participantsMap[userId] = current.copy(
                avatarUrl = visuals.avatar ?: current.avatarUrl,
                avatarColor = visuals.avatarColor ?: current.avatarColor,
                bannerUrl = visuals.banner ?: current.bannerUrl,
                nameplate = visuals.nameplate ?: current.nameplate,
                avatarDecoration = visuals.avatarDecoration ?: current.avatarDecoration,
            )
            Log.d(
                "VoiceRoomViewModel",
                "Applied profile visuals userId=$userId avatar=${visuals.avatar ?: current.avatarUrl} banner=${visuals.banner ?: current.bannerUrl}"
            )
        }

        if (userId == currentUserId) {
            _uiState.update {
                it.copy(
                    localAvatarUrl = visuals.avatar ?: it.localAvatarUrl,
                    localAvatarColor = visuals.avatarColor ?: it.localAvatarColor,
                    localBannerUrl = visuals.banner ?: it.localBannerUrl,
                    localNameplate = visuals.nameplate ?: it.localNameplate,
                    localAvatarDecoration = visuals.avatarDecoration ?: it.localAvatarDecoration,
                )
            }
        }
    }

    private fun handleVoiceChannelParticipantsUpdate(
        channelId: String,
        participants: List<VoiceChannelParticipant>,
    ) {
        val roomId = socketSyncRoomId ?: return
        val userId = socketSyncUserId ?: return
        if (channelId.trim() != roomId) return
        val serverUserIds = participants.map { it.userId }.toSet()
        participantsMap.keys
            .filter { it !in serverUserIds }
            .forEach { staleId ->
                participantsMap.remove(staleId)
                participantMetaByUserId.remove(staleId)
            }
        participants.forEach { participant ->
            participantMetaByUserId[participant.userId] = participant
            if (participant.userId == userId) {
                _uiState.update {
                    it.copy(
                        userName = participant.userName.ifBlank { it.userName },
                        localAvatarUrl = participant.avatar ?: it.localAvatarUrl,
                        localAvatarColor = participant.avatarColor.ifBlank { it.localAvatarColor },
                        localBannerUrl = participant.banner ?: it.localBannerUrl,
                        localNameplate = participant.nameplate ?: it.localNameplate,
                        localAvatarDecoration = participant.avatarDecoration ?: it.localAvatarDecoration,
                    )
                }
            }
            if (participant.userId != userId) {
                val previousMuted = participantsMap[participant.userId]?.isMuted
                participantsMap[participant.userId]?.let { current ->
                    participantsMap[participant.userId] =
                        current.copy(
                            name = participant.userName.ifBlank { current.name },
                            isMuted = participant.isMuted,
                            isSpeaking = if (participant.isMuted) false else current.isSpeaking,
                            isGlobalAudioMuted = participant.isAudioDisabled || participant.isDeafened,
                            avatarUrl = participant.avatar ?: current.avatarUrl,
                            avatarColor = participant.avatarColor,
                            bannerUrl = participant.banner ?: current.bannerUrl,
                            nameplate = participant.nameplate ?: current.nameplate,
                            avatarDecoration = participant.avatarDecoration ?: current.avatarDecoration,
                        )
                }
                if (previousMuted != null && previousMuted != participant.isMuted) {
                    VoiceMuteLogger.d(
                        "ChannelParticipants mute changed userId=${participant.userId} " +
                            "$previousMuted -> ${participant.isMuted}",
                    )
                    applyRemoteMicMuteState(
                        participant.userId,
                        muted = participant.isMuted,
                        reason = "channel-participants",
                    )
                }
            }
            requestParticipantVisuals(participant.userId)
        }
        updateParticipantsList()
    }

    private fun setupSocketSync(roomId: String, userId: String) {
        socketSyncRoomId = roomId
        socketSyncUserId = userId
        voiceSocketService.addVoiceChannelParticipantsListener(voiceChannelParticipantsListener)
        voiceSocketService.addVoiceChannelUserLeftListener(voiceChannelUserLeftListener)
        voiceSocketService.addSpeakingStateChangedListener(speakingStateChangedListener)

        voiceSocketService.setOnPeerMuteStateChanged { _, eventUserId, isMuted ->
            val targetUserId = eventUserId ?: return@setOnPeerMuteStateChanged
            if (targetUserId == userId) return@setOnPeerMuteStateChanged
            VoiceMuteLogger.d("Socket peerMute userId=$targetUserId muted=$isMuted")
            participantsMap[targetUserId]?.let { current ->
                participantsMap[targetUserId] =
                    current.copy(
                        isMuted = isMuted,
                        isSpeaking = if (isMuted) false else current.isSpeaking,
                    )
                updateParticipantsList()
            }
            applyRemoteMicMuteState(targetUserId, muted = isMuted, reason = "socket-peer-mute")
        }

        voiceSocketService.setOnPeerAudioStateChanged { _, eventUserId, isEnabled, isGlobalAudioMuted ->
            val targetUserId = eventUserId ?: return@setOnPeerAudioStateChanged
            if (targetUserId == userId) return@setOnPeerAudioStateChanged
            participantsMap[targetUserId]?.let { current ->
                val deafened = isGlobalAudioMuted ?: !isEnabled
                participantsMap[targetUserId] = current.copy(isGlobalAudioMuted = deafened)
                updateParticipantsList()
            }
        }

        voiceSocketService.subscribeToChannel(roomId)
        voiceSocketService.requestChannelParticipants(roomId)
    }

    private fun clearSocketSyncCallbacks() {
        voiceSocketService.removeVoiceChannelParticipantsListener(voiceChannelParticipantsListener)
        voiceSocketService.removeVoiceChannelUserLeftListener(voiceChannelUserLeftListener)
        voiceSocketService.removeSpeakingStateChangedListener(speakingStateChangedListener)
        socketSyncRoomId = null
        socketSyncUserId = null
        voiceSocketService.setOnPeerMuteStateChanged(null)
        voiceSocketService.setOnPeerAudioStateChanged(null)
    }

    private fun clearSpeakingObservers() {
        liveKitService.onRemoteSpeakingChange = null
        liveKitService.detachAllRemoteVad()
        lastEmittedSpeaking = null
    }

    private fun applyLocalSpeaking(speaking: Boolean) {
        if (currentUserId.isNullOrBlank()) return
        val effectiveSpeaking = speaking && !_uiState.value.isMuted
        if (_uiState.value.localIsSpeaking != effectiveSpeaking) {
            _uiState.update { it.copy(localIsSpeaking = effectiveSpeaking) }
        }
        emitSpeakingImmediate(effectiveSpeaking)
    }

    private fun applyParticipantSpeaking(identity: String, speaking: Boolean, isLocal: Boolean) {
        if (isLocal) {
            applyLocalSpeaking(speaking)
            return
        }

        participantsMap[identity]?.let { current ->
            val effectiveSpeaking = speaking && !current.isMuted
            if (current.isSpeaking != effectiveSpeaking) {
                participantsMap[identity] = current.copy(isSpeaking = effectiveSpeaking)
                updateParticipantsList()
            }
        }
    }

    private fun emitSpeakingImmediate(speaking: Boolean) {
        if (_uiState.value.isMuted && speaking) return
        if (lastEmittedSpeaking == speaking) return
        lastEmittedSpeaking = speaking
        voiceSocketService.emitSpeaking(speaking)
    }

    private fun applyProfileRealtimeUpdate(update: ProfileRealtimeUpdate) {
        val targetUserId = update.userId.trim()
        if (targetUserId.isBlank()) return

        participantMetaByUserId[targetUserId]?.let { meta ->
            participantMetaByUserId[targetUserId] = meta.applyProfileUpdate(update)
        }

        participantsMap[targetUserId]?.let { current ->
            participantsMap[targetUserId] =
                current.copy(
                    name = update.displayName ?: update.username ?: current.name,
                    avatarUrl = update.avatar ?: current.avatarUrl,
                    avatarColor = update.avatarColor ?: current.avatarColor,
                    bannerUrl = update.banner ?: current.bannerUrl,
                    nameplate = update.nameplate ?: current.nameplate,
                    avatarDecoration = update.avatarDecoration ?: current.avatarDecoration,
                )
            updateParticipantsList()
        }

        val cached =
            profileVisualsByUserId[targetUserId]
                ?: ParticipantVisuals(null, null, null, null, null)
        profileVisualsByUserId[targetUserId] =
            cached.copy(
                avatar = update.avatar ?: cached.avatar,
                avatarColor = update.avatarColor ?: cached.avatarColor,
                banner = update.banner ?: cached.banner,
                nameplate = update.nameplate ?: cached.nameplate,
                avatarDecoration = update.avatarDecoration ?: cached.avatarDecoration,
            )
        applyCachedParticipantVisuals(targetUserId)

        if (targetUserId == currentUserId) {
            _uiState.update {
                it.copy(
                    userName = update.displayName ?: update.username ?: it.userName,
                    localAvatarUrl = update.avatar ?: it.localAvatarUrl,
                    localAvatarColor = update.avatarColor ?: it.localAvatarColor,
                    localBannerUrl = update.banner ?: it.localBannerUrl,
                    localNameplate = update.nameplate ?: it.localNameplate,
                    localAvatarDecoration = update.avatarDecoration ?: it.localAvatarDecoration,
                )
            }
        }
    }

    private suspend fun resolveLocalJoinVisuals(
        userId: String,
        avatar: String?,
        avatarColor: String?,
        banner: String?,
    ): ParticipantVisuals {
        val profile = authRepository.getUserProfileVisuals(userId)
        val resolved =
            ParticipantVisuals(
                avatar = avatar?.takeIf { it.isNotBlank() } ?: profile?.avatar?.takeIf { it.isNotBlank() },
                avatarColor = avatarColor?.takeIf { it.isNotBlank() } ?: profile?.avatarColor?.takeIf { it.isNotBlank() },
                banner = banner?.takeIf { it.isNotBlank() } ?: profile?.banner?.takeIf { it.isNotBlank() },
                nameplate = profile?.nameplate?.takeIf { it.isNotBlank() },
                avatarDecoration = profile?.avatarDecoration?.takeIf { it.isNotBlank() },
            )
        if (
            resolved.avatar != null ||
            resolved.avatarColor != null ||
            resolved.banner != null ||
            resolved.nameplate != null ||
            resolved.avatarDecoration != null
        ) {
            profileVisualsByUserId[userId] = resolved
        }
        return resolved
    }
}
