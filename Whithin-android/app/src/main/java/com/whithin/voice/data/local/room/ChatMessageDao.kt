package com.whithin.voice.data.local.room

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatMessageDao {
    @Query(
        """
        SELECT * FROM cached_messages
        WHERE chatId = :chatId
        ORDER BY createdAtSort ASC, messageId ASC
        """,
    )
    fun observeByChatId(chatId: String): Flow<List<CachedMessageEntity>>

    @Query(
        """
        SELECT * FROM cached_messages
        WHERE chatId = :chatId
        ORDER BY createdAtSort ASC, messageId ASC
        """,
    )
    suspend fun getByChatId(chatId: String): List<CachedMessageEntity>

    @Query("SELECT COUNT(*) FROM cached_messages WHERE chatId = :chatId")
    suspend fun countByChatId(chatId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<CachedMessageEntity>)

    @Query("DELETE FROM cached_messages WHERE chatId = :chatId")
    suspend fun deleteByChatId(chatId: String)

    @Query("DELETE FROM cached_messages WHERE messageId = :messageId")
    suspend fun deleteByMessageId(messageId: String)

    @Query("SELECT chatId FROM cached_messages WHERE messageId = :messageId LIMIT 1")
    suspend fun getChatIdForMessage(messageId: String): String?

    @Query("DELETE FROM cached_messages")
    suspend fun deleteAll()

    @Transaction
    suspend fun replaceChatMessages(chatId: String, entities: List<CachedMessageEntity>) {
        deleteByChatId(chatId)
        if (entities.isNotEmpty()) {
            insertAll(entities)
        }
    }

    @Query(
        """
        DELETE FROM cached_messages WHERE messageId IN (
            SELECT messageId FROM cached_messages
            WHERE chatId = :chatId
            ORDER BY createdAtSort ASC, messageId ASC
            LIMIT :count
        )
        """,
    )
    suspend fun deleteOldestForChat(chatId: String, count: Int)

    @Transaction
    suspend fun upsertChatMessages(
        chatId: String,
        entities: List<CachedMessageEntity>,
        maxMessages: Int,
    ) {
        if (entities.isEmpty()) return
        insertAll(entities)
        val total = countByChatId(chatId)
        val excess = total - maxMessages
        if (excess > 0) {
            deleteOldestForChat(chatId, excess)
        }
    }
}
