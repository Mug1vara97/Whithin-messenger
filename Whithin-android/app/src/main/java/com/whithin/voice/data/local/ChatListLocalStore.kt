package com.whithin.voice.data.local

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.whithin.voice.data.local.room.CachedChatListEntity
import com.whithin.voice.data.local.room.MessengerListCacheDao
import com.whithin.voice.data.model.ChatInfo
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class ChatListLocalStore @Inject constructor(
    private val dao: MessengerListCacheDao,
    private val gson: Gson,
) {
    private val listType = object : TypeToken<List<ChatInfo>>() {}.type

    suspend fun getLastUpdatedAt(userId: String): Long = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank()) return@withContext 0L
        dao.getChatList(normalized)?.updatedAt ?: 0L
    }

    suspend fun loadChats(userId: String): List<ChatInfo> = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank()) return@withContext emptyList()
        val row = dao.getChatList(normalized) ?: return@withContext emptyList()
        runCatching { gson.fromJson<List<ChatInfo>>(row.payloadJson, listType) }
            .getOrNull()
            .orEmpty()
    }

    suspend fun saveChats(userId: String, chats: List<ChatInfo>) = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank() || chats.isEmpty()) return@withContext
        dao.saveChatList(
            CachedChatListEntity(
                userId = normalized,
                payloadJson = gson.toJson(chats),
                updatedAt = System.currentTimeMillis(),
            ),
        )
    }

    suspend fun clear(userId: String) = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank()) return@withContext
        dao.clearChatList(normalized)
    }
}
