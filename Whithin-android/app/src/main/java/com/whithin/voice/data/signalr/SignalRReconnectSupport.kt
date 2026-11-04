package com.whithin.voice.data.signalr

import android.util.Log
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HttpHubConnectionBuilder
import com.whithin.voice.data.local.TokenManager
import io.reactivex.rxjava3.core.Single
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Delays aligned with ASP.NET Core SignalR default automatic reconnect (ms). */
object SignalRReconnectDelays {
    private val STEPS = longArrayOf(0L, 2_000L, 10_000L, 30_000L)
    const val CAP_ATTEMPT_INDEX: Int = 3

    fun delayBeforeAttempt(attemptIndex: Int): Long {
        val idx = attemptIndex.coerceAtMost(STEPS.lastIndex)
        return STEPS[idx]
    }
}

fun HttpHubConnectionBuilder.withFreshAccessToken(tokenManager: TokenManager): HttpHubConnectionBuilder =
    withAccessTokenProvider(
        Single.fromCallable {
            val token = tokenManager.peekToken()
            if (token.isNullOrBlank()) {
                throw IllegalStateException("Missing auth token for SignalR")
            }
            token
        },
    )

/**
 * Schedules hub restart after unexpected disconnect.
 * Java SignalR client has no [HubConnectionBuilder.withAutomaticReconnect] — this is the equivalent.
 */
class SignalRReconnectController(
    private val hubName: String,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
) {
    @Volatile
    var isEnabled: Boolean = false
        private set

    /** Prevents onClosed during intentional hub.stop() before rebuild. */
    @Volatile
    var pauseScheduledReconnect: Boolean = false

    private val mutex = Mutex()
    private var reconnectJob: Job? = null
    private var attemptIndex = 0

    fun enable() {
        isEnabled = true
        attemptIndex = 0
    }

    fun disable() {
        isEnabled = false
        reconnectJob?.cancel()
        reconnectJob = null
        attemptIndex = 0
    }

    fun bindOnClosed(connection: HubConnection, reconnect: suspend () -> Result<Unit>) {
        connection.onClosed { error ->
            Log.w("SignalRReconnect", "$hubName: connection closed", error)
            if (!isEnabled || pauseScheduledReconnect) return@onClosed
            scheduleReconnect(reconnect)
        }
    }

    suspend fun <T> withReconnectPaused(block: suspend () -> T): T {
        pauseScheduledReconnect = true
        return try {
            block()
        } finally {
            pauseScheduledReconnect = false
        }
    }

    fun scheduleReconnect(reconnect: suspend () -> Result<Unit>) {
        if (!isEnabled) return
        reconnectJob?.cancel()
        reconnectJob =
            scope.launch {
                mutex.withLock {
                    while (isEnabled) {
                        val waitMs = SignalRReconnectDelays.delayBeforeAttempt(attemptIndex)
                        attemptIndex++
                        if (waitMs > 0) delay(waitMs)
                        Log.d("SignalRReconnect", "$hubName: reconnect attempt #$attemptIndex")
                        val result = reconnect()
                        if (!isEnabled) return@launch
                        if (result.isSuccess) {
                            Log.d("SignalRReconnect", "$hubName: reconnected")
                            attemptIndex = 0
                            return@launch
                        }
                        Log.w(
                            "SignalRReconnect",
                            "$hubName: reconnect failed",
                            result.exceptionOrNull(),
                        )
                        if (attemptIndex > 16) {
                            attemptIndex = SignalRReconnectDelays.CAP_ATTEMPT_INDEX
                        }
                    }
                }
            }
    }
}
