package com.whithin.voice.presentation.ui.media

import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned

/**
 * Last known on-screen bounds (window coordinates) of media thumbnails, keyed by media URL.
 * Used by the viewer to animate open/close from/to the thumbnail, the way Telegram's
 * PhotoViewer does.
 */
object MediaThumbnailBounds {
    private val bounds = HashMap<String, Rect>(64)

    fun update(url: String, rect: Rect) {
        if (url.isBlank()) return
        synchronized(bounds) { bounds[url] = rect }
    }

    fun get(url: String): Rect? = synchronized(bounds) { bounds[url] }
}

/** Reports this node's window bounds to [MediaThumbnailBounds] under [url]. */
fun Modifier.reportMediaThumbnailBounds(url: String): Modifier =
    if (url.isBlank()) {
        this
    } else {
        onGloballyPositioned { coords ->
            if (coords.isAttached) MediaThumbnailBounds.update(url, coords.boundsInWindow())
        }
    }
