package com.whithin.voice.data.signalr

import android.util.Log
import com.google.gson.Gson
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.model.Server
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.core.Single
import io.reactivex.rxjava3.schedulers.Schedulers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class ServerListHub @Inject constructor(
    private val tokenManager: TokenManager,
    private val gson: Gson
) {
    private var connection: HubConnection? = null
    private var connectedUserId: String? = null
    private val reconnectController = SignalRReconnectController("ServerListHub")
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    
    private var onServersReceived: ((List<Server>) -> Unit)? = null
    private var onServerCreated: ((Server) -> Unit)? = null
    private var onServerJoined: ((Server) -> Unit)? = null
    private var onServerLeft: ((String) -> Unit)? = null
    private var onServerDeleted: ((String) -> Unit)? = null
    private var onServerListUpdated: (() -> Unit)? = null
    
    suspend fun connect(userId: String, requestInitialList: Boolean = true): Result<Unit> {
        return try {
            connectedUserId = userId
            reconnectController.enable()

            if (connection?.connectionState == HubConnectionState.CONNECTED) {
                Log.d("ServerListHub", "Already connected")
                resubscribeAfterConnect(requestInitialList)
                return Result.success(Unit)
            }

            stopConnection(clearConnection = true)
            connection = buildConnection(userId)
            startConnection(requestInitialList = requestInitialList)
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ServerListHub", "Error connecting", e)
            _isConnected.value = false
            Result.failure(e)
        }
    }

    private fun buildConnection(userId: String): HubConnection {
        val hubUrl = "https://whithin.ru/serverlisthub?userId=$userId"
        val conn =
            HubConnectionBuilder.create(hubUrl)
                .withFreshAccessToken(tokenManager)
                .build()
        registerEventHandlers(conn)
        reconnectController.bindOnClosed(conn) { restartConnection() }
        return conn
    }

    private suspend fun startConnection(requestInitialList: Boolean) {
        suspendCancellableCoroutine { continuation ->
            try {
                connection?.start()?.blockingAwait()
                Log.d("ServerListHub", "Connected successfully")
                _isConnected.value = true
                if (requestInitialList) {
                    resubscribeAfterConnect(requestInitialList = true)
                } else {
                    try {
                        connection?.invoke("JoinServerListGroup")?.blockingAwait()
                        Log.d("ServerListHub", "Joined server list group")
                    } catch (e: Exception) {
                        Log.w("ServerListHub", "JoinServerListGroup failed", e)
                    }
                }
                continuation.resume(Unit)
            } catch (error: Exception) {
                Log.e("ServerListHub", "Connection failed", error)
                _isConnected.value = false
                continuation.resumeWithException(error)
            }
        }
    }

    private suspend fun restartConnection(): Result<Unit> {
        val userId = connectedUserId?.trim().orEmpty()
        if (userId.isBlank() || !reconnectController.isEnabled) {
            return Result.failure(IllegalStateException("ServerListHub reconnect skipped"))
        }
        return reconnectController.withReconnectPaused {
            try {
                stopConnection(clearConnection = false)
                connection = buildConnection(userId)
                startConnection(requestInitialList = true)
                Result.success(Unit)
            } catch (e: Exception) {
                _isConnected.value = false
                Result.failure(e)
            }
        }
    }

    private fun resubscribeAfterConnect(requestInitialList: Boolean) {
        try {
            connection?.invoke("JoinServerListGroup")?.blockingAwait()
            Log.d("ServerListHub", "Joined server list group")
        } catch (e: Exception) {
            Log.w("ServerListHub", "JoinServerListGroup failed", e)
        }
        if (requestInitialList) {
            requestServers()
        }
    }

    private fun stopConnection(clearConnection: Boolean) {
        try {
            connection?.stop()
        } catch (e: Exception) {
            Log.w("ServerListHub", "Error stopping connection", e)
        }
        _isConnected.value = false
        if (clearConnection) {
            connection = null
        }
    }

    private fun registerEventHandlers(conn: HubConnection) {
            conn.on("ReceiveServers", { servers: Array<Server> ->
                try {
                    val serverList = servers.toList()
                    Log.d("ServerListHub", "Received ${serverList.size} servers from ReceiveServers event")
                    serverList.forEachIndexed { index, server ->
                        Log.d("ServerListHub", "  Server[$index]: ${server.serverIdValue} - ${server.nameValue}")
                    }
                    onServersReceived?.invoke(serverList)
                    Log.d("ServerListHub", "ReceiveServers event handled successfully")
                } catch (e: Exception) {
                    Log.e("ServerListHub", "Error handling ReceiveServers", e)
                }
            }, Array<Server>::class.java)
            
            conn.on("ServerCreated", { server: Server ->
                try {
                    Log.d("ServerListHub", "SignalR: Server created - ${server.serverIdValue}")
                    onServerCreated?.invoke(server)
                } catch (e: Exception) {
                    Log.e("ServerListHub", "Error handling ServerCreated", e)
                }
            }, Server::class.java)
            
            conn.on("ServerJoined", { server: Server ->
                try {
                    Log.d("ServerListHub", "SignalR: Server joined - ${server.serverIdValue}")
                    onServerJoined?.invoke(server)
                } catch (e: Exception) {
                    Log.e("ServerListHub", "Error handling ServerJoined", e)
                }
            }, Server::class.java)
            
            conn.on("YouWereAddedToServer", { data: Map<String, Any> ->
                try {
                    Log.d("ServerListHub", "SignalR: YouWereAddedToServer event received")
                    // Request updated server list after being added
                    requestServers()
                    onServerListUpdated?.invoke()
                } catch (e: Exception) {
                    Log.e("ServerListHub", "Error handling YouWereAddedToServer", e)
                }
            }, Map::class.java)
            
            conn.on("ServerLeft", { serverId: String ->
                try {
                    Log.d("ServerListHub", "SignalR: Server left - $serverId")
                    onServerLeft?.invoke(serverId)
                } catch (e: Exception) {
                    Log.e("ServerListHub", "Error handling ServerLeft", e)
                }
            }, String::class.java)
            
            conn.on("ServerDeleted", { serverId: String ->
                try {
                    Log.d("ServerListHub", "SignalR: Server deleted - $serverId")
                    onServerDeleted?.invoke(serverId)
                } catch (e: Exception) {
                    Log.e("ServerListHub", "Error handling ServerDeleted", e)
                }
            }, String::class.java)
            
            conn.on("ServerListUpdated", {
                try {
                    Log.d("ServerListHub", "SignalR: ServerListUpdated event received")
                    requestServers()
                    onServerListUpdated?.invoke()
                } catch (e: Exception) {
                    Log.e("ServerListHub", "Error handling ServerListUpdated", e)
                }
            })

            conn.on("error", { error: String ->
                Log.e("ServerListHub", "SignalR error received: $error")
            }, String::class.java)

            conn.on("Error", { error: String ->
                Log.e("ServerListHub", "SignalR Error (capital) received: $error")
            }, String::class.java)
    }

    fun disconnect() {
        try {
            reconnectController.disable()
            connectedUserId = null
            reconnectController.pauseScheduledReconnect = true
            stopConnection(clearConnection = true)
            reconnectController.pauseScheduledReconnect = false
            Log.d("ServerListHub", "Disconnected")
        } catch (e: Exception) {
            Log.e("ServerListHub", "Error disconnecting", e)
        }
    }
    
    suspend fun createServer(
        serverName: String,
        isPublic: Boolean = false,
        description: String? = null,
    ): Result<Server> =
        withContext(Dispatchers.IO) {
            try {
                val trimmedName = serverName.trim()
                if (trimmedName.isBlank()) {
                    return@withContext Result.failure(IllegalArgumentException("Название сервера пустое"))
                }
                val conn =
                    connection
                        ?: return@withContext Result.failure(IllegalStateException("Not connected"))
                if (conn.connectionState != HubConnectionState.CONNECTED) {
                    return@withContext Result.failure(IllegalStateException("Hub not connected"))
                }
                val desc = description?.trim().orEmpty()
                val server =
                    conn
                        .invoke(Server::class.java, "CreateServer", trimmedName, isPublic, desc)
                        ?.blockingGet()
                if (server != null) {
                    Log.d("ServerListHub", "CreateServer succeeded: ${server.serverIdValue}")
                    Result.success(server)
                } else {
                    Result.failure(Exception("Не удалось создать сервер"))
                }
            } catch (e: Exception) {
                Log.e("ServerListHub", "CreateServer failed", e)
                Result.failure(e)
            }
        }

    fun requestServers() {
        try {
            Log.d("ServerListHub", "Requesting servers from server...")
            // In web client: const serversData = await connection.invoke('GetUserServers');
            // In Android: use invoke(Class<T> returnType, String methodName) for methods without parameters
            // This returns Single<Array<Server>>
            val single: io.reactivex.rxjava3.core.Single<Array<Server>>? = 
                connection?.invoke(Array<Server>::class.java, "GetUserServers")
            
            single?.subscribeOn(Schedulers.io())
                ?.observeOn(AndroidSchedulers.mainThread())
                ?.subscribe(
                    { servers: Array<Server> ->
                        val serverList = servers.toList()
                        Log.d("ServerListHub", "Received ${serverList.size} servers from SignalR")
                        onServersReceived?.invoke(serverList)
                        Log.d("ServerListHub", "GetUserServers returned successfully with ${serverList.size} servers")
                    },
                    { error: Throwable ->
                        Log.e("ServerListHub", "Error getting servers from GetUserServers", error)
                    }
                ) ?: run {
                Log.w("ServerListHub", "invoke returned null, connection may be null")
            }
        } catch (e: Exception) {
            Log.e("ServerListHub", "Error requesting servers", e)
        }
    }
    
    fun setOnServersReceived(callback: (List<Server>) -> Unit) {
        onServersReceived = callback
    }
    
    fun setOnServerCreated(callback: (Server) -> Unit) {
        onServerCreated = callback
    }
    
    fun setOnServerJoined(callback: (Server) -> Unit) {
        onServerJoined = callback
    }
    
    fun setOnServerLeft(callback: (String) -> Unit) {
        onServerLeft = callback
    }
    
    fun setOnServerDeleted(callback: (String) -> Unit) {
        onServerDeleted = callback
    }
    
    fun setOnServerListUpdated(callback: () -> Unit) {
        onServerListUpdated = callback
    }
}
