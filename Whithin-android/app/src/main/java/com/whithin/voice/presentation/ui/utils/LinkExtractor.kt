package com.whithin.voice.presentation.ui.utils

import com.whithin.voice.data.model.ChatLink
import com.whithin.voice.data.model.Message

object LinkExtractor {
    private val linkRegex = Regex("""(?i)\b((?:https?://|www\.)[^\s<>()]+)""")

    fun normalizeUrl(rawUrl: String): String {
        val trimmed = rawUrl.trimEnd('.', ',', ';', ':', '!', '?', ')', ']')
        return if (trimmed.startsWith("www.", ignoreCase = true)) {
            "https://$trimmed"
        } else {
            trimmed
        }
    }

    fun extractUrls(text: String): List<String> {
        if (text.isBlank()) return emptyList()
        return linkRegex
            .findAll(text)
            .map { normalizeUrl(it.value) }
            .filter { it.length > 8 }
            .toList()
    }

    fun extractFromMessages(messages: List<Message>): List<ChatLink> {
        val seen = linkedSetOf<String>()
        val result = ArrayList<ChatLink>()

        messages
            .sortedByDescending { it.createdAtValue }
            .forEach { message ->
                val texts = buildList {
                    add(message.contentValue)
                    message.repliedMessageValue?.content?.let { add(it) }
                    message.forwardedMessageValue?.bodyValue?.let { add(it) }
                    message.mediaFilesValue.forEach { media ->
                        if (media.captionValue.isNotBlank()) add(media.captionValue)
                    }
                }
                texts.forEach { text ->
                    extractUrls(text).forEach { url ->
                        val key = url.lowercase()
                        if (seen.add(key)) {
                            result +=
                                ChatLink(
                                    url = url,
                                    senderUsername = message.senderUsernameValue,
                                    createdAt = message.createdAtValue,
                                    messageId = message.messageIdValue,
                                )
                        }
                    }
                }
            }
        return result
    }
}
