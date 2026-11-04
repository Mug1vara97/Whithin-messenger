package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class ServerBannerUploadResponse(
    @SerializedName("banner")
    val banner: String? = null,
)

data class AddServerMemberRequest(
    @SerializedName("userId")
    val userId: String,
)

data class AddMemberToChannelRequest(
    @SerializedName("userId")
    val userId: String,
)

data class UpdateServerBannerRequest(
    @SerializedName("banner")
    val banner: String? = null,
    @SerializedName("bannerColor")
    val bannerColor: String? = null,
    @SerializedName("resetBannerColor")
    val resetBannerColor: Boolean = false,
)

data class ServerAvatarUploadResponse(
    @SerializedName("avatar")
    val avatar: String? = null,
)

data class UpdateServerMemberNicknameRequest(
    @SerializedName("nickname")
    val nickname: String? = null,
)

data class MemberNicknameUpdatedEvent(
    @SerializedName("userId")
    val userId: Any? = null,
    @SerializedName("UserId")
    val userIdAlt: Any? = null,
    @SerializedName("nickname")
    val nickname: String? = null,
    @SerializedName("Nickname")
    val nicknameAlt: String? = null,
    @SerializedName("username")
    val username: String? = null,
    @SerializedName("Username")
    val usernameAlt: String? = null,
    @SerializedName("login")
    val login: String? = null,
    @SerializedName("Login")
    val loginAlt: String? = null,
) {
    val userIdValue: String
        get() = (userId ?: userIdAlt)?.toString().orEmpty()

    val nicknameValue: String?
        get() = (nickname ?: nicknameAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val usernameValue: String?
        get() = (username ?: usernameAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val loginValue: String?
        get() = (login ?: loginAlt)?.trim()?.takeIf { it.isNotEmpty() }
}
