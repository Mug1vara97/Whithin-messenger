package com.whithin.voice.data.model

data class VoiceChannelParticipant(
    val userId: String,
    val userName: String,
    val isMuted: Boolean = false,
    val isSpeaking: Boolean = false,
    val isAudioDisabled: Boolean = false,
    val isDeafened: Boolean = false,
    val avatar: String? = null,
    val avatarColor: String = "#5865f2",
    val banner: String? = null,
    val nameplate: String? = null,
    val avatarDecoration: String? = null,
)
