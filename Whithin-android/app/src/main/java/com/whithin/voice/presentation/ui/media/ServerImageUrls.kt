package com.whithin.voice.presentation.ui.media

private const val MEDIA_ORIGIN = "https://whithin.ru"

/** Bundled test/demo nameplates shipped in `assets/profile-media/`. */
private val BUNDLED_NAMEPLATE_ASSETS =
    mapOf(
        "/sakura.webp" to "profile-media/sakura.webp",
        "sakura.webp" to "profile-media/sakura.webp",
        "/test.webp" to "profile-media/test.webp",
        "test.webp" to "profile-media/test.webp",
    )

/** Bundled test avatar decorations shipped in `assets/profile-media/`. */
private val BUNDLED_AVATAR_DECORATION_ASSETS =
    mapOf(
        "/testAvatar.webp" to "profile-media/testAvatar.webp",
        "testAvatar.webp" to "profile-media/testAvatar.webp",
    )

private fun resolveBundledNameplateAsset(raw: String): String? {
    val trimmed = raw.trim()
    return BUNDLED_NAMEPLATE_ASSETS[trimmed]
        ?: BUNDLED_NAMEPLATE_ASSETS["/${trimmed.removePrefix("/")}"]
        ?: BUNDLED_NAMEPLATE_ASSETS[trimmed.removePrefix("/")]
}

private fun resolveBundledAvatarDecorationAsset(raw: String): String? {
    val trimmed = raw.trim()
    return BUNDLED_AVATAR_DECORATION_ASSETS[trimmed]
        ?: BUNDLED_AVATAR_DECORATION_ASSETS["/${trimmed.removePrefix("/")}"]
        ?: BUNDLED_AVATAR_DECORATION_ASSETS[trimmed.removePrefix("/")]
}

/** Matches web `resolveNameplateUrl`. */
fun resolveNameplateUrl(raw: String?): String? {
    val value = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    resolveBundledNameplateAsset(value)?.let { assetPath ->
        return "asset:///$assetPath"
    }
    return when {
        value.startsWith("http://") || value.startsWith("https://") -> value
        value.startsWith("/uploads/") -> "$MEDIA_ORIGIN$value"
        value.startsWith("uploads/") -> "$MEDIA_ORIGIN/$value"
        value.startsWith("/") -> "$MEDIA_ORIGIN$value"
        else -> "$MEDIA_ORIGIN/$value"
    }
}

fun resolveServerIconUrl(iconUrl: String?): String? = resolveMediaUrl(iconUrl)

fun resolveAvatarUrl(raw: String?): String? {
    val trimmed = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return resolveMediaUrl(trimmed)
}

/** Matches web `resolveAvatarDecorationUrl`. */
fun resolveAvatarDecorationUrl(raw: String?): String? {
    val value = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    resolveBundledAvatarDecorationAsset(value)?.let { assetPath ->
        return "asset:///$assetPath"
    }
    return when {
        value.startsWith("http://") || value.startsWith("https://") -> value
        value.startsWith("/") -> "$MEDIA_ORIGIN$value"
        else -> "$MEDIA_ORIGIN/uploads/$value"
    }
}

fun resolveProfileMediaUrl(raw: String?): String? {
    val value = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return when {
        isProfileMediaVideo(value) -> resolveNameplateUrl(value)
        value.contains("nameplate", ignoreCase = true) -> resolveNameplateUrl(value)
        else -> resolveAvatarDecorationUrl(value) ?: resolveMediaUrl(value)
    }
}

private fun resolveMediaUrl(raw: String?): String? {
    val value = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return when {
        value.startsWith("http://") || value.startsWith("https://") -> value
        value.startsWith("/uploads/") -> "$MEDIA_ORIGIN$value"
        value.startsWith("uploads/") -> "$MEDIA_ORIGIN/$value"
        value.startsWith("/") -> "$MEDIA_ORIGIN$value"
        else -> "$MEDIA_ORIGIN/uploads/$value"
    }
}

private val PROFILE_VIDEO_PATTERN = Regex("""\.(webm|mp4|mov)(?:[?#]|$)""", RegexOption.IGNORE_CASE)

fun isProfileMediaVideo(path: String?): Boolean {
    if (path.isNullOrBlank()) return false
    return PROFILE_VIDEO_PATTERN.containsMatchIn(path)
}

fun isNameplateVideo(path: String?): Boolean = isProfileMediaVideo(path)

fun isAvatarDecorationVideo(path: String?): Boolean = isProfileMediaVideo(path)

/** On Android prefer WebP/PNG/GIF via Coil; for `.webm` tries the same path with `.webp`. */
fun resolveAndroidProfileImageUrl(mediaPath: String?): String? {
    val url = resolveProfileMediaUrl(mediaPath) ?: return null
    return when {
        isProfileMediaVideo(mediaPath) ->
            url.replace(Regex("\\.webm(?:[?#].*)?$", RegexOption.IGNORE_CASE), ".webp")
        url.contains(".webp", ignoreCase = true) ||
            url.contains(".png", ignoreCase = true) ||
            url.contains(".gif", ignoreCase = true) -> url
        else -> null
    }
}

/** Nameplate image URL for Android (WebP preferred). */
fun resolveAndroidNameplateImageUrl(nameplate: String?): String? {
    val url = resolveNameplateUrl(nameplate) ?: return null
    return when {
        isProfileMediaVideo(nameplate) ->
            url.replace(Regex("\\.webm(?:[?#].*)?$", RegexOption.IGNORE_CASE), ".webp")
        url.contains(".webp", ignoreCase = true) ||
            url.contains(".png", ignoreCase = true) ||
            url.contains(".gif", ignoreCase = true) -> url
        else -> url
    }
}
