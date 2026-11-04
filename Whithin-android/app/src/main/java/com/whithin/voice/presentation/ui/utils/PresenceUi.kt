package com.whithin.voice.presentation.ui.utils

import androidx.compose.ui.graphics.Color
import com.whithin.voice.data.model.PresenceStatus
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

fun presenceColor(status: Any?): Color {
    return when (PresenceStatus.from(status)) {
        PresenceStatus.ONLINE -> Color(0xFF43B581)
        PresenceStatus.INACTIVE -> Color(0xFFF0B232)
        PresenceStatus.DO_NOT_DISTURB -> Color(0xFFF23F43)
        PresenceStatus.OFFLINE -> Color(0xFF80848E)
    }
}

fun formatPresenceLabel(status: Any?, lastSeen: String?, nowMillis: Long = System.currentTimeMillis()): String {
    return when (PresenceStatus.from(status)) {
        PresenceStatus.ONLINE -> "в сети"
        PresenceStatus.INACTIVE -> "неактивен"
        PresenceStatus.DO_NOT_DISTURB -> "не беспокоить"
        PresenceStatus.OFFLINE -> formatLastSeenLabel(lastSeen, nowMillis)
    }
}

private fun formatLastSeenLabel(raw: String?, nowMillis: Long): String {
    val value = raw?.trim().orEmpty()
    if (value.isBlank()) return "не в сети"
    val instant =
        runCatching { Instant.parse(value) }.getOrNull()
            ?: runCatching { java.time.OffsetDateTime.parse(value).toInstant() }.getOrNull()
            ?: return "был(а) недавно"
    val dateTime = instant.atZone(ZoneId.systemDefault())
    val now = Instant.ofEpochMilli(nowMillis).atZone(ZoneId.systemDefault())
    val date = dateTime.toLocalDate()
    return when {
        date == now.toLocalDate() ->
            "был(а) сегодня в ${dateTime.format(DateTimeFormatter.ofPattern("HH:mm"))}"
        date == now.toLocalDate().minusDays(1) ->
            "был(а) вчера в ${dateTime.format(DateTimeFormatter.ofPattern("HH:mm"))}"
        date.year == now.year ->
            "был(а) ${dateTime.format(DateTimeFormatter.ofPattern("d MMM в HH:mm", Locale("ru")))}"
        else ->
            "был(а) ${dateTime.format(DateTimeFormatter.ofPattern("dd.MM.yyyy в HH:mm"))}"
    }
}
