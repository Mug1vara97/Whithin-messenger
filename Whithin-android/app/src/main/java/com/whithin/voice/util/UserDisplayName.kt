package com.whithin.voice.util

import com.whithin.voice.domain.model.User

object UserDisplayNames {
    const val MAX_LENGTH = 32

    fun resolve(
        displayName: String?,
        username: String?,
        fallback: String = "Пользователь",
    ): String {
        val nick = displayName?.trim().orEmpty()
        if (nick.isNotEmpty()) return nick

        val login = username?.trim().orEmpty()
        if (login.isNotEmpty()) return login

        return fallback
    }
}

fun User.visibleName(fallback: String = "Пользователь"): String =
    UserDisplayNames.resolve(displayName, username, fallback)
