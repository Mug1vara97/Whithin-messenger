package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

/** Ответ `/api/Chat/{id}/info` и payload `ChatInfoReceived` hub. */
data class ChatDetailInfo(
    @SerializedName(value = "chatId", alternate = ["ChatId"])
    val chatId: String?,
    @SerializedName(value = "name", alternate = ["Name"])
    val name: String?,
    @SerializedName(value = "type", alternate = ["Type"])
    val type: String?,
    @SerializedName("avatar") val avatar: String?,
    @SerializedName("avatarColor") val avatarColor: String?,
    @SerializedName(value = "banner", alternate = ["Banner", "bannerUrl", "BannerUrl"])
    val banner: String? = null,
    @SerializedName("chatAvatar") val chatAvatar: String?,
    @SerializedName("chatAvatarColor") val chatAvatarColor: String?,
    @SerializedName("otherUserId") val otherUserId: String?,
    @SerializedName("creatorUserId") val creatorUserId: String? = null,
    @SerializedName("CreatorUserId") val creatorUserIdAlt: String? = null,
) {
    val chatIdValue: String get() = chatId.orEmpty()

    val creatorUserIdValue: String?
        get() = creatorUserId ?: creatorUserIdAlt

    /** `private` / `group` / `saved` (как с бэкенда). */
    val isSavedMessagesValue: Boolean
        get() = type.equals("saved", ignoreCase = true)

    val isGroupValue: Boolean
        get() = type.equals("group", ignoreCase = true) && !isSavedMessagesValue

    /** Аватар для отображения: у группы — chat avatar, личное — пользовательский. */
    fun displayAvatarPath(): String? =
        if (isGroupValue) chatAvatar ?: avatar else avatar ?: chatAvatar

    fun displayAvatarColor(): String? =
        if (isGroupValue) chatAvatarColor ?: avatarColor else avatarColor ?: chatAvatarColor

    fun displayBannerPath(): String? = banner?.takeIf { it.isNotBlank() }
}

data class ChatParticipant(
    @SerializedName("userId") val userId: String?,
    @SerializedName("username") val username: String?,
    @SerializedName("avatarUrl") val avatarUrl: String?,
    @SerializedName("avatarColor") val avatarColor: String?,
    @SerializedName(value = "banner", alternate = ["Banner", "bannerUrl", "BannerUrl"])
    val banner: String? = null,
    @SerializedName("userStatus") val userStatus: String?,
    @SerializedName("lastSeen") val lastSeen: String?,
    @SerializedName("LastSeen") val lastSeenAlt: String? = null,
    @SerializedName("avatarDecoration") val avatarDecoration: String? = null,
    @SerializedName("AvatarDecoration") val avatarDecorationAlt: String? = null,
    @SerializedName("nameplate") val nameplate: String? = null,
    @SerializedName("Nameplate") val nameplateAlt: String? = null,
) {
    val userIdValue: String get() = userId.orEmpty()
    val usernameValue: String get() = username.orEmpty().ifBlank { "Пользователь" }
    val bannerValue: String? get() = banner?.takeIf { it.isNotBlank() }
    val userStatusValue: String get() = normalizePresenceWireValue(userStatus)
    val avatarDecorationValue: String?
        get() = avatarDecoration?.trim()?.takeIf { it.isNotEmpty() }
            ?: avatarDecorationAlt?.trim()?.takeIf { it.isNotEmpty() }
    val nameplateValue: String?
        get() = nameplate?.trim()?.takeIf { it.isNotEmpty() }
            ?: nameplateAlt?.trim()?.takeIf { it.isNotEmpty() }
}

data class ChatAvatarUploadResponse(
    @SerializedName("avatarUrl") val avatarUrl: String?
)
