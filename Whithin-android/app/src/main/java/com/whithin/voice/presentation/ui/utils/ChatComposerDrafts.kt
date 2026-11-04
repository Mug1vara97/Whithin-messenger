package com.whithin.voice.presentation.ui.utils

/**
 * In-memory per-chat composer drafts for the current app session.
 * Survives navigating away from a chat and back without bloating ChatScreen state.
 */
object ChatComposerDrafts {
    private val drafts = LinkedHashMap<String, String>()

    @Synchronized
    fun get(chatId: String): String {
        val key = chatId.trim()
        if (key.isEmpty()) return ""
        return drafts[key].orEmpty()
    }

    @Synchronized
    fun set(chatId: String, text: String) {
        val key = chatId.trim()
        if (key.isEmpty()) return
        val trimmed = text.trimEnd()
        if (trimmed.isEmpty()) {
            drafts.remove(key)
        } else {
            drafts[key] = text
            // Soft cap so a long session cannot grow without bound.
            while (drafts.size > 80) {
                val oldest = drafts.keys.firstOrNull() ?: break
                drafts.remove(oldest)
            }
        }
    }

    @Synchronized
    fun clear(chatId: String) {
        val key = chatId.trim()
        if (key.isNotEmpty()) drafts.remove(key)
    }
}
