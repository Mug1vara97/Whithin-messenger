package com.whithin.voice.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class CachedUserVisuals(
    val avatarUrl: String?,
    val avatarColor: String?,
    val bannerUrl: String?,
    val nameplate: String? = null,
    val avatarDecoration: String? = null,
    val displayName: String? = null,
)

/** SharedPreferences mirror for profile visuals — instant avatar in server sidebar on cold start. */
@Singleton
class UserProfileQuickStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun peek(userId: String): CachedUserVisuals? {
        val id = userId.trim()
        if (id.isBlank()) return null
        if (prefs.getString(KEY_USER_ID, null) != id) return null
        val avatarUrl = prefs.getString(KEY_AVATAR_URL, null)?.takeIf { it.isNotBlank() }
        val avatarColor = prefs.getString(KEY_AVATAR_COLOR, null)?.takeIf { it.isNotBlank() }
        val bannerUrl = prefs.getString(KEY_BANNER_URL, null)?.takeIf { it.isNotBlank() }
        val nameplate = prefs.getString(KEY_NAMEPLATE, null)?.takeIf { it.isNotBlank() }
        val avatarDecoration = prefs.getString(KEY_AVATAR_DECORATION, null)?.takeIf { it.isNotBlank() }
        val displayName = prefs.getString(KEY_DISPLAY_NAME, null)?.takeIf { it.isNotBlank() }
        if (avatarUrl == null && avatarColor == null && bannerUrl == null && nameplate == null && avatarDecoration == null && displayName == null) {
            return null
        }
        return CachedUserVisuals(
            avatarUrl = avatarUrl,
            avatarColor = avatarColor,
            bannerUrl = bannerUrl,
            nameplate = nameplate,
            avatarDecoration = avatarDecoration,
            displayName = displayName,
        )
    }

    fun save(
        userId: String,
        avatarUrl: String?,
        avatarColor: String?,
        bannerUrl: String? = null,
        nameplate: String? = null,
        avatarDecoration: String? = null,
        displayName: String? = null,
    ) {
        val id = userId.trim()
        if (id.isBlank()) return
        prefs.edit()
            .putString(KEY_USER_ID, id)
            .putString(KEY_AVATAR_URL, avatarUrl.orEmpty())
            .putString(KEY_AVATAR_COLOR, avatarColor.orEmpty())
            .putString(KEY_BANNER_URL, bannerUrl.orEmpty())
            .putString(KEY_NAMEPLATE, nameplate.orEmpty())
            .putString(KEY_AVATAR_DECORATION, avatarDecoration.orEmpty())
            .putString(KEY_DISPLAY_NAME, displayName.orEmpty())
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "user_profile_quick"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_AVATAR_URL = "avatar_url"
        private const val KEY_AVATAR_COLOR = "avatar_color"
        private const val KEY_BANNER_URL = "banner_url"
        private const val KEY_NAMEPLATE = "nameplate"
        private const val KEY_AVATAR_DECORATION = "avatar_decoration"
        private const val KEY_DISPLAY_NAME = "display_name"
    }
}
