package com.whithin.voice.data.local.room

import com.google.gson.Gson
import com.whithin.voice.data.model.Message
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

internal fun Message.toCachedEntity(gson: Gson, chatId: String): CachedMessageEntity? {
    val id = messageIdValue.trim()
    if (id.isBlank()) return null
    val normalizedChatId = chatId.trim().ifBlank { chatIdValue.trim() }
    if (normalizedChatId.isBlank()) return null
    return CachedMessageEntity(
        messageId = id,
        chatId = normalizedChatId,
        createdAtSort = createdAtEpoch(),
        payloadJson = gson.toJson(this),
    )
}

internal fun CachedMessageEntity.toMessage(gson: Gson): Message? {
    return try {
        gson.fromJson(payloadJson, Message::class.java)
    } catch (_: Exception) {
        null
    }
}

internal fun List<Message>.toCachedEntities(gson: Gson, chatId: String): List<CachedMessageEntity> {
    return mapNotNull { it.toCachedEntity(gson, chatId) }
        .distinctBy { it.messageId }
        .sortedWith(compareBy({ it.createdAtSort }, { it.messageId }))
}

internal fun List<CachedMessageEntity>.toMessages(gson: Gson): List<Message> {
    return mapNotNull { it.toMessage(gson) }
}

private fun Message.createdAtEpoch(): Long {
    val raw = createdAtValue.trim()
    if (raw.isEmpty()) return 0L
    parseInstant(raw)?.let { return it }
    return raw.hashCode().toLong()
}

private fun parseInstant(raw: String): Long? {
    return try {
        Instant.parse(raw).toEpochMilli()
    } catch (_: DateTimeParseException) {
        try {
            OffsetDateTime.parse(raw, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toInstant().toEpochMilli()
        } catch (_: DateTimeParseException) {
            try {
                OffsetDateTime.parse(raw).toInstant().toEpochMilli()
            } catch (_: DateTimeParseException) {
                null
            }
        }
    }
}
