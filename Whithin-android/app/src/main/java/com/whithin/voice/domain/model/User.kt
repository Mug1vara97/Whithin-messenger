package com.whithin.voice.domain.model

data class User(
    val id: String,
    val username: String,
    val email: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val avatarColor: String? = null,
    val bannerUrl: String? = null,
    val nameplate: String? = null,
    val avatarDecoration: String? = null,
)
