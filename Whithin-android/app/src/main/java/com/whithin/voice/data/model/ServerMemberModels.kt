package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class ServerMemberInfo(
    @SerializedName("userId")
    val userId: Any? = null,
    @SerializedName("UserId")
    val userIdAlt: Any? = null,
    @SerializedName("username")
    val username: String? = null,
    @SerializedName("Username")
    val usernameAlt: String? = null,
    @SerializedName("login")
    val login: String? = null,
    @SerializedName("Login")
    val loginAlt: String? = null,
    @SerializedName("nickname")
    val nickname: String? = null,
    @SerializedName("Nickname")
    val nicknameAlt: String? = null,
    @SerializedName("avatar")
    val avatar: String? = null,
    @SerializedName("Avatar")
    val avatarAlt: String? = null,
    @SerializedName("avatarColor")
    val avatarColor: String? = null,
    @SerializedName("AvatarColor")
    val avatarColorAlt: String? = null,
    @SerializedName("userStatus")
    val userStatus: String? = null,
    @SerializedName("UserStatus")
    val userStatusAlt: String? = null,
    @SerializedName("roles")
    val roles: List<ServerMemberRoleInfo>? = null,
    @SerializedName("Roles")
    val rolesAlt: List<ServerMemberRoleInfo>? = null,
    @SerializedName("nameplate")
    val nameplate: String? = null,
    @SerializedName("Nameplate")
    val nameplateAlt: String? = null,
    @SerializedName("avatarDecoration")
    val avatarDecoration: String? = null,
    @SerializedName("AvatarDecoration")
    val avatarDecorationAlt: String? = null,
) {
    val userIdValue: String
        get() = (userId ?: userIdAlt)?.toString().orEmpty()

    val usernameValue: String
        get() = username ?: usernameAlt ?: "Участник"

    val loginValue: String?
        get() = (login ?: loginAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val nicknameValue: String?
        get() = (nickname ?: nicknameAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val avatarPathValue: String?
        get() = (avatar ?: avatarAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val avatarColorValue: String?
        get() = (avatarColor ?: avatarColorAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val nameplateValue: String?
        get() = (nameplate ?: nameplateAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val avatarDecorationValue: String?
        get() = (avatarDecoration ?: avatarDecorationAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val rolesValue: List<ServerMemberRoleInfo>
        get() = roles ?: rolesAlt ?: emptyList()
}

data class ServerMemberRoleInfo(
    @SerializedName("roleId")
    val roleId: Any? = null,
    @SerializedName("RoleId")
    val roleIdAlt: Any? = null,
    @SerializedName("roleName")
    val roleName: String? = null,
    @SerializedName("RoleName")
    val roleNameAlt: String? = null,
    @SerializedName("color")
    val color: String? = null,
    @SerializedName("Color")
    val colorAlt: String? = null,
) {
    val roleIdValue: String
        get() = (roleId ?: roleIdAlt)?.toString().orEmpty()

    val roleNameValue: String
        get() = roleName ?: roleNameAlt ?: "Роль"

    val colorValue: String
        get() = (color ?: colorAlt)?.trim()?.takeIf { it.isNotEmpty() } ?: "#99AAB5"
}

data class ServerRoleInfo(
    @SerializedName("roleId")
    val roleId: Any? = null,
    @SerializedName("RoleId")
    val roleIdAlt: Any? = null,
    @SerializedName("roleName")
    val roleName: String? = null,
    @SerializedName("RoleName")
    val roleNameAlt: String? = null,
    @SerializedName("color")
    val color: String? = null,
    @SerializedName("Color")
    val colorAlt: String? = null,
    @SerializedName("permissions")
    val permissions: String? = null,
    @SerializedName("Permissions")
    val permissionsAlt: String? = null,
) {
    val roleIdValue: String
        get() = (roleId ?: roleIdAlt)?.toString().orEmpty()

    val roleNameValue: String
        get() = roleName ?: roleNameAlt ?: "Роль"

    val colorValue: String
        get() = (color ?: colorAlt)?.trim()?.takeIf { it.isNotEmpty() } ?: "#5865F2"

    val permissionsValue: String
        get() = permissions ?: permissionsAlt ?: "{}"
}
