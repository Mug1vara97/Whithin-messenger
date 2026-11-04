package com.whithin.voice.presentation.ui.media

import com.whithin.voice.data.model.Message

fun buildAvatarDecorationMapFromMessages(messages: List<Message>): Map<String, String> {
    val map = linkedMapOf<String, String>()
    messages.forEach { message ->
        val userId = message.senderIdValue.trim()
        val decoration = message.avatarDecorationValue?.trim()?.takeIf { it.isNotEmpty() } ?: return@forEach
        if (userId.isNotBlank()) {
            map[userId] = decoration
        }
    }
    return map
}

fun resolveAvatarDecoration(
    userId: String?,
    participantDecoration: String? = null,
    chatListDecoration: String? = null,
    messageDecorations: Map<String, String> = emptyMap(),
    fetchedDecorations: Map<String, String> = emptyMap(),
): String? {
    participantDecoration?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    val normalizedUserId = userId?.trim().orEmpty()
    if (normalizedUserId.isNotBlank()) {
        messageDecorations[normalizedUserId]?.let { return it }
        fetchedDecorations[normalizedUserId]?.let { return it }
    }
    return chatListDecoration?.trim()?.takeIf { it.isNotEmpty() }
}

fun resolveNameplate(
    userId: String?,
    participantNameplate: String? = null,
    fetchedNameplates: Map<String, String> = emptyMap(),
): String? {
    participantNameplate?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    val normalizedUserId = userId?.trim().orEmpty()
    if (normalizedUserId.isNotBlank()) {
        fetchedNameplates[normalizedUserId]?.let { return it }
    }
    return null
}
