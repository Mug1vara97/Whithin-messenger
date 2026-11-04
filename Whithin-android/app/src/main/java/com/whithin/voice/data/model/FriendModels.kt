package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class FriendInfo(
    @SerializedName("userId")
    val userId: String?,
    @SerializedName("UserId")
    val userIdAlt: String? = null,
    @SerializedName("username")
    val username: String?,
    @SerializedName("Username")
    val usernameAlt: String? = null,
    @SerializedName("avatar")
    val avatar: String?,
    @SerializedName("Avatar")
    val avatarAlt: String? = null,
    @SerializedName("avatarColor")
    val avatarColor: String?,
    @SerializedName("AvatarColor")
    val avatarColorAlt: String? = null,
    @SerializedName("status")
    val status: Any? = null,
    @SerializedName("Status")
    val statusAlt: Any? = null,
    @SerializedName("lastSeen")
    val lastSeen: String?,
    @SerializedName("LastSeen")
    val lastSeenAlt: String? = null
) {
    val userIdValue: String
        get() = userId ?: userIdAlt ?: ""

    val usernameValue: String
        get() = username ?: usernameAlt ?: ""

    val avatarValue: String?
        get() = avatar ?: avatarAlt

    val avatarColorValue: String?
        get() = avatarColor ?: avatarColorAlt

    val statusValue: String
        get() = normalizePresenceWireValue(status ?: statusAlt)

    val lastSeenValue: String?
        get() = lastSeen ?: lastSeenAlt
}

data class FriendRequestInfo(
    @SerializedName("id")
    val id: String?,
    @SerializedName("Id")
    val idAlt: String? = null,
    @SerializedName("requesterId")
    val requesterId: String?,
    @SerializedName("RequesterId")
    val requesterIdAlt: String? = null,
    @SerializedName("addresseeId")
    val addresseeId: String?,
    @SerializedName("AddresseeId")
    val addresseeIdAlt: String? = null,
    @SerializedName("requesterUsername")
    val requesterUsername: String?,
    @SerializedName("RequesterUsername")
    val requesterUsernameAlt: String? = null,
    @SerializedName("requesterAvatar")
    val requesterAvatar: String?,
    @SerializedName("RequesterAvatar")
    val requesterAvatarAlt: String? = null,
    @SerializedName("requesterAvatarColor")
    val requesterAvatarColor: String?,
    @SerializedName("RequesterAvatarColor")
    val requesterAvatarColorAlt: String? = null,
    @SerializedName("createdAt")
    val createdAt: String?,
    @SerializedName("CreatedAt")
    val createdAtAlt: String? = null
) {
    val idValue: String
        get() = id ?: idAlt ?: ""

    val requesterIdValue: String
        get() = requesterId ?: requesterIdAlt ?: ""

    val addresseeIdValue: String
        get() = addresseeId ?: addresseeIdAlt ?: ""

    val requesterUsernameValue: String
        get() = requesterUsername ?: requesterUsernameAlt ?: ""

    val requesterAvatarValue: String?
        get() = requesterAvatar ?: requesterAvatarAlt

    val requesterAvatarColorValue: String?
        get() = requesterAvatarColor ?: requesterAvatarColorAlt

    val createdAtValue: String
        get() = createdAt ?: createdAtAlt ?: ""
}

data class FriendRequestsResponse(
    @SerializedName("pendingRequests")
    val pendingRequests: List<FriendRequestInfo>?,
    @SerializedName("sentRequests")
    val sentRequests: List<FriendRequestInfo>?
)
