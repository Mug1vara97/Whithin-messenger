package com.whithin.voice.presentation.notifications

import com.whithin.voice.data.model.ChatDetailInfo
import com.whithin.voice.data.model.ChatInfo

object PushNotificationIntents {
    const val TYPE_FRIEND_REQUEST = "friend_request"
    const val TYPE_CHAT_MESSAGE = "chat_message"
    const val TYPE_SERVER_MESSAGE = "server_message"

    const val ACTION_MARK_CHAT_READ = "com.whithin.voice.action.MARK_CHAT_READ"
    const val ACTION_REPLY_TO_CHAT = "com.whithin.voice.action.REPLY_TO_CHAT"
    const val EXTRA_REPLY_INPUT = "reply_input"

    const val EXTRA_OPEN_FRIENDS = "open_friends"
    const val EXTRA_OPEN_CHAT = "open_chat"
    const val EXTRA_CHAT_ID = "chat_id"
    const val EXTRA_CHAT_TITLE = "chat_title"
    const val EXTRA_SERVER_ID = "server_id"
    const val EXTRA_REQUEST_ID = "request_id"
    const val EXTRA_SENDER_ID = "sender_id"
    const val EXTRA_SENDER_USERNAME = "sender_username"
}

/** Placeholder titles from legacy pushes — not real chat names. */
object PushNotificationTitles {
    private val genericTitles =
        setOf(
            "new message",
            "new message in group",
            "whithin",
            "chat",
        )

    fun isGeneric(title: String?): Boolean {
        val normalized = title?.trim()?.lowercase() ?: return true
        return normalized.isEmpty() || normalized in genericTitles
    }

    fun resolve(
        chatId: String,
        routeTitle: String,
        detail: ChatDetailInfo?,
        chats: List<ChatInfo>,
    ): String {
        val normalizedChatId = chatId.trim()
        val chatFromList =
            chats.find { it.chatIdValue.equals(normalizedChatId, ignoreCase = true) }

        if (chatFromList?.isSavedMessagesValue == true) {
            return chatFromList.usernameValue.ifBlank { "Избранное" }
        }

        detail
            ?.takeIf { it.chatIdValue.equals(normalizedChatId, ignoreCase = true) }
            ?.name
            ?.trim()
            ?.takeIf { !isGeneric(it) }
            ?.let { return it }

        chatFromList
            ?.usernameValue
            ?.trim()
            ?.takeIf { !isGeneric(it) }
            ?.let { return it }

        routeTitle.trim().takeIf { !isGeneric(it) }?.let { return it }
        return "Чат"
    }
}
