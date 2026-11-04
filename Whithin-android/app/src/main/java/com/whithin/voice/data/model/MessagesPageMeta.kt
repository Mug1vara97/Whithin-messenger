package com.whithin.voice.data.model

data class MessagesPageMeta(
    val hasMoreOlder: Boolean,
    val limit: Int,
    val beforeMessageId: String?,
)
