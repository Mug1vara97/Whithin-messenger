package com.whithin.voice.data.local.room

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_server_lists")
data class CachedServerListEntity(
    @PrimaryKey val userId: String,
    val payloadJson: String,
    val updatedAt: Long,
)
