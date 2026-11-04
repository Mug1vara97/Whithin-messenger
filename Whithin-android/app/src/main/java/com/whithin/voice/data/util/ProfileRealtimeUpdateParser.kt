package com.whithin.voice.data.util

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.whithin.voice.data.model.ProfileRealtimeUpdate

object ProfileRealtimeUpdateParser {
    fun parse(payload: Any?, gson: Gson): ProfileRealtimeUpdate? {
        if (payload == null) return null
        return runCatching {
            val obj: JsonObject =
                when (payload) {
                    is JsonObject -> payload
                    else -> gson.toJsonTree(payload).asJsonObject
                }
            val userId =
                pick(obj, "userId", "UserId")?.trim().orEmpty()
            if (userId.isBlank()) return@runCatching null
            ProfileRealtimeUpdate(
                userId = userId,
                username = pick(obj, "username", "Username"),
                displayName = pick(obj, "displayName", "DisplayName"),
                avatar = pick(obj, "avatar", "Avatar"),
                avatarColor = pick(obj, "avatarColor", "AvatarColor"),
                banner = pick(obj, "banner", "Banner"),
                nameplate = pick(obj, "nameplate", "Nameplate"),
                avatarDecoration = pick(obj, "avatarDecoration", "AvatarDecoration"),
            )
        }.getOrNull()
    }

    private fun pick(obj: JsonObject, vararg keys: String): String? {
        for (key in keys) {
            val value = obj.get(key)?.takeIf { !it.isJsonNull }?.asString?.trim()
            if (!value.isNullOrBlank()) return value
        }
        return null
    }
}
