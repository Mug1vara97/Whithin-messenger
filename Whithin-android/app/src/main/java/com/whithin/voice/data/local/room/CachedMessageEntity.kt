package com.whithin.voice.data.local.room

import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "cached_messages",
    primaryKeys = ["messageId"],
    indices = [
        Index(value = ["chatId"]),
        Index(value = ["chatId", "createdAtSort", "messageId"]),
    ],
)
data class CachedMessageEntity(
    val messageId: String,
    val chatId: String,
    val createdAtSort: Long,
    val payloadJson: String,
)
