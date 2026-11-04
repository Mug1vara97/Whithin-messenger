package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class UpdateUserStatusRequest(
    @SerializedName("status")
    val status: String
)

data class UserStatusResponse(
    @SerializedName("userId")
    val userId: String?,
    @SerializedName("status")
    val status: String?,
    @SerializedName("lastSeen")
    val lastSeen: String?
)

data class UserStatusChangedEvent(
    @SerializedName("userId")
    val userId: String?,
    @SerializedName("status")
    val status: String?,
    @SerializedName("lastSeen")
    val lastSeen: String?
) {
    val userIdValue: String
        get() = userId ?: ""

    val statusValue: String
        get() = status ?: "offline"

    val lastSeenValue: String?
        get() = lastSeen
}
