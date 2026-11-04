package com.whithin.voice.data.model

enum class PresenceStatus(
    val wireValue: String,
    val label: String
) {
    ONLINE("online", "Онлайн"),
    INACTIVE("inactive", "Не активен"),
    DO_NOT_DISTURB("donotdisturb", "Не беспокоить"),
    OFFLINE("offline", "Не в сети");

    companion object {
        fun from(raw: Any?): PresenceStatus {
            val normalized = normalizePresenceWireValue(raw)
            return when (normalized) {
                "online" -> ONLINE
                "inactive", "away", "idle" -> INACTIVE
                "donotdisturb", "dnd", "busy" -> DO_NOT_DISTURB
                else -> OFFLINE
            }
        }
    }
}

fun normalizePresenceWireValue(raw: Any?): String {
    return when (raw) {
        null -> "offline"
        is Number ->
            when (raw.toInt()) {
                0 -> "online"
                1 -> "inactive"
                2 -> "donotdisturb"
                3 -> "offline"
                else -> "offline"
            }
        is String -> {
            val value = raw.trim()
            if (value.isBlank()) return "offline"
            when (value) {
                "0" -> "online"
                "1" -> "inactive"
                "2" -> "donotdisturb"
                "3" -> "offline"
                else ->
                    value
                        .lowercase()
                        .replace("_", "")
                        .replace("-", "")
                        .replace(" ", "")
            }
        }
        else -> "offline"
    }
}
