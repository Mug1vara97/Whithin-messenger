package com.whithin.voice.data.local.room

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        CachedMessageEntity::class,
        CachedChatListEntity::class,
        CachedServerListEntity::class,
    ],
    version = 2,
    exportSchema = false,
)
abstract class WhithinDatabase : RoomDatabase() {
    abstract fun chatMessageDao(): ChatMessageDao
    abstract fun messengerListCacheDao(): MessengerListCacheDao
}
