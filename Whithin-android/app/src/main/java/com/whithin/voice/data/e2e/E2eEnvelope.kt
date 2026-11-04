package com.whithin.voice.data.e2e

object E2eEnvelope {
    fun isE2eEnvelope(content: String?): Boolean {
        val trimmed = content?.trim().orEmpty()
        if (!trimmed.startsWith("{")) return false
        return trimmed.contains("\"n\"") || trimmed.contains("\"c\"")
    }
}
