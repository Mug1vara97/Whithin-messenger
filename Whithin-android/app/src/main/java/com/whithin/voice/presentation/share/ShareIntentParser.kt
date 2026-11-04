package com.whithin.voice.presentation.share

import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.os.Build

object ShareIntentParser {
    fun parseSharePayload(intent: Intent?, contentResolver: ContentResolver): SharePayload? {
        if (intent == null) return null

        return when (intent.action) {
            Intent.ACTION_SEND -> parseSingleSend(intent, contentResolver)
            Intent.ACTION_SEND_MULTIPLE -> parseMultipleSend(intent, contentResolver)
            else -> null
        }
    }

    private fun parseSingleSend(intent: Intent, contentResolver: ContentResolver): SharePayload? {
        val text =
            intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()?.takeIf { it.isNotEmpty() }
                ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim()?.takeIf { it.isNotEmpty() }

        val stream = readStreamUri(intent)
        val mimeType = intent.type?.trim()?.takeIf { it.isNotEmpty() }
            ?: stream?.let { contentResolver.getType(it) }

        return when {
            stream != null -> SharePayload.Media(uri = stream, mimeType = mimeType, text = text)
            !text.isNullOrBlank() -> SharePayload.Text(text = text)
            else -> null
        }
    }

    private fun parseMultipleSend(intent: Intent, contentResolver: ContentResolver): SharePayload? {
        val uris = readStreamUris(intent)
        if (uris.isEmpty()) return null

        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()?.takeIf { it.isNotEmpty() }
        val mimeType = intent.type?.trim()?.takeIf { it.isNotEmpty() }
            ?: contentResolver.getType(uris.first())

        return SharePayload.Media(uri = uris.first(), mimeType = mimeType, text = text)
    }

    private fun readStreamUri(intent: Intent): Uri? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }
    }

    private fun readStreamUris(intent: Intent): List<Uri> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM).orEmpty()
        }
    }
}
