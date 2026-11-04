package com.whithin.voice.util

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ChatCallSession(
    val chatId: String = "",
    val withRinging: Boolean = false,
    val isAnswered: Boolean = false,
    val callAnsweredAt: Long? = null,
)

object ChatCallSignalingState {
    private val _session = MutableStateFlow(ChatCallSession())
    val session: StateFlow<ChatCallSession> = _session.asStateFlow()

    fun beginOutgoing(chatId: String, withRinging: Boolean) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        _session.value =
            ChatCallSession(
                chatId = normalized,
                withRinging = withRinging,
                isAnswered = !withRinging,
                callAnsweredAt = if (withRinging) null else System.currentTimeMillis(),
            )
    }

    fun markAnswered(chatId: String? = null) {
        val current = _session.value
        val normalized = chatId?.trim().orEmpty()
        if (normalized.isNotBlank() && !current.chatId.equals(normalized, ignoreCase = true)) {
            return
        }
        if (current.isAnswered) return
        _session.value =
            current.copy(
                isAnswered = true,
                callAnsweredAt = System.currentTimeMillis(),
            )
    }

    fun hangupDurationSeconds(): Int? {
        val start = _session.value.callAnsweredAt ?: return null
        return maxOf(1, ((System.currentTimeMillis() - start) / 1000).toInt())
    }

    fun clear() {
        _session.value = ChatCallSession()
    }
}
