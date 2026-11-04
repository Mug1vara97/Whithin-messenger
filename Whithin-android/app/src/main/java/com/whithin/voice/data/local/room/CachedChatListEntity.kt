package com.whithin.voice.data.local.room

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_chat_lists")
data class CachedChatListEntity(
    @PrimaryKey val userId: String,
    val payloadJson: String,
    val updatedAt: Long,
)
