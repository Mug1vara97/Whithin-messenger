package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class TokenResponse(
    @SerializedName("token")
    val token: String,
    @SerializedName("url")
    val url: String
)
