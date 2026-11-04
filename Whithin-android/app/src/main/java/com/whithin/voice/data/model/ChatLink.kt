package com.whithin.voice.data.model

data class ChatLink(
    val url: String,
    val senderUsername: String,
    val createdAt: String,
    val messageId: String,
) {
    val domainLabel: String
        get() =
            runCatching {
                val host = java.net.URI(url).host.orEmpty()
                host.removePrefix("www.")
            }.getOrDefault(url.take(48))
}
