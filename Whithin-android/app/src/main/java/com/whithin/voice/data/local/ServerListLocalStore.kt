package com.whithin.voice.data.local

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.whithin.voice.data.local.room.CachedServerListEntity
import com.whithin.voice.data.local.room.MessengerListCacheDao
import com.whithin.voice.data.model.Server
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class ServerListLocalStore @Inject constructor(
    private val dao: MessengerListCacheDao,
    private val gson: Gson,
) {
    private val listType = object : TypeToken<List<Server>>() {}.type

    suspend fun getLastUpdatedAt(userId: String): Long = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank()) return@withContext 0L
        dao.getServerList(normalized)?.updatedAt ?: 0L
    }

    suspend fun loadServers(userId: String): List<Server> = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank()) return@withContext emptyList()
        val row = dao.getServerList(normalized) ?: return@withContext emptyList()
        runCatching { gson.fromJson<List<Server>>(row.payloadJson, listType) }
            .getOrNull()
            .orEmpty()
    }

    suspend fun saveServers(userId: String, servers: List<Server>) = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank() || servers.isEmpty()) return@withContext
        dao.saveServerList(
            CachedServerListEntity(
                userId = normalized,
                payloadJson = gson.toJson(servers),
                updatedAt = System.currentTimeMillis(),
            ),
        )
    }

    suspend fun clear(userId: String) = withContext(Dispatchers.IO) {
        val normalized = userId.trim()
        if (normalized.isBlank()) return@withContext
        dao.clearServerList(normalized)
    }
}
