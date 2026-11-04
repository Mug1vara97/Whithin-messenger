package com.whithin.voice.presentation.notifications

import java.util.Locale

object ActiveChatState {
    @Volatile
    var activeChatId: String? = null

    fun isActiveChat(chatId: String?): Boolean {
        val active = normalizeChatId(activeChatId) ?: return false
        val incoming = normalizeChatId(chatId) ?: return false
        return active == incoming
    }

    /** Не показывать push о сообщении, если пользователь уже смотрит этот чат. */
    fun shouldSuppressMessageNotification(chatId: String?): Boolean {
        if (!AppVisibilityState.isAppInForeground) return false
        return isActiveChat(chatId)
    }

    private fun normalizeChatId(raw: String?): String? =
        raw?.trim()?.lowercase(Locale.ROOT)?.takeIf { it.isNotBlank() }
}
