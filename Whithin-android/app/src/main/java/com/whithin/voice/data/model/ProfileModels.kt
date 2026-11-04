package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class ProfileUploadResponse(
    val url: String? = null
)

data class UpdateProfileAvatarRequest(
    @SerializedName("UserId")
    val userId: String,
    @SerializedName("Avatar")
    val avatar: String
)

data class UpdateProfileBannerRequest(
    @SerializedName("UserId")
    val userId: String,
    @SerializedName("Banner")
    val banner: String
)

data class UpdateAvatarColorRequest(
    @SerializedName("UserId")
    val userId: String,
    @SerializedName("AvatarColor")
    val avatarColor: String,
)

data class UpdateAvatarDecorationRequest(
    @SerializedName("UserId")
    val userId: String,
    @SerializedName("AvatarDecoration")
    val avatarDecoration: String?,
)

data class ProfileUserRequest(
    @SerializedName("UserId")
    val userId: String,
)

data class UpdateDisplayNameRequest(
    @SerializedName("UserId")
    val userId: String,
    @SerializedName("DisplayName")
    val displayName: String?,
)

data class UpdateDisplayNameResponse(
    @SerializedName("username")
    val username: String? = null,
    @SerializedName("displayName")
    val displayName: String? = null,
)
