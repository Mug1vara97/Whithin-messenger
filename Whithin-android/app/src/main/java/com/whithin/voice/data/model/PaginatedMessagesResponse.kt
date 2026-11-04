package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class PaginatedMessagesResponse(
    @SerializedName("messages")
    val messages: List<Message>? = null,
    @SerializedName("hasMoreOlder")
    val hasMoreOlder: Boolean? = null,
)
