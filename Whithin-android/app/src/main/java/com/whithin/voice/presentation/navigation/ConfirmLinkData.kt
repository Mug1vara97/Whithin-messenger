package com.whithin.voice.presentation.navigation

enum class ConfirmLinkType {
    REGISTER_EMAIL,
    EMAIL_CHANGE,
    PASSWORD_CHANGE,
}

data class ConfirmLinkData(
    val type: ConfirmLinkType,
    val userId: String,
    val token: String,
    val email: String? = null,
)
