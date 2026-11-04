package com.whithin.voice.presentation.ui.media

import android.graphics.drawable.Animatable
import java.util.Collections
import java.util.IdentityHashMap

/**
 * Caps concurrent FrameSeqDecoder / WebPDrawable playback in chat.
 * Decode can stay warm; only a few animations should actually run.
 */
object ChatAnimationPlayback {
    const val MAX_CONCURRENT = 5

    private val lock = Any()
    private val running: MutableSet<Animatable> =
        Collections.newSetFromMap(IdentityHashMap())

    fun startIfAllowed(animatable: Animatable): Boolean {
        synchronized(lock) {
            if (animatable in running) {
                if (!animatable.isRunning) animatable.start()
                return true
            }
            if (running.size >= MAX_CONCURRENT) return false
            running.add(animatable)
            animatable.start()
            return true
        }
    }

    fun stop(animatable: Animatable) {
        synchronized(lock) {
            if (running.remove(animatable) || animatable.isRunning) {
                runCatching { animatable.stop() }
            }
        }
    }

    fun pauseAllTracked() {
        synchronized(lock) {
            running.forEach { runCatching { it.stop() } }
            // Keep membership so resume can restart the same set after scroll.
        }
    }

    fun resumeTracked() {
        synchronized(lock) {
            running.forEach { anim ->
                if (!anim.isRunning) runCatching { anim.start() }
            }
        }
    }
}
