package com.whithin.voice.presentation.service

import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import com.whithin.voice.presentation.ui.utils.ScreenShareAudioNames
import io.livekit.android.audio.ScreenAudioCapturer
import io.livekit.android.room.Room
import io.livekit.android.room.participant.AudioTrackPublishOptions
import io.livekit.android.room.track.LocalAudioTrack
import io.livekit.android.room.track.LocalAudioTrackOptions
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track

/**
 * Publishes system/screen audio on a dedicated [Track.Source.SCREEN_SHARE_AUDIO] track
 * (same channel as web), not mixed into the microphone track.
 */
@RequiresApi(Build.VERSION_CODES.Q)
class ScreenShareAudioController {
    private var audioCapturer: ScreenAudioCapturer? = null
    private var publishedTrack: LocalAudioTrack? = null

    suspend fun start(room: Room) {
        stop(room)

        val local = room.localParticipant
        val screenTrack =
            local.getTrackPublication(Track.Source.SCREEN_SHARE)?.track as? LocalVideoTrack
        if (screenTrack == null) {
            Log.w(TAG, "Screen share video track missing, skipping screen audio publish")
            return
        }

        val capturer = ScreenAudioCapturer.createFromScreenShareTrack(screenTrack)
        if (capturer == null) {
            Log.w(TAG, "Failed to create ScreenAudioCapturer")
            return
        }
        audioCapturer = capturer

        val audioTrack =
            local.createAudioTrack(
                ScreenShareAudioNames.TRACK_NAME,
                LocalAudioTrackOptions(
                    noiseSuppression = false,
                    echoCancellation = false,
                    autoGainControl = false,
                    highPassFilter = false,
                    typingNoiseDetection = false,
                ),
            )
        publishedTrack = audioTrack
        audioTrack.setAudioBufferCallback(capturer)

        val publishOptions =
            AudioTrackPublishOptions(
                name = ScreenShareAudioNames.TRACK_NAME,
                audioBitrate = null,
                dtx = false,
                red = true,
                source = Track.Source.SCREEN_SHARE_AUDIO,
                stream = null,
            )
        local.publishAudioTrack(audioTrack, publishOptions, null)
        Log.d(TAG, "Screen share audio track published")
    }

    suspend fun stop(room: Room?) {
        val track = publishedTrack
        publishedTrack = null

        track?.setAudioBufferCallback(null)
        if (track != null && room != null) {
            runCatching { room.localParticipant.unpublishTrack(track) }
                .onFailure { Log.w(TAG, "Failed to unpublish screen share audio", it) }
        }

        runCatching { audioCapturer?.releaseAudioResources() }
        audioCapturer = null
    }

    companion object {
        private const val TAG = "ScreenShareAudio"
    }
}
