package com.whithin.voice.data.model

data class TokenRequest(
    val roomId: String,
    val name: String,
    val identity: String? = null
)
