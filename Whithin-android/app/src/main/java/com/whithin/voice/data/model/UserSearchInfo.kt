package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class UserSearchInfo(
    @SerializedName("userId")
    val userId: String?,
    @SerializedName("UserId")
    val userIdAlt: String? = null,
    @SerializedName("username")
    val username: String?,
    @SerializedName("Username")
    val usernameAlt: String? = null,
    @SerializedName("avatarUrl")
    val avatarUrl: String?,
    @SerializedName("AvatarUrl")
    val avatarUrlAlt: String? = null,
    @SerializedName("avatarColor")
    val avatarColor: String?,
    @SerializedName("AvatarColor")
    val avatarColorAlt: String? = null,
    @SerializedName("userStatus")
    val userStatus: String?,
    @SerializedName("UserStatus")
    val userStatusAlt: String? = null,
    @SerializedName("lastSeen")
    val lastSeen: String?,
    @SerializedName("LastSeen")
    val lastSeenAlt: String? = null,
    @SerializedName("hasExistingChat")
    val hasExistingChat: Boolean?,
    @SerializedName("HasExistingChat")
    val hasExistingChatAlt: Boolean? = null,
    @SerializedName("isFriend")
    val isFriend: Boolean?,
    @SerializedName("IsFriend")
    val isFriendAlt: Boolean? = null,
    @SerializedName("friendshipStatus")
    val friendshipStatus: String?,
    @SerializedName("FriendshipStatus")
    val friendshipStatusAlt: String? = null
) {
    val userIdValue: String
        get() = userId ?: userIdAlt ?: ""
    
    val usernameValue: String
        get() = username ?: usernameAlt ?: ""
    
    val avatarUrlValue: String?
        get() = avatarUrl ?: avatarUrlAlt
    
    val avatarColorValue: String?
        get() = avatarColor ?: avatarColorAlt
    
    val userStatusValue: String
        get() = normalizePresenceWireValue(userStatus ?: userStatusAlt)
    
    val lastSeenValue: String?
        get() = lastSeen ?: lastSeenAlt
    
    val hasExistingChatValue: Boolean
        get() = hasExistingChat ?: hasExistingChatAlt ?: false
    
    val isFriendValue: Boolean
        get() = isFriend ?: isFriendAlt ?: false
    
    val friendshipStatusValue: String?
        get() = friendshipStatus ?: friendshipStatusAlt
}
