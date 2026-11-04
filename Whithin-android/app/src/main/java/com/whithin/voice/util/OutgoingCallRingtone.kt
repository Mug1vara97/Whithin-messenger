package com.whithin.voice.util

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import com.whithin.voice.R

object OutgoingCallRingtone {
    private var player: MediaPlayer? = null

    @Synchronized
    fun start(context: Context) {
        stop()
        val appContext = context.applicationContext
        player =
            MediaPlayer.create(appContext, R.raw.den_den_mushi)?.apply {
                isLooping = true
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setVolume(0.45f, 0.45f)
                start()
            }
    }

    @Synchronized
    fun stop() {
        val current = player ?: return
        runCatching {
            if (current.isPlaying) current.stop()
        }
        runCatching { current.release() }
        player = null
    }
}
