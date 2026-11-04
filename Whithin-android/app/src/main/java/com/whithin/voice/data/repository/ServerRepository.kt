package com.whithin.voice.data.repository

import android.os.SystemClock
import android.util.Log
import com.whithin.voice.data.api.ServerApi
import com.whithin.voice.data.local.ServerListLocalStore
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.model.Server
import com.whithin.voice.data.signalr.ServerListHub
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import com.whithin.voice.util.ListLoadPerfLog
import com.whithin.voice.util.ListSyncPolicy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ServerRepository @Inject constructor(
    private val serverListHub: ServerListHub,
    private val serverApi: ServerApi,
    private val serverListLocalStore: ServerListLocalStore,
    private val tokenManager: TokenManager,
) {
    private val _servers = MutableStateFlow<List<Server>>(emptyList())
    val servers: StateFlow<List<Server>> = _servers.asStateFlow()
    
    val isConnected: StateFlow<Boolean> = serverListHub.isConnected
    
    private var currentUserId: String? = null
    private val callbackScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val cacheWarmMutex = Mutex()
    private val hubConnectMutex = Mutex()
    @Volatile
    private var hubConnectJob: Deferred<Result<Unit>>? = null
    @Volatile
    private var hubConnectUserId: String? = null
    @Volatile
    private var serversFetchJob: Deferred<Result<List<Server>>>? = null
    @Volatile
    private var lastServersFetchAtMs = 0L
    @Volatile
    private var lastRoomServersSyncAtMs = 0L
    private val serversFetchMutex = Mutex()

    init {
        ioScope.launch {
            _servers
                .debounce(250)
                .collect { servers ->
                    if (servers.isEmpty()) return@collect
                    val userId = tokenManager.getUserFromToken()?.id?.trim().orEmpty()
                    if (userId.isBlank()) return@collect
                    serverListLocalStore.saveServers(userId, servers)
                }
        }
    }

    suspend fun warmFromCache() {
        cacheWarmMutex.withLock {
            if (_servers.value.isNotEmpty()) return
            val userId = tokenManager.getUserFromToken()?.id?.trim().orEmpty()
            if (userId.isBlank()) return
            lastRoomServersSyncAtMs = serverListLocalStore.getLastUpdatedAt(userId)
            val startedAt = android.os.SystemClock.elapsedRealtime()
            val cached = serverListLocalStore.loadServers(userId)
            if (cached.isNotEmpty()) {
                _servers.value = cached
                val elapsed = android.os.SystemClock.elapsedRealtime() - startedAt
                Log.d("ServerRepository", "Hydrated ${cached.size} servers from local cache")
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.SERVERS,
                    "room_cache",
                    "count=${cached.size} roomMs=$elapsed",
                )
                ListLoadPerfLog.endCacheReady(ListLoadPerfLog.SERVERS, cached.size)
            }
        }
    }

    suspend fun prefetchServersIfNeeded() {
        val userId = tokenManager.getUserFromToken()?.id?.trim().orEmpty()
        if (userId.isBlank()) return
        currentUserId = userId
        if (shouldSkipRestFetch()) {
            ListLoadPerfLog.mark(
                ListLoadPerfLog.SERVERS,
                "early_rest_skip_fresh",
                "roomAgeMs=${ListSyncPolicy.roomAgeMs(lastRoomServersSyncAtMs)} count=${_servers.value.size}",
            )
            return
        }
        ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "early_rest_prefetch")
        fetchUserServers(force = false)
    }

    fun shouldSkipHubListRequest(): Boolean = shouldSkipRestFetch()

    private fun shouldSkipRestFetch(): Boolean {
        if (_servers.value.isEmpty()) return false
        if (ListSyncPolicy.isRoomFresh(lastRoomServersSyncAtMs)) return true
        val memAge = SystemClock.elapsedRealtime() - lastServersFetchAtMs
        return lastServersFetchAtMs > 0L &&
            memAge < SERVERS_FETCH_COOLDOWN_MS &&
            _servers.value.isNotEmpty()
    }

    private fun markServersRestSynced() {
        lastServersFetchAtMs = SystemClock.elapsedRealtime()
        lastRoomServersSyncAtMs = System.currentTimeMillis()
    }

    suspend fun fetchUserServers(force: Boolean = false): Result<List<Server>> {
        if (!force && shouldSkipRestFetch()) {
            val tag =
                if (ListSyncPolicy.isRoomFresh(lastRoomServersSyncAtMs)) {
                    "rest_skip_room_fresh"
                } else {
                    "rest_skip_cooldown"
                }
            ListLoadPerfLog.mark(
                ListLoadPerfLog.SERVERS,
                tag,
                "roomAgeMs=${ListSyncPolicy.roomAgeMs(lastRoomServersSyncAtMs)} count=${_servers.value.size}",
            )
            return Result.success(_servers.value)
        }
        val job =
            serversFetchMutex.withLock {
                serversFetchJob?.takeIf { it.isActive }
                    ?: ioScope.async { fetchUserServersInternal() }.also { serversFetchJob = it }
            }
        return job.await().also { result ->
            if (result.isSuccess) {
                markServersRestSynced()
            }
        }
    }

    private suspend fun fetchUserServersInternal(): Result<List<Server>> {
        return try {
            ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "rest_start")
            val restStartedAt = SystemClock.elapsedRealtime()
            val response = serverApi.getUserServers()
            val restMs = SystemClock.elapsedRealtime() - restStartedAt
            if (response.isSuccessful && response.body() != null) {
                val servers = response.body()!!
                _servers.value = servers
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.SERVERS,
                    "rest_ok",
                    "count=${servers.size} restMs=$restMs",
                )
                ListLoadPerfLog.endSyncReady(ListLoadPerfLog.SERVERS, "rest", servers.size)
                Result.success(servers)
            } else {
                val cached = _servers.value
                if (cached.isNotEmpty()) {
                    ListLoadPerfLog.mark(
                        ListLoadPerfLog.SERVERS,
                        "rest_fail_use_cache",
                        "code=${response.code()} count=${cached.size} restMs=$restMs",
                    )
                    return Result.success(cached)
                }
                ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "rest_fail", "code=${response.code()} restMs=$restMs")
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to get servers"))
            }
        } catch (e: Exception) {
            val cached = _servers.value
            if (cached.isNotEmpty()) {
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.SERVERS,
                    "rest_error_use_cache",
                    "count=${cached.size} err=${e.message.orEmpty()}",
                )
                return Result.success(cached)
            }
            ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "rest_error", e.message.orEmpty())
            Result.failure(e)
        }
    }

    suspend fun connectSignalR(userId: String): Result<Unit> {
        if (serverListHub.isConnected.value && currentUserId == userId) {
            Log.d("ServerRepository", "Already connected for userId: $userId")
            return Result.success(Unit)
        }
        val job =
            hubConnectMutex.withLock {
                hubConnectJob?.takeIf { it.isActive }?.also {
                    Log.d("ServerRepository", "connectSignalR: joining in-flight hub connect")
                    ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "hub_connect_join_inflight")
                }
                    ?: ioScope.async { connectSignalRInternal(userId) }.also {
                        hubConnectJob = it
                        hubConnectUserId = userId.trim()
                    }
            }
        return try {
            job.await()
        } finally {
            hubConnectMutex.withLock {
                if (hubConnectJob === job) {
                    hubConnectJob = null
                    hubConnectUserId = null
                }
            }
        }
    }

    /** Connected or connect already in flight for this user (e.g. after [ColdStartBootstrap]). */
    fun isHubSessionWarm(userId: String): Boolean {
        val id = userId.trim()
        if (id.isBlank()) return false
        if (serverListHub.isConnected.value && currentUserId == id) return true
        return hubConnectJob?.isActive == true && hubConnectUserId == id
    }

    private suspend fun connectSignalRInternal(userId: String): Result<Unit> {
        return try {
            currentUserId = userId
            Log.d("ServerRepository", "Connecting to SignalR for userId: $userId")
            
            // Set up callbacks - use callbackScope to ensure updates happen on main thread
            serverListHub.setOnServersReceived { serverList ->
                callbackScope.launch {
                    Log.d("ServerRepository", "SignalR: Received ${serverList.size} servers")
                    ListLoadPerfLog.mark(
                        ListLoadPerfLog.SERVERS,
                        "hub_list_received",
                        "count=${serverList.size}",
                    )
                    ListLoadPerfLog.endSyncReady(ListLoadPerfLog.SERVERS, "hub", serverList.size)
                    _servers.value = serverList
                }
            }
            
            serverListHub.setOnServerCreated { server ->
                callbackScope.launch {
                    Log.d("ServerRepository", "SignalR: Server created - ${server.serverIdValue}")
                    val currentServers = _servers.value.toMutableList()
                    if (!currentServers.any { it.serverIdValue == server.serverIdValue }) {
                        currentServers.add(server)
                        _servers.value = currentServers
                    }
                }
            }
            
            serverListHub.setOnServerJoined { server ->
                callbackScope.launch {
                    Log.d("ServerRepository", "SignalR: Server joined - ${server.serverIdValue}")
                    val currentServers = _servers.value.toMutableList()
                    if (!currentServers.any { it.serverIdValue == server.serverIdValue }) {
                        currentServers.add(server)
                        _servers.value = currentServers
                    }
                }
            }
            
            serverListHub.setOnServerLeft { serverId ->
                callbackScope.launch {
                    Log.d("ServerRepository", "SignalR: Server left - $serverId")
                    val currentServers = _servers.value.toMutableList()
                    currentServers.removeAll { it.serverIdValue == serverId }
                    _servers.value = currentServers
                }
            }
            
            serverListHub.setOnServerDeleted { serverId ->
                callbackScope.launch {
                    Log.d("ServerRepository", "SignalR: Server deleted - $serverId")
                    val currentServers = _servers.value.toMutableList()
                    currentServers.removeAll { it.serverIdValue == serverId }
                    _servers.value = currentServers
                }
            }
            
            serverListHub.setOnServerListUpdated {
                callbackScope.launch {
                    Log.d("ServerRepository", "SignalR: Server list updated, requesting fresh list")
                    refreshServers()
                }
            }
            
            ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "hub_connect_start")
            val requestHubList = !shouldSkipHubListRequest()
            if (!requestHubList) {
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.SERVERS,
                    "hub_list_skip_fresh",
                    "roomAgeMs=${ListSyncPolicy.roomAgeMs(lastRoomServersSyncAtMs)} count=${_servers.value.size}",
                )
            }
            val hubStartedAt = android.os.SystemClock.elapsedRealtime()
            val result = serverListHub.connect(userId, requestInitialList = requestHubList)
            val hubMs = android.os.SystemClock.elapsedRealtime() - hubStartedAt
            if (result.isSuccess) {
                Log.d("ServerRepository", "SignalR connected successfully")
                ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "hub_connect_done", "hubMs=$hubMs")
            } else {
                Log.e("ServerRepository", "SignalR connection failed", result.exceptionOrNull())
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.SERVERS,
                    "hub_connect_fail",
                    "hubMs=$hubMs err=${result.exceptionOrNull()?.message.orEmpty()}",
                )
            }
            result
        } catch (e: Exception) {
            Log.e("ServerRepository", "Exception while connecting SignalR", e)
            Result.failure(e)
        }
    }
    
    fun disconnectSignalR() {
        hubConnectJob?.cancel()
        hubConnectJob = null
        hubConnectUserId = null
        serversFetchJob?.cancel()
        serversFetchJob = null
        lastServersFetchAtMs = 0L
        lastRoomServersSyncAtMs = 0L
        currentUserId = null
        serverListHub.disconnect()
        _servers.value = emptyList()
    }

    fun onUserSessionEnded() {
        hubConnectJob?.cancel()
        hubConnectJob = null
        hubConnectUserId = null
        serversFetchJob?.cancel()
        serversFetchJob = null
        lastServersFetchAtMs = 0L
        lastRoomServersSyncAtMs = 0L
        currentUserId = null
        serverListHub.disconnect()
        _servers.value = emptyList()
    }
    
    fun refreshServers() {
        serverListHub.requestServers()
    }

    suspend fun createServer(
        serverName: String,
        isPublic: Boolean,
        description: String?,
    ): Result<Server> = serverListHub.createServer(serverName, isPublic, description)

    suspend fun awaitServers(userId: String, timeoutMs: Long = 8_000L): List<Server> {
        if (!isConnected.value) {
            connectSignalR(userId)
        } else {
            refreshServers()
        }
        val cached = _servers.value
        if (cached.isNotEmpty()) return cached
        return withTimeoutOrNull(timeoutMs) {
            servers.first { it.isNotEmpty() }
        } ?: _servers.value
    }

    companion object {
        private const val SERVERS_FETCH_COOLDOWN_MS = 30_000L
    }
}
