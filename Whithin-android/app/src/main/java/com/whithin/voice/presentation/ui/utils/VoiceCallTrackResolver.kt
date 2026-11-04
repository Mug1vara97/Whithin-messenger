package com.whithin.voice.presentation.ui.utils

import io.livekit.android.room.participant.Participant
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.TrackPublication
import io.livekit.android.room.track.VideoTrack

object VoiceCallTrackResolver {
    fun cameraTrack(participant: Participant): VideoTrack? {
        val publication = participant.getTrackPublication(Track.Source.CAMERA) ?: return null
        return publication.track as? VideoTrack
    }

    fun screenShareTrack(participant: Participant): VideoTrack? {
        val publication = participant.getTrackPublication(Track.Source.SCREEN_SHARE) ?: return null
        return publication.track as? VideoTrack
    }

    fun hasActiveCamera(participant: Participant): Boolean {
        return participant.isCameraEnabled() && cameraTrack(participant) != null
    }

    fun hasActiveScreenShare(participant: Participant): Boolean {
        return participant.isScreenShareEnabled() && screenShareTrack(participant) != null
    }

    fun isScreenShareAudioPublication(publication: TrackPublication): Boolean {
        if (publication.kind != Track.Kind.AUDIO) return false
        if (publication.source == Track.Source.SCREEN_SHARE_AUDIO) return true
        return publication.name.equals(
            ScreenShareAudioNames.TRACK_NAME,
            ignoreCase = true,
        )
    }

    fun isParticipantMicrophonePublication(publication: TrackPublication): Boolean {
        if (publication.kind != Track.Kind.AUDIO) return false
        if (isScreenShareAudioPublication(publication)) return false
        return publication.source == Track.Source.MICROPHONE
    }

    /** Mic mute state from the microphone publication only (ignores screen-share audio). */
    fun isRemoteMicrophoneMuted(participant: Participant): Boolean {
        val micPublication = participant.getTrackPublication(Track.Source.MICROPHONE)
        if (micPublication != null) {
            return micPublication.muted
        }
        return try {
            !participant.isMicrophoneEnabled()
        } catch (_: Exception) {
            false
        }
    }
}

object ScreenShareAudioNames {
    const val TRACK_NAME = "screen_share_audio"
}
