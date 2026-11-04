package com.whithin.voice.data.signalr

import android.util.Log
import com.google.gson.Gson
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.model.UserStatusChangedEvent
import com.whithin.voice.data.model.ProfileRealtimeUpdate
import com.whithin.voice.data.util.ProfileRealtimeUpdateParser
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class NotificationDismissedEvent(
    val notificationId: String? = null,
    val chatId: String? = null,
)

data class IncomingCallDismissedEvent(
    val chatId: String,
    val reason: String = "dismissed",
)

@Singleton
class NotificationHub @Inject constructor(
    private val tokenManager: TokenManager,
    private val gson: Gson
) {
    private var connection: HubConnection? = null
    private var connectedUserId: String? = null
    private val reconnectController = SignalRReconnectController("NotificationHub")

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _statusChangedEvents = MutableSharedFlow<UserStatusChangedEvent>(extraBufferCapacity = 64)
    val statusChangedEvents: SharedFlow<UserStatusChangedEvent> = _statusChangedEvents.asSharedFlow()

    private val _notificationDismissedEvents =
        MutableSharedFlow<NotificationDismissedEvent>(extraBufferCapacity = 64)
    val notificationDismissedEvents: SharedFlow<NotificationDismissedEvent> =
        _notificationDismissedEvents.asSharedFlow()

    private val _incomingCallDismissedEvents =
        MutableSharedFlow<IncomingCallDismissedEvent>(extraBufferCapacity = 16)
    val incomingCallDismissedEvents: SharedFlow<IncomingCallDismissedEvent> =
        _incomingCallDismissedEvents.asSharedFlow()

    private val _profileUpdatedEvents =
        MutableSharedFlow<ProfileRealtimeUpdate>(extraBufferCapacity = 32)
    val profileUpdatedEvents: SharedFlow<ProfileRealtimeUpdate> =
        _profileUpdatedEvents.asSharedFlow()

    suspend fun connect(userId: String): Result<Unit> {
        return try {
            if (
                connection?.connectionState == HubConnectionState.CONNECTED &&
                connectedUserId == userId
            ) {
                return Result.success(Unit)
            }

            connectedUserId = userId
            reconnectController.enable()
            stopConnection(clearConnection = true)
            connection = buildConnection(userId)
            startConnection()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("NotificationHub", "Error connecting", e)
            _isConnected.value = false
            Result.failure(e)
        }
    }

    private fun buildConnection(userId: String): HubConnection {
        val hubUrl = "https://whithin.ru/notificationhub?userId=$userId"
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
            return Result.failure(IllegalStateException("NotificationHub reconnect skipped"))
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
            Log.w("NotificationHub", "Error stopping connection", e)
        }
        _isConnected.value = false
        if (clearConnection) {
            connection = null
        }
    }

    fun disconnect() {
        reconnectController.disable()
        connectedUserId = null
        reconnectController.pauseScheduledReconnect = true
        stopConnection(clearConnection = true)
        reconnectController.pauseScheduledReconnect = false
    }

    private fun registerEventHandlers(conn: HubConnection) {
        conn.on("UserStatusChanged", { payload: Any ->
            try {
                val json = gson.toJson(payload)
                val event = gson.fromJson(json, UserStatusChangedEvent::class.java)
                _statusChangedEvents.tryEmit(event)
            } catch (e: Exception) {
                Log.e("NotificationHub", "Error parsing UserStatusChanged event", e)
            }
        }, Any::class.java)

        conn.on("NotificationDismissed", { payload: Any ->
            try {
                val obj = gson.toJsonTree(payload).asJsonObject
                val notificationId =
                    obj.get("notificationId")?.takeUnless { it.isJsonNull }?.asString
                        ?: obj.get("NotificationId")?.takeUnless { it.isJsonNull }?.asString
                val chatId =
                    obj.get("chatId")?.takeUnless { it.isJsonNull }?.asString
                        ?: obj.get("ChatId")?.takeUnless { it.isJsonNull }?.asString
                _notificationDismissedEvents.tryEmit(
                    NotificationDismissedEvent(
                        notificationId = notificationId?.trim(),
                        chatId = chatId?.trim(),
                    ),
                )
            } catch (e: Exception) {
                Log.e("NotificationHub", "Error parsing NotificationDismissed event", e)
            }
        }, Any::class.java)

        conn.on("ChatNotificationsDismissed", { payload: Any ->
            try {
                val obj = gson.toJsonTree(payload).asJsonObject
                val chatId =
                    obj.get("chatId")?.takeUnless { it.isJsonNull }?.asString
                        ?: obj.get("ChatId")?.takeUnless { it.isJsonNull }?.asString
                _notificationDismissedEvents.tryEmit(
                    NotificationDismissedEvent(chatId = chatId?.trim()),
                )
            } catch (e: Exception) {
                Log.e("NotificationHub", "Error parsing ChatNotificationsDismissed event", e)
            }
        }, Any::class.java)

        conn.on("IncomingCallDismissed", { payload: Any ->
            try {
                val obj = gson.toJsonTree(payload).asJsonObject
                val chatId =
                    obj.get("chatId")?.takeUnless { it.isJsonNull }?.asString
                        ?: obj.get("ChatId")?.takeUnless { it.isJsonNull }?.asString
                val reason =
                    obj.get("reason")?.takeUnless { it.isJsonNull }?.asString
                        ?: obj.get("Reason")?.takeUnless { it.isJsonNull }?.asString
                        ?: "dismissed"
                val normalized = chatId?.trim().orEmpty()
                if (normalized.isNotBlank()) {
                    _incomingCallDismissedEvents.tryEmit(
                        IncomingCallDismissedEvent(chatId = normalized, reason = reason),
                    )
                }
            } catch (e: Exception) {
                Log.e("NotificationHub", "Error parsing IncomingCallDismissed event", e)
            }
        }, Any::class.java)

        conn.on("UserProfileUpdated", { payload: Any ->
            try {
                ProfileRealtimeUpdateParser.parse(payload, gson)?.let {
                    _profileUpdatedEvents.tryEmit(it)
                }
            } catch (e: Exception) {
                Log.e("NotificationHub", "Error parsing UserProfileUpdated event", e)
            }
        }, Any::class.java)
    }

    fun isSessionFor(userId: String): Boolean {
        val id = userId.trim()
        if (id.isBlank()) return false
        return connection?.connectionState == HubConnectionState.CONNECTED && connectedUserId == id
    }
}
