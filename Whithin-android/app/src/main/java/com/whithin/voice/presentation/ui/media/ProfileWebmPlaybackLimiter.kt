package com.whithin.voice.presentation.ui.media

import java.util.concurrent.atomic.AtomicInteger

/** Caps concurrent native video players for profile WebM (avatar decoration, etc.). */
object ProfileWebmPlaybackLimiter {
    private const val MAX_CONCURRENT = 4
    private val activeCount = AtomicInteger(0)

    fun tryAcquire(): Boolean {
        while (true) {
            val current = activeCount.get()
            if (current >= MAX_CONCURRENT) return false
            if (activeCount.compareAndSet(current, current + 1)) return true
        }
    }

    fun release() {
        activeCount.updateAndGet { current -> (current - 1).coerceAtLeast(0) }
    }
}
