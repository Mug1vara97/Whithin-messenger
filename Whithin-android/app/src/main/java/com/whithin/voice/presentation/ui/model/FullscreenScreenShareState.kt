package com.whithin.voice.presentation.ui.model

import io.livekit.android.room.Room
import io.livekit.android.room.track.VideoTrack

data class FullscreenScreenShareState(
    val tileId: String,
    val ownerName: String,
    val room: Room?,
    val screenTrack: VideoTrack,
    val cameraTrack: VideoTrack?,
    val mirrorCamera: Boolean,
)
