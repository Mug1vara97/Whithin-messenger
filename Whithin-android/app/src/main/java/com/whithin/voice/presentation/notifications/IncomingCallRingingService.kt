package com.whithin.voice.presentation.notifications

import android.content.Context

/** Legacy hook — foreground ringing service was removed to avoid Android 12+ FGS crashes. */
object IncomingCallRingingService {
    fun stop(@Suppress("UNUSED_PARAMETER") context: Context) = Unit
}
