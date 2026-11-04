package com.whithin.voice.data.socketio

import android.util.Log
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.model.TokenResponse
import com.whithin.voice.data.model.VoiceChannelParticipant
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class VoiceSocketService @Inject constructor(
    private val tokenManager: TokenManager
) {
    private var socket: Socket? = null
    private var currentRoomId: String? = null
    private val subscribedChannels = mutableSetOf<String>()

    private val voiceChannelParticipantsListeners =
        mutableSetOf<(String, List<VoiceChannelParticipant>) -> Unit>()
    private val voiceChannelUserJoinedListeners =
        mutableSetOf<(String, VoiceChannelParticipant) -> Unit>()
    private val voiceChannelUserLeftListeners = mutableSetOf<(String, String) -> Unit>()
    private val voiceChannelParticipantStateChangedListeners =
        mutableSetOf<(String, String, Boolean?, Boolean?, Boolean?) -> Unit>()
    private var onPeerMuteStateChanged: ((String?, String?, Boolean) -> Unit)? = null
    private var onPeerAudioStateChanged: ((String?, String?, Boolean, Boolean?) -> Unit)? = null
    private val speakingStateChangedListeners =
        mutableSetOf<(String?, String?, Boolean) -> Unit>()
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private var activeConnectCleanup: (() -> Unit)? = null
    
    private val VOICE_SERVER_URL = "https://whithin.ru"
    
    suspend fun connect(): Result<Unit> {
        return try {
            if (socket?.connected() == true) {
                Log.d("VoiceSocketService", "Already connected")
                return Result.success(Unit)
            }
            
            disconnect()
            
            val token = tokenManager.getToken()
            val options = IO.Options().apply {
                transports = arrayOf("websocket")
                upgrade = false
                rememberUpgrade = false
                if (token != null) {
                    auth = mapOf("token" to token)
                }
            }
            
            socket = IO.socket(VOICE_SERVER_URL, options)
            
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d("VoiceSocketService", "Connected to voice server")
                _isConnected.value = true
                requestSubscribedChannelsParticipants()
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d("VoiceSocketService", "Disconnected from voice server")
                _isConnected.value = false
            }
            
            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e("VoiceSocketService", "Connection error: ${args.contentToString()}")
                _isConnected.value = false
            }

            socket?.on("voiceChannelParticipantsUpdate") { args ->
                try {
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val channelId = payload.optString("channelId")
                    if (channelId.isBlank()) return@on

                    val participants = mutableListOf<VoiceChannelParticipant>()
                    val participantsJson = payload.optJSONArray("participants")
                    if (participantsJson != null) {
                        for (i in 0 until participantsJson.length()) {
                            val item = participantsJson.optJSONObject(i) ?: continue
                            participants.add(item.toVoiceChannelParticipant())
                        }
                    }

                    voiceChannelParticipantsListeners.forEach { it(channelId, participants) }
                } catch (e: Exception) {
                    Log.e("VoiceSocketService", "Error handling voiceChannelParticipantsUpdate", e)
                }
            }

            socket?.on("userJoinedVoiceChannel") { args ->
                try {
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val channelId = payload.optString("channelId")
                    if (channelId.isBlank()) return@on
                    val participant = payload.toVoiceChannelParticipant()
                    voiceChannelUserJoinedListeners.forEach { it(channelId, participant) }
                } catch (e: Exception) {
                    Log.e("VoiceSocketService", "Error handling userJoinedVoiceChannel", e)
                }
            }

            socket?.on("userLeftVoiceChannel") { args ->
                try {
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val channelId = payload.optString("channelId")
                    val userId = payload.optString("userId")
                    if (channelId.isBlank() || userId.isBlank()) return@on
                    voiceChannelUserLeftListeners.forEach { it(channelId, userId) }
                } catch (e: Exception) {
                    Log.e("VoiceSocketService", "Error handling userLeftVoiceChannel", e)
                }
            }

            socket?.on("voiceChannelParticipantStateChanged") { args ->
                try {
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val channelId = payload.optString("channelId")
                    val userId = payload.optString("userId")
                    if (channelId.isBlank() || userId.isBlank()) return@on

                    val isMuted = if (payload.has("isMuted")) payload.optBoolean("isMuted") else null
                    val isSpeaking = if (payload.has("isSpeaking")) payload.optBoolean("isSpeaking") else null
                    val isAudioDisabled = if (payload.has("isAudioDisabled")) payload.optBoolean("isAudioDisabled") else null
                    voiceChannelParticipantStateChangedListeners.forEach {
                        it(channelId, userId, isMuted, isSpeaking, isAudioDisabled)
                    }
                } catch (e: Exception) {
                    Log.e("VoiceSocketService", "Error handling voiceChannelParticipantStateChanged", e)
                }
            }

            socket?.on("peerMuteStateChanged") { args ->
                try {
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val peerId = payload.optString("peerId").ifBlank { null }
                    val userId = payload.optString("userId").ifBlank { null }
                    val isMuted = payload.optBoolean("isMuted", false)
                    onPeerMuteStateChanged?.invoke(peerId, userId, isMuted)
                } catch (e: Exception) {
                    Log.e("VoiceSocketService", "Error handling peerMuteStateChanged", e)
                }
            }

            socket?.on("peerAudioStateChanged") { args ->
                try {
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val peerId = payload.optString("peerId").ifBlank { null }
                    val userId = payload.optString("userId").ifBlank { null }
                    val isEnabled = payload.optBoolean("isEnabled", true)
                    val isGlobalAudioMuted =
                        if (payload.has("isGlobalAudioMuted")) payload.optBoolean("isGlobalAudioMuted") else null
                    onPeerAudioStateChanged?.invoke(peerId, userId, isEnabled, isGlobalAudioMuted)
                } catch (e: Exception) {
                    Log.e("VoiceSocketService", "Error handling peerAudioStateChanged", e)
                }
            }

            socket?.on("speakingStateChanged") { args ->
                try {
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val peerId = payload.optString("peerId").ifBlank { null }
                    val userId = payload.optString("userId").ifBlank { null }
                    val speaking = payload.optBoolean("speaking", false)
                    speakingStateChangedListeners.forEach { it(peerId, userId, speaking) }
                } catch (e: Exception) {
                    Log.e("VoiceSocketService", "Error handling speakingStateChanged", e)
                }
            }
            
            socket?.connect()
            
            // Wait for connection with timeout
            suspendCancellableCoroutine { continuation ->
                val finished = AtomicBoolean(false)
                var timeoutJob: kotlinx.coroutines.Job? = null
                var connectListener: (Array<out Any>) -> Unit = {}
                var errorListener: (Array<out Any>) -> Unit = {}
                val activeSocket = socket

                fun cleanupListeners() {
                    activeSocket?.off(Socket.EVENT_CONNECT, connectListener)
                    activeSocket?.off(Socket.EVENT_CONNECT_ERROR, errorListener)
                }

                fun finish(result: Result<Unit>) {
                    if (!finished.compareAndSet(false, true)) return
                    timeoutJob?.cancel()
                    cleanupListeners()
                    activeConnectCleanup = null
                    if (continuation.isActive) {
                        result.fold(
                            onSuccess = { continuation.resume(Unit) },
                            onFailure = { continuation.resumeWithException(it) },
                        )
                    }
                }

                activeConnectCleanup?.invoke()
                activeConnectCleanup = {
                    if (finished.compareAndSet(false, true)) {
                        timeoutJob?.cancel()
                        cleanupListeners()
                        activeConnectCleanup = null
                        continuation.cancel(CancellationException("Voice socket connect aborted"))
                    }
                }

                continuation.invokeOnCancellation {
                    activeConnectCleanup?.invoke()
                }

                connectListener = {
                    finish(Result.success(Unit))
                }

                errorListener = { args ->
                    Log.w("VoiceSocketService", "Connect error while waiting: ${args.contentToString()}")
                    finish(Result.failure(Exception("Connection failed: ${args.contentToString()}")))
                }

                timeoutJob = CoroutineScope(Dispatchers.Default).launch {
                    delay(10000)
                    if (_isConnected.value) {
                        finish(Result.success(Unit))
                    } else {
                        finish(Result.failure(Exception("Connection timeout")))
                    }
                }

                activeSocket?.once(Socket.EVENT_CONNECT, connectListener)
                activeSocket?.once(Socket.EVENT_CONNECT_ERROR, errorListener)
            }
            
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error connecting", e)
            _isConnected.value = false
            Result.failure(e)
        }
    }
    
    suspend fun joinRoom(
        roomId: String,
        name: String,
        userId: String,
        avatar: String? = null,
        avatarColor: String? = null,
        banner: String? = null,
        nameplate: String? = null,
    ): Result<TokenResponse> {
        return try {
            if (socket?.connected() != true) {
                val connectResult = connect()
                if (connectResult.isFailure) {
                    return Result.failure(connectResult.exceptionOrNull() ?: Exception("Failed to connect"))
                }
            }

            val tokenUserName = runCatching { tokenManager.getUserFromToken()?.username }
                .getOrNull()
                .orEmpty()
            val effectiveName = name
                .substringBefore("?")
                .trim()
                .takeIf { it.isNotBlank() && !it.equals("User", ignoreCase = true) }
                ?: tokenUserName.takeIf { it.isNotBlank() }
                ?: "User"
            
            suspendCancellableCoroutine { continuation ->
                val finished = AtomicBoolean(false)
                val requestData = JSONObject().apply {
                    put("roomId", roomId)
                    put("name", effectiveName)
                    put("userId", userId)
                    put("initialMuted", false)
                    put("initialAudioEnabled", true)
                    if (!avatar.isNullOrBlank()) {
                        put("avatar", avatar)
                    }
                    if (!avatarColor.isNullOrBlank()) {
                        put("avatarColor", avatarColor)
                    }
                    if (!banner.isNullOrBlank()) {
                        put("banner", banner)
                    }
                    if (!nameplate.isNullOrBlank()) {
                        put("nameplate", nameplate)
                    }
                }
                
                Log.d("VoiceSocketService", "Emitting join event for room: $roomId, name: $effectiveName, userId: $userId")
                
                val ack = io.socket.client.Ack { args ->
                    if (!finished.compareAndSet(false, true)) return@Ack
                    try {
                        Log.d("VoiceSocketService", "Received join response: ${args.contentToString()}")
                        if (args.isNotEmpty() && args[0] is JSONObject) {
                            val response = args[0] as JSONObject
                            
                            // Check for error first
                            if (response.has("error")) {
                                val error = response.getString("error")
                                Log.e("VoiceSocketService", "Server returned error: $error")
                                continuation.resume(Result.failure(Exception(error)))
                                return@Ack
                            }
                            
                            val token = response.getString("token")
                            val url = response.getString("url")
                            currentRoomId = roomId
                            
                            Log.d("VoiceSocketService", "Received token for room: $roomId, url: $url")
                            continuation.resume(Result.success(TokenResponse(token, url)))
                        } else {
                            Log.e("VoiceSocketService", "Invalid response format: ${args.contentToString()}")
                            continuation.resume(Result.failure(Exception("Invalid response format")))
                        }
                    } catch (e: Exception) {
                        Log.e("VoiceSocketService", "Error parsing join response", e)
                        continuation.resume(Result.failure(e))
                    }
                }
                
                socket?.emit("join", requestData, ack)
            }
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error joining room", e)
            Result.failure(e)
        }
    }

    fun leaveRoom(roomId: String? = currentRoomId) {
        val activeRoomId = roomId ?: return
        try {
            if (socket?.connected() == true) {
                val requestData = JSONObject().apply {
                    put("roomId", activeRoomId)
                }
                socket?.emit("leave", requestData)
                Log.d("VoiceSocketService", "Emitted leave event for room: $activeRoomId")
            } else {
                Log.d("VoiceSocketService", "Skip leave emit: socket is not connected")
            }
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error emitting leave for room: $activeRoomId", e)
        } finally {
            currentRoomId = null
        }
    }

    fun subscribeToChannel(channelId: String) {
        if (channelId.isBlank()) return
        subscribedChannels.add(channelId)
        requestChannelParticipants(channelId)
    }

    fun unsubscribeFromChannel(channelId: String) {
        subscribedChannels.remove(channelId)
    }

    fun clearChannelSubscriptions() {
        subscribedChannels.clear()
    }

    fun requestChannelParticipants(channelId: String) {
        if (channelId.isBlank()) return
        if (socket?.connected() != true) return
        try {
            val requestData = JSONObject().apply {
                put("channelId", channelId)
            }
            socket?.emit("getVoiceChannelParticipants", requestData)
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error requesting participants for channel: $channelId", e)
        }
    }

    fun addVoiceChannelParticipantsListener(
        listener: (String, List<VoiceChannelParticipant>) -> Unit,
    ) {
        voiceChannelParticipantsListeners.add(listener)
    }

    fun removeVoiceChannelParticipantsListener(
        listener: (String, List<VoiceChannelParticipant>) -> Unit,
    ) {
        voiceChannelParticipantsListeners.remove(listener)
    }

    fun addVoiceChannelUserJoinedListener(
        listener: (String, VoiceChannelParticipant) -> Unit,
    ) {
        voiceChannelUserJoinedListeners.add(listener)
    }

    fun removeVoiceChannelUserJoinedListener(
        listener: (String, VoiceChannelParticipant) -> Unit,
    ) {
        voiceChannelUserJoinedListeners.remove(listener)
    }

    fun addVoiceChannelUserLeftListener(listener: (String, String) -> Unit) {
        voiceChannelUserLeftListeners.add(listener)
    }

    fun removeVoiceChannelUserLeftListener(listener: (String, String) -> Unit) {
        voiceChannelUserLeftListeners.remove(listener)
    }

    fun addVoiceChannelParticipantStateChangedListener(
        listener: (String, String, Boolean?, Boolean?, Boolean?) -> Unit,
    ) {
        voiceChannelParticipantStateChangedListeners.add(listener)
    }

    fun removeVoiceChannelParticipantStateChangedListener(
        listener: (String, String, Boolean?, Boolean?, Boolean?) -> Unit,
    ) {
        voiceChannelParticipantStateChangedListeners.remove(listener)
    }

    fun setOnPeerMuteStateChanged(
        callback: ((String?, String?, Boolean) -> Unit)?
    ) {
        onPeerMuteStateChanged = callback
    }

    fun setOnPeerAudioStateChanged(
        callback: ((String?, String?, Boolean, Boolean?) -> Unit)?
    ) {
        onPeerAudioStateChanged = callback
    }

    fun addSpeakingStateChangedListener(listener: (String?, String?, Boolean) -> Unit) {
        speakingStateChangedListeners.add(listener)
    }

    fun removeSpeakingStateChangedListener(listener: (String?, String?, Boolean) -> Unit) {
        speakingStateChangedListeners.remove(listener)
    }

    /** @deprecated Use [addSpeakingStateChangedListener] */
    fun setOnSpeakingStateChanged(
        callback: ((String?, String?, Boolean) -> Unit)?
    ) {
        speakingStateChangedListeners.clear()
        if (callback != null) {
            speakingStateChangedListeners.add(callback)
        }
    }

    fun emitSpeaking(speaking: Boolean) {
        if (socket?.connected() != true) return
        try {
            socket?.emit(
                "speaking",
                JSONObject().apply {
                    put("speaking", speaking)
                },
            )
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error emitting speaking", e)
        }
    }

    fun emitMuteState(isMuted: Boolean) {
        if (socket?.connected() != true) return
        try {
            socket?.emit("muteState", JSONObject().apply {
                put("isMuted", isMuted)
            })
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error emitting muteState", e)
        }
    }

    fun emitAudioState(isEnabled: Boolean, isGlobalAudioMuted: Boolean, userId: String?) {
        if (socket?.connected() != true) return
        try {
            socket?.emit("audioState", JSONObject().apply {
                put("isEnabled", isEnabled)
                put("isGlobalAudioMuted", isGlobalAudioMuted)
                if (!userId.isNullOrBlank()) {
                    put("userId", userId)
                }
            })
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error emitting audioState", e)
        }
    }
    
    fun disconnect() {
        try {
            activeConnectCleanup?.invoke()
            activeConnectCleanup = null
            socket?.disconnect()
            socket = null
            currentRoomId = null
            _isConnected.value = false
            Log.d("VoiceSocketService", "Disconnected")
        } catch (e: Exception) {
            Log.e("VoiceSocketService", "Error disconnecting", e)
        }
    }

    private fun requestSubscribedChannelsParticipants() {
        subscribedChannels.forEach { channelId ->
            requestChannelParticipants(channelId)
        }
    }

    private fun JSONObject.toVoiceChannelParticipant(): VoiceChannelParticipant {
        val userId = optString("userId").ifBlank { optString("odUserId") }
        val userName = optString("name").ifBlank { optString("userName") }
        val avatarColor = optString("avatarColor").ifBlank { "#5865f2" }
        val isAudioDisabled = optBoolean("isAudioDisabled", false)
        val avatar = optString("avatar")
            .ifBlank { optString("avatarUrl") }
            .ifBlank { optString("profileImageUrl") }
            .ifBlank { null }
        val banner = optString("banner")
            .ifBlank { optString("bannerUrl") }
            .ifBlank { optString("profileBanner") }
            .ifBlank { optString("backgroundImage") }
            .ifBlank { null }
        val nameplate = optString("nameplate")
            .ifBlank { optString("Nameplate") }
            .ifBlank { null }
        val avatarDecoration = optString("avatarDecoration")
            .ifBlank { optString("AvatarDecoration") }
            .ifBlank { null }

        return VoiceChannelParticipant(
            userId = userId,
            userName = userName,
            isMuted = optBoolean("isMuted", false),
            isSpeaking = optBoolean("isSpeaking", false),
            isAudioDisabled = isAudioDisabled,
            isDeafened = optBoolean("isDeafened", isAudioDisabled),
            avatar = avatar,
            avatarColor = avatarColor,
            banner = banner,
            nameplate = nameplate,
            avatarDecoration = avatarDecoration,
        )
    }
}
