package com.whithin.voice.data.local

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.whithin.voice.data.local.room.ChatMessageDao
import com.whithin.voice.data.local.room.toCachedEntities
import com.whithin.voice.data.local.room.toMessages
import com.whithin.voice.data.model.Message
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

private val Context.chatCacheDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "chat_messages_cache_prefs",
)

/**
 * Room-backed cache of recent chat transcripts for instant open before SignalR finishes.
 */
@Singleton
class ChatMessagesLocalStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson,
    private val dao: ChatMessageDao,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val migrationMutex = Mutex()

    init {
        scope.launch {
            migrateLegacyJsonCacheIfNeeded()
        }
    }

    fun observeMessages(chatId: String): Flow<List<Message>> {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return flowOf(emptyList())
        return dao.observeByChatId(normalized)
            .map { entities -> entities.toMessages(gson) }
            .distinctUntilChanged()
    }

    suspend fun loadMessages(chatId: String): List<Message> = withContext(Dispatchers.IO) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return@withContext emptyList()
        dao.getByChatId(normalized).toMessages(gson)
    }

    suspend fun hasMessages(chatId: String): Boolean = withContext(Dispatchers.IO) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return@withContext false
        dao.countByChatId(normalized) > 0
    }

    suspend fun saveMessages(chatId: String, messages: List<Message>) = withContext(Dispatchers.IO) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return@withContext
        try {
            val trimmed =
                if (messages.size > MAX_MESSAGES) {
                    messages
                        .sortedBy { it.createdAtValue }
                        .takeLast(MAX_MESSAGES)
                } else {
                    messages
                }
            val entities = trimmed.toCachedEntities(gson, normalized)
            dao.replaceChatMessages(normalized, entities)
        } catch (e: Exception) {
            Log.w(TAG, "saveMessages failed chatId=$normalized", e)
        }
    }

    suspend fun clearAll() = withContext(Dispatchers.IO) {
        try {
            dao.deleteAll()
        } catch (e: Exception) {
            Log.w(TAG, "clearAll failed", e)
        }
    }

    suspend fun clearChat(chatId: String) = withContext(Dispatchers.IO) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return@withContext
        try {
            dao.deleteByChatId(normalized)
        } catch (e: Exception) {
            Log.w(TAG, "clearChat failed chatId=$normalized", e)
        }
    }

    suspend fun findChatIdForMessage(messageId: String): String? =
        withContext(Dispatchers.IO) {
            val normalized = messageId.trim().trim('"')
            if (normalized.isBlank()) return@withContext null
            try {
                dao.getChatIdForMessage(normalized)?.trim()?.takeIf { it.isNotBlank() }
            } catch (e: Exception) {
                Log.w(TAG, "findChatIdForMessage failed messageId=$normalized", e)
                null
            }
        }

    suspend fun removeMessage(messageId: String) = withContext(Dispatchers.IO) {
        val normalized = messageId.trim().trim('"')
        if (normalized.isBlank()) return@withContext
        try {
            dao.deleteByMessageId(normalized)
        } catch (e: Exception) {
            Log.w(TAG, "removeMessage failed messageId=$normalized", e)
        }
    }

    private suspend fun migrateLegacyJsonCacheIfNeeded() {
        migrationMutex.withLock {
            val migrated = context.chatCacheDataStore.data.first()[LEGACY_JSON_MIGRATED_KEY] == true
            if (migrated) return

            val cacheRoot = File(context.filesDir, LEGACY_JSON_DIR)
            if (cacheRoot.exists()) {
                cacheRoot.listFiles()?.forEach { file ->
                    if (!file.isFile || !file.name.endsWith(".json")) return@forEach
                    val chatId = file.name.removeSuffix(".json").trim()
                    if (chatId.isBlank()) return@forEach
                    runCatching {
                        val type = object : TypeToken<List<Message>>() {}.type
                        val messages: List<Message> =
                            gson.fromJson(file.readText(), type) ?: emptyList()
                        if (messages.isNotEmpty()) {
                            saveMessages(chatId, messages)
                        }
                        file.delete()
                    }.onFailure { e ->
                        Log.w(TAG, "legacy migrate failed chatId=$chatId", e)
                    }
                }
                runCatching { cacheRoot.delete() }
            }

            context.chatCacheDataStore.edit { prefs ->
                prefs[LEGACY_JSON_MIGRATED_KEY] = true
            }
        }
    }

    companion object {
        private const val TAG = "ChatMessagesLocalStore"
        private const val MAX_MESSAGES = 800
        private const val LEGACY_JSON_DIR = "chat_messages_cache"
        private val LEGACY_JSON_MIGRATED_KEY = booleanPreferencesKey("legacy_json_cache_migrated")
    }
}
