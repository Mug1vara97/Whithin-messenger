package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class AuditLogResponse(
    @SerializedName("entries")
    val entries: List<AuditLogEntry>? = null,
    @SerializedName("totalCount")
    val totalCount: Int = 0,
    @SerializedName("page")
    val page: Int = 1,
    @SerializedName("pageSize")
    val pageSize: Int = 50,
)

data class AuditLogEntry(
    @SerializedName("id")
    val id: Any? = null,
    @SerializedName("actionType")
    val actionType: String? = null,
    @SerializedName("actionLabel")
    val actionLabel: String? = null,
    @SerializedName("targetType")
    val targetType: String? = null,
    @SerializedName("targetId")
    val targetId: Any? = null,
    @SerializedName("targetName")
    val targetName: String? = null,
    @SerializedName("detail")
    val detail: String? = null,
    @SerializedName("userId")
    val userId: Any? = null,
    @SerializedName("username")
    val username: String? = null,
    @SerializedName("avatar")
    val avatar: String? = null,
    @SerializedName("avatarColor")
    val avatarColor: String? = null,
    @SerializedName("createdAt")
    val createdAt: String? = null,
) {
    val idValue: String
        get() = id?.toString().orEmpty()

    val usernameValue: String
        get() = username?.trim()?.takeIf { it.isNotEmpty() } ?: "Unknown"

    val actionLabelValue: String
        get() = actionLabel?.trim()?.takeIf { it.isNotEmpty() } ?: actionType.orEmpty()

    val targetText: String
        get() =
            buildList {
                targetName?.trim()?.takeIf { it.isNotEmpty() }?.let { add(it) }
                detail?.trim()?.takeIf { it.isNotEmpty() }?.let { add(it) }
            }.joinToString(" · ").ifBlank { "—" }
}
