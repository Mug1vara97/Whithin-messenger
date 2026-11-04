package com.whithin.voice.presentation.share

import android.net.Uri

sealed class SharePayload {
    abstract val previewText: String?

    data class Text(
        val text: String,
    ) : SharePayload() {
        override val previewText: String = text.trim()
    }

    data class Media(
        val uri: Uri,
        val mimeType: String?,
        val text: String? = null,
    ) : SharePayload() {
        override val previewText: String? = text?.trim()?.takeIf { it.isNotEmpty() }
    }
}
