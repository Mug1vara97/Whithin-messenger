package com.whithin.voice.presentation.service

enum class AudioOutputType {
    SPEAKER,
    EARPIECE,
    BLUETOOTH,
}

data class AudioOutputDevice(
    val id: String,
    val title: String,
    val subtitle: String?,
    val type: AudioOutputType,
)
