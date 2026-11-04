package com.whithin.voice.data.signalr

import android.util.Log
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.whithin.voice.data.local.TokenManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class FriendHub @Inject constructor(
    private val tokenManager: TokenManager
) {
    private var connection: HubConnection? = null
    private var connectedUserId: String? = null
    private val reconnectController = SignalRReconnectController("FriendHub")
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private var onDataChanged: (() -> Unit)? = null

    suspend fun connect(userId: String): Result<Unit> {
        return try {
            connectedUserId = userId
            reconnectController.enable()

            if (connection?.connectionState == HubConnectionState.CONNECTED) {
                return Result.success(Unit)
            }

            stopConnection(clearConnection = true)
            connection = buildConnection(userId)
            startConnection()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FriendHub", "Error connecting", e)
            _isConnected.value = false
            Result.failure(e)
        }
    }

    private fun buildConnection(userId: String): HubConnection {
        val hubUrl = "https://whithin.ru/friendhub?userId=$userId"
        val conn =
            HubConnectionBuilder.create(hubUrl)
                .withFreshAccessToken(tokenManager)
                .build()
        registerEventHandlers(conn)
        reconnectController.bindOnClosed(conn) { restartConnection() }
        return conn
    }

    private suspend fun startConnection() {
        suspendCancellableCoroutine { continuation ->
            try {
                connection?.start()?.blockingAwait()
                _isConnected.value = true
                continuation.resume(Unit)
            } catch (error: Exception) {
                _isConnected.value = false
                continuation.resumeWithException(error)
            }
        }
    }

    private suspend fun restartConnection(): Result<Unit> {
        val userId = connectedUserId?.trim().orEmpty()
        if (userId.isBlank() || !reconnectController.isEnabled) {
            return Result.failure(IllegalStateException("FriendHub reconnect skipped"))
        }
        return reconnectController.withReconnectPaused {
            try {
                stopConnection(clearConnection = false)
                connection = buildConnection(userId)
                startConnection()
                Result.success(Unit)
            } catch (e: Exception) {
                _isConnected.value = false
                Result.failure(e)
            }
        }
    }

    private fun stopConnection(clearConnection: Boolean) {
        try {
            connection?.stop()
        } catch (e: Exception) {
            Log.w("FriendHub", "Error stopping connection", e)
        }
        _isConnected.value = false
        if (clearConnection) {
            connection = null
        }
    }

    private fun registerEventHandlers(conn: HubConnection) {
        conn.on("FriendAdded", { _: Any ->
            onDataChanged?.invoke()
        }, Any::class.java)

        conn.on("FriendRemoved", { _: Any ->
            onDataChanged?.invoke()
        }, Any::class.java)

        conn.on("FriendRequestAccepted", { _: Any ->
            onDataChanged?.invoke()
        }, Any::class.java)

        conn.on("FriendRequestReceived", { _: Any ->
            onDataChanged?.invoke()
        }, Any::class.java)

        conn.on("FriendRequestDeclined", { _: Any ->
            onDataChanged?.invoke()
        }, Any::class.java)
    }

    fun disconnect() {
        reconnectController.disable()
        connectedUserId = null
        reconnectController.pauseScheduledReconnect = true
        stopConnection(clearConnection = true)
        reconnectController.pauseScheduledReconnect = false
    }

    fun setOnDataChanged(callback: () -> Unit) {
        onDataChanged = callback
    }

    fun sendFriendRequest(targetUserId: String): Result<Unit> {
        return invokeVoid("SendFriendRequest", UUID.fromString(targetUserId))
    }

    fun acceptFriendRequest(friendshipId: String): Result<Unit> {
        return invokeVoid("AcceptFriendRequest", UUID.fromString(friendshipId))
    }

    fun declineFriendRequest(friendshipId: String): Result<Unit> {
        return invokeVoid("DeclineFriendRequest", UUID.fromString(friendshipId))
    }

    fun removeFriend(friendId: String): Result<Unit> {
        return invokeVoid("RemoveFriend", UUID.fromString(friendId))
    }

    private fun invokeVoid(method: String, arg: Any): Result<Unit> {
        return try {
            val currentConnection = connection
            if (currentConnection == null || currentConnection.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("FriendHub is not connected"))
            }
            currentConnection.invoke(method, arg).blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FriendHub", "Error invoking $method", e)
            Result.failure(e)
        }
    }
}
