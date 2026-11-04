package com.whithin.voice.data.repository

import android.util.Log
import com.whithin.voice.data.model.VoiceChannelParticipant
import com.whithin.voice.data.model.patchProfileUpdate
import com.whithin.voice.data.signalr.NotificationHub
import com.whithin.voice.data.signalr.ServerHub
import com.whithin.voice.data.socketio.VoiceSocketService
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@Singleton
class VoiceChannelPresenceService @Inject constructor(
    private val voiceSocketService: VoiceSocketService,
    private val notificationHub: NotificationHub,
    private val serverHub: ServerHub,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val watchCounts = mutableMapOf<String, Int>()
    private val _participantsByChannel =
        MutableStateFlow<Map<String, List<VoiceChannelParticipant>>>(emptyMap())

    private val participantsListener: (String, List<VoiceChannelParticipant>) -> Unit =
        { channelId, participants ->
            _participantsByChannel.update { map ->
                val previousByUserId = map[channelId].orEmpty().associateBy { it.userId }
                map +
                    (
                        channelId to
                            participants.map { incoming ->
                                val previous = previousByUserId[incoming.userId]
                                if (previous == null) {
                                    incoming
                                } else {
                                    incoming.copy(isSpeaking = previous.isSpeaking)
                                }
                            }
                        )
            }
        }

    private val joinedListener: (String, VoiceChannelParticipant) -> Unit =
        { channelId, participant ->
            _participantsByChannel.update { map ->
                val current = map[channelId].orEmpty()
                if (current.any { it.userId == participant.userId }) {
                    map
                } else {
                    map + (channelId to current + participant)
                }
            }
        }

    private val leftListener: (String, String) -> Unit = { channelId, userId ->
        _participantsByChannel.update { map ->
            map + (channelId to map[channelId].orEmpty().filter { it.userId != userId })
        }
    }

    private val stateListener: (String, String, Boolean?, Boolean?, Boolean?) -> Unit =
        { channelId, userId, isMuted, isSpeaking, isAudioDisabled ->
            _participantsByChannel.update { map ->
                val updated =
                    map[channelId].orEmpty().map { participant ->
                        if (participant.userId != userId) {
                            participant
                        } else {
                            participant.copy(
                                isMuted = isMuted ?: participant.isMuted,
                                isSpeaking = isSpeaking ?: participant.isSpeaking,
                                isAudioDisabled = isAudioDisabled ?: participant.isAudioDisabled,
                            )
                        }
                    }
                map + (channelId to updated)
            }
        }

    private val speakingStateListener: (String?, String?, Boolean) -> Unit =
        { _, userId, speaking ->
            if (!userId.isNullOrBlank()) {
                _participantsByChannel.update { map ->
                var changed = false
                val patched =
                    map.mapValues { (_, participants) ->
                        participants.map { participant ->
                            if (participant.userId != userId) {
                                participant
                            } else {
                                val effectiveSpeaking = speaking && !participant.isMuted
                                if (participant.isSpeaking == effectiveSpeaking) {
                                    participant
                                } else {
                                    changed = true
                                    participant.copy(isSpeaking = effectiveSpeaking)
                                }
                            }
                        }
                    }
                if (changed) patched else map
                }
            }
        }

    init {
        voiceSocketService.addVoiceChannelParticipantsListener(participantsListener)
        voiceSocketService.addVoiceChannelUserJoinedListener(joinedListener)
        voiceSocketService.addVoiceChannelUserLeftListener(leftListener)
        voiceSocketService.addVoiceChannelParticipantStateChangedListener(stateListener)
        voiceSocketService.addSpeakingStateChangedListener(speakingStateListener)
        scope.launch {
            merge(
                notificationHub.profileUpdatedEvents,
                serverHub.memberProfileUpdatedEvents,
            ).collect { update ->
                _participantsByChannel.update { map ->
                    map.patchProfileUpdate(update)
                }
            }
        }
    }

    val participantsByChannel: StateFlow<Map<String, List<VoiceChannelParticipant>>> =
        _participantsByChannel.asStateFlow()

    fun watchChannel(channelId: String) {
        if (channelId.isBlank()) return
        val count = watchCounts[channelId] ?: 0
        watchCounts[channelId] = count + 1
        if (count == 0) {
            scope.launch {
                val result = voiceSocketService.connect()
                if (result.isFailure) {
                    Log.w(
                        "VoiceChannelPresence",
                        "Failed to connect voice socket for channel $channelId",
                        result.exceptionOrNull(),
                    )
                }
                voiceSocketService.subscribeToChannel(channelId)
            }
        }
    }

    fun unwatchChannel(channelId: String) {
        if (channelId.isBlank()) return
        val count = watchCounts[channelId] ?: return
        if (count <= 1) {
            watchCounts.remove(channelId)
            voiceSocketService.unsubscribeFromChannel(channelId)
            _participantsByChannel.update { it - channelId }
        } else {
            watchCounts[channelId] = count - 1
        }
    }
}
