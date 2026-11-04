package com.whithin.voice.data.model

data class ProfileRealtimeUpdate(
    val userId: String,
    val username: String? = null,
    val displayName: String? = null,
    val avatar: String? = null,
    val avatarColor: String? = null,
    val banner: String? = null,
    val nameplate: String? = null,
    val avatarDecoration: String? = null,
)
