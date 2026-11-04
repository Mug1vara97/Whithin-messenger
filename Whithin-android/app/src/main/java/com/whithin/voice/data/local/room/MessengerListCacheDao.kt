package com.whithin.voice.data.local.room

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface MessengerListCacheDao {
    @Query("SELECT * FROM cached_chat_lists WHERE userId = :userId LIMIT 1")
    suspend fun getChatList(userId: String): CachedChatListEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveChatList(entity: CachedChatListEntity)

    @Query("DELETE FROM cached_chat_lists WHERE userId = :userId")
    suspend fun clearChatList(userId: String)

    @Query("SELECT * FROM cached_server_lists WHERE userId = :userId LIMIT 1")
    suspend fun getServerList(userId: String): CachedServerListEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveServerList(entity: CachedServerListEntity)

    @Query("DELETE FROM cached_server_lists WHERE userId = :userId")
    suspend fun clearServerList(userId: String)
}
