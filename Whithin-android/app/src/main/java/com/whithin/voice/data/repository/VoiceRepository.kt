package com.whithin.voice.data.repository

import android.util.Log
import com.whithin.voice.data.api.VoiceApi
import com.whithin.voice.data.model.TokenRequest
import com.whithin.voice.data.model.TokenResponse
import com.whithin.voice.data.socketio.VoiceSocketService
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VoiceRepository @Inject constructor(
    private val api: VoiceApi,
    private val voiceSocketService: VoiceSocketService
) {
    suspend fun getToken(
        roomId: String,
        userName: String,
        userId: String,
        avatar: String? = null,
        avatarColor: String? = null,
        banner: String? = null,
        nameplate: String? = null,
    ): TokenResponse {
        return try {
            // Use Socket.IO to get token (as per server implementation)
            Log.d("VoiceRepository", "Getting token via Socket.IO for room: $roomId, user: $userName")
            voiceSocketService.joinRoom(roomId, userName, userId, avatar, avatarColor, banner, nameplate).getOrThrow()
        } catch (e: Exception) {
            Log.e("VoiceRepository", "Failed to get token via Socket.IO, trying REST API", e)
            // Fallback to REST API if Socket.IO fails
            api.getToken(TokenRequest(roomId = roomId, name = userName))
        }
    }

    fun leaveRoom(roomId: String) {
        voiceSocketService.leaveRoom(roomId)
    }

    fun disconnectVoiceSocket() {
        voiceSocketService.disconnect()
    }
}
