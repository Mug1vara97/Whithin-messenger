package com.whithin.voice.domain.permissions

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object ServerPermissionKeys {
    const val VIEW_CHANNELS = "viewChannels"
    const val MANAGE_CHANNELS = "manageChannels"
    const val MANAGE_ROLES = "manageRoles"
    const val MANAGE_SERVER = "manageServer"
    const val CREATE_INVITES = "createInvites"
    const val CHANGE_OWN_NICKNAME = "changeOwnNickname"
    const val MANAGE_NICKNAMES = "manageNicknames"
    const val KICK_MEMBERS = "kickMembers"
    const val MUTE_MEMBERS = "muteMembers"
    const val BAN_MEMBERS = "banMembers"
    const val SEND_MESSAGES = "sendMessages"
    const val ATTACH_FILES = "attachFiles"
    const val MENTION_EVERYONE = "mentionEveryone"
    const val MANAGE_MESSAGES = "manageMessages"
    const val SEND_VOICE_MESSAGES = "sendVoiceMessages"
}

data class ServerPermissionCategory(
    val title: String,
    val permissions: List<String>,
)

object ServerPermissions {
    val categories: List<ServerPermissionCategory> =
        listOf(
            ServerPermissionCategory(
                title = "Основные разрешения",
                permissions =
                    listOf(
                        ServerPermissionKeys.VIEW_CHANNELS,
                        ServerPermissionKeys.MANAGE_CHANNELS,
                        ServerPermissionKeys.MANAGE_ROLES,
                        ServerPermissionKeys.MANAGE_SERVER,
                        ServerPermissionKeys.CREATE_INVITES,
                    ),
            ),
            ServerPermissionCategory(
                title = "Управление участниками",
                permissions =
                    listOf(
                        ServerPermissionKeys.CHANGE_OWN_NICKNAME,
                        ServerPermissionKeys.MANAGE_NICKNAMES,
                        ServerPermissionKeys.KICK_MEMBERS,
                        ServerPermissionKeys.MUTE_MEMBERS,
                        ServerPermissionKeys.BAN_MEMBERS,
                    ),
            ),
            ServerPermissionCategory(
                title = "Управление сообщениями",
                permissions =
                    listOf(
                        ServerPermissionKeys.SEND_MESSAGES,
                        ServerPermissionKeys.ATTACH_FILES,
                        ServerPermissionKeys.MENTION_EVERYONE,
                        ServerPermissionKeys.MANAGE_MESSAGES,
                        ServerPermissionKeys.SEND_VOICE_MESSAGES,
                    ),
            ),
        )

    val labels: Map<String, String> =
        mapOf(
            ServerPermissionKeys.VIEW_CHANNELS to "Просмотр каналов",
            ServerPermissionKeys.MANAGE_CHANNELS to "Управлять каналами",
            ServerPermissionKeys.MANAGE_ROLES to "Управлять ролями",
            ServerPermissionKeys.MANAGE_SERVER to "Управлять сервером",
            ServerPermissionKeys.CREATE_INVITES to "Создание приглашений",
            ServerPermissionKeys.CHANGE_OWN_NICKNAME to "Изменить свой никнейм",
            ServerPermissionKeys.MANAGE_NICKNAMES to "Управлять никнеймами",
            ServerPermissionKeys.KICK_MEMBERS to "Удаление участников",
            ServerPermissionKeys.MUTE_MEMBERS to "Отключение микрофона и звука",
            ServerPermissionKeys.BAN_MEMBERS to "Бан участников",
            ServerPermissionKeys.SEND_MESSAGES to "Отправлять сообщения",
            ServerPermissionKeys.ATTACH_FILES to "Прикреплять файлы",
            ServerPermissionKeys.MENTION_EVERYONE to "Упоминание @everyone",
            ServerPermissionKeys.MANAGE_MESSAGES to "Управление сообщениями",
            ServerPermissionKeys.SEND_VOICE_MESSAGES to "Отправлять голосовые сообщения",
        )

    private val gson = Gson()

    fun has(
        permissions: Map<String, Boolean>?,
        isOwner: Boolean,
        key: String,
    ): Boolean {
        if (isOwner) return true
        return permissions?.get(key) == true
    }

    fun canManageServer(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.MANAGE_SERVER)

    fun canManageRoles(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.MANAGE_ROLES)

    fun canKickMembers(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.KICK_MEMBERS)

    fun canCreateInvites(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.CREATE_INVITES)

    fun canManageChannels(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.MANAGE_CHANNELS)

    fun canSendMessages(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.SEND_MESSAGES)

    fun canManageMessages(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.MANAGE_MESSAGES)

    fun canChangeOwnNickname(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.CHANGE_OWN_NICKNAME)

    fun canManageNicknames(permissions: Map<String, Boolean>?, isOwner: Boolean) =
        has(permissions, isOwner, ServerPermissionKeys.MANAGE_NICKNAMES)

    fun parseJson(json: String?): Map<String, Boolean> {
        if (json.isNullOrBlank() || json == "{}") return emptyMap()
        return runCatching {
            val type = object : TypeToken<Map<String, Boolean>>() {}.type
            gson.fromJson<Map<String, Boolean>>(json, type) ?: emptyMap()
        }.getOrDefault(emptyMap())
    }

    fun toJson(permissions: Map<String, Boolean>): String = gson.toJson(permissions)
}
