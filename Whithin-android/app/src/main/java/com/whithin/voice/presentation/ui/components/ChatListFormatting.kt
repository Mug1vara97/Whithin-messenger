package com.whithin.voice.presentation.ui.components

import com.whithin.voice.data.e2e.E2eEnvelope
import com.whithin.voice.util.formatCallLogText
import com.whithin.voice.util.parseCallLogPayload
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Текст превью последнего сообщения в списке чатов. */
fun formatChatListLastMessage(raw: String?): String? {
    val text = raw?.trim().orEmpty()
    if (text.isEmpty()) return null
    if (E2eEnvelope.isE2eEnvelope(text)) return "Зашифрованное сообщение"

    parseCallLogPayload(text)?.let { payload ->
        formatCallLogText(payload, currentUserId = "")?.let { return it }
    }

    val lower = text.lowercase(Locale.getDefault())
    when {
        lower.contains("\"contenttype\":\"video/") || lower.contains("\"contenttype\": \"video/") -> return "Видео"
        lower.contains("\"contenttype\":\"image/") || lower.contains("\"contenttype\": \"image/") -> return "Фото"
        lower.contains("\"contenttype\":\"audio/") || lower.contains("\"contenttype\": \"audio/") -> return "Аудио"
        lower.contains("\"contenttype\":\"application/") || lower.contains("\"contenttype\": \"application/") -> return "Файл"
        lower.startsWith("/uploads/") ||
            lower.contains("whithin.ru/uploads") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".png") ||
            lower.endsWith(".gif") ||
            lower.endsWith(".webp") -> return "Фото"
        lower.endsWith(".mp4") ||
            lower.endsWith(".webm") ||
            lower.endsWith(".mov") ||
            lower.endsWith(".mkv") -> return "Видео"
        lower.endsWith(".ogg") ||
            lower.endsWith(".mp3") ||
            lower.endsWith(".wav") ||
            lower.endsWith(".m4a") -> return "Аудио"
        lower.endsWith(".pdf") ||
            lower.endsWith(".doc") ||
            lower.endsWith(".docx") ||
            lower.endsWith(".xls") ||
            lower.endsWith(".xlsx") ||
            lower.endsWith(".zip") ||
            lower.endsWith(".rar") -> return "Файл"
        text.startsWith("http://") || text.startsWith("https://") -> {
            if (!text.contains(' ')) return "Ссылка"
        }
    }

    return text.replace('\n', ' ').replace(Regex("\\s+"), " ").trim().take(160)
}

/** Время последнего сообщения: «14:35», «Вчера», «12.03». */
fun formatChatListMessageTime(iso: String?): String? {
    val value = iso?.trim().orEmpty()
    if (value.isEmpty()) return null

    return try {
        val instant = Instant.parse(value)
        val zone = ZoneId.systemDefault()
        val messageDate = instant.atZone(zone).toLocalDate()
        val today = LocalDate.now(zone)

        when {
            messageDate == today ->
                DateTimeFormatter.ofPattern("HH:mm", Locale.getDefault()).format(instant.atZone(zone))
            messageDate == today.minusDays(1) -> "Вчера"
            messageDate.year == today.year ->
                DateTimeFormatter.ofPattern("dd.MM", Locale.getDefault()).format(instant.atZone(zone))
            else ->
                DateTimeFormatter.ofPattern("dd.MM.yy", Locale.getDefault()).format(instant.atZone(zone))
        }
    } catch (_: Exception) {
        null
    }
}
