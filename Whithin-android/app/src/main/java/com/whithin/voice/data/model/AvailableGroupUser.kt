package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class AvailableGroupUser(
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("UserId") val userIdAlt: String? = null,
    @SerializedName("username") val username: String? = null,
    @SerializedName("Username") val usernameAlt: String? = null,
    @SerializedName("avatarUrl") val avatarUrl: String? = null,
    @SerializedName("AvatarUrl") val avatarUrlAlt: String? = null,
    @SerializedName("avatarColor") val avatarColor: String? = null,
    @SerializedName("AvatarColor") val avatarColorAlt: String? = null,
    @SerializedName("userStatus") val userStatus: String? = null,
    @SerializedName("UserStatus") val userStatusAlt: String? = null,
) {
    val userIdValue: String get() = userId ?: userIdAlt ?: ""
    val usernameValue: String get() = username ?: usernameAlt ?: ""
    val avatarUrlValue: String? get() = avatarUrl ?: avatarUrlAlt
    val avatarColorValue: String? get() = avatarColor ?: avatarColorAlt
    val userStatusValue: String get() = normalizePresenceWireValue(userStatus ?: userStatusAlt)
}
