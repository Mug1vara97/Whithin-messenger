package com.whithin.voice.domain.model

data class Participant(
    val identity: String,
    val name: String,
    val isMuted: Boolean = false,
    val isSpeaking: Boolean = false,
    val hasVideo: Boolean = false,
    val hasAudio: Boolean = true,
    val isGlobalAudioMuted: Boolean = false,
    val avatarUrl: String? = null,
    val avatarColor: String = "#5865f2",
    val bannerUrl: String? = null,
    val nameplate: String? = null,
    val avatarDecoration: String? = null,
)
