package com.whithin.voice.util

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

data class CallLogPayload(
    @SerializedName("callEvent") val callEvent: String = "",
    @SerializedName("callerId") val callerId: String = "",
    @SerializedName("callerName") val callerName: String = "",
    @SerializedName("durationSeconds") val durationSeconds: Int = 0,
)

private val gson = Gson()

fun parseCallLogPayload(content: String?): CallLogPayload? {
    if (content.isNullOrBlank()) return null
    return runCatching { gson.fromJson(content, CallLogPayload::class.java) }.getOrNull()
}

fun formatCallDuration(seconds: Int): String {
    val total = seconds.coerceAtLeast(0)
    if (total < 60) {
        return if (total <= 5) "несколько секунд" else "$total сек"
    }
    val minutes = total / 60
    val remainder = total % 60
    val minuteLabel =
        when {
            minutes % 10 == 1 && minutes % 100 != 11 -> "$minutes минуту"
            minutes % 10 in 2..4 && (minutes % 100 < 10 || minutes % 100 >= 20) -> "$minutes минуты"
            else -> "$minutes минут"
        }
    return if (remainder == 0) minuteLabel else "$minuteLabel $remainder сек"
}

fun formatCallLogText(payload: CallLogPayload, currentUserId: String): String? {
    val callerName = payload.callerName.ifBlank { "Пользователь" }
    val duration = formatCallDuration(payload.durationSeconds)
    val isCaller = payload.callerId.isNotBlank() &&
        payload.callerId.equals(currentUserId, ignoreCase = true)

    return when (payload.callEvent) {
        "missed" ->
            if (isCaller) {
                "Собеседник пропустил ваш звонок, который длился $duration"
            } else {
                "Вы пропустили звонок от $callerName, который длился $duration"
            }
        "completed" ->
            if (isCaller) {
                "Вы начали звонок, который продлился $duration"
            } else {
                "$callerName начал звонок, который продлился $duration"
            }
        else -> null
    }
}

const val CALL_RING_TIMEOUT_MS = 180_000L
