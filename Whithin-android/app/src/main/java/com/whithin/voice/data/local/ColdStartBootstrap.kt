package com.whithin.voice.data.local

import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.e2e.E2eCryptoService
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.data.repository.ServerRepository
import com.whithin.voice.util.ChatOpenPerfLog
import com.whithin.voice.util.ListLoadPerfLog
import com.whithin.voice.util.ListSyncPolicy
import javax.inject.Inject
import javax.inject.Singleton
import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val FIRST_FRAME_NETWORK_FALLBACK_MS = 1_200L

/**
 * Warms token, theme settings and list caches as early as possible (Application.onCreate).
 * [awaitEssentials] is token + settings only; list caches continue in the background.
 * Network hubs / E2E start after [notifyUiInteractive] (first Compose frame) so they
 * do not fight the first paint.
 */
@Singleton
class ColdStartBootstrap @Inject constructor(
    private val tokenManager: TokenManager,
    private val appSettingsStore: AppSettingsStore,
    private val authRepository: AuthRepository,
    private val chatRepository: ChatRepository,
    private val serverRepository: ServerRepository,
    private val e2eCrypto: E2eCryptoService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Volatile
    private var essentialsDeferred: CompletableDeferred<Unit>? = null

    @Volatile
    private var warmDeferred: CompletableDeferred<Unit>? = null

    @Volatile
    private var networkStarted: Boolean = false

    fun startEarly() {
        if (warmDeferred != null) return
        synchronized(this) {
            if (warmDeferred != null) return
            val essentials = CompletableDeferred<Unit>()
            val warm = CompletableDeferred<Unit>()
            essentialsDeferred = essentials
            warmDeferred = warm
            scope.launch {
                val bootStartedAt = android.os.SystemClock.elapsedRealtime()
                try {
                    val essentialsStartedAt = android.os.SystemClock.elapsedRealtime()
                    coroutineScope {
                        val tokenJob = async { tokenManager.getToken() }
                        val settingsJob = async { appSettingsStore.warmFromDisk() }
                        tokenJob.await()
                        settingsJob.await()
                    }
                    Log.d(
                        ChatOpenPerfLog.TAG,
                        "coldStart essentials ${android.os.SystemClock.elapsedRealtime() - essentialsStartedAt}ms",
                    )
                } finally {
                    essentials.complete(Unit)
                }
                try {
                    ListLoadPerfLog.begin(ListLoadPerfLog.CHATS)
                    ListLoadPerfLog.begin(ListLoadPerfLog.SERVERS)
                    val cacheStartedAt = android.os.SystemClock.elapsedRealtime()
                    coroutineScope {
                        val chatsJob = async { chatRepository.warmFromCache() }
                        val serversJob = async { serverRepository.warmFromCache() }
                        chatsJob.await()
                        serversJob.await()
                    }
                    Log.d(
                        ChatOpenPerfLog.TAG,
                        "coldStart listCache ${android.os.SystemClock.elapsedRealtime() - cacheStartedAt}ms",
                    )
                } finally {
                    warm.complete(Unit)
                    Log.d(
                        ChatOpenPerfLog.TAG,
                        "coldStart total ${android.os.SystemClock.elapsedRealtime() - bootStartedAt}ms",
                    )
                }
                // Hubs / E2E compete with first frame — wait for UI or a short timeout.
                scope.launch {
                    delay(FIRST_FRAME_NETWORK_FALLBACK_MS)
                    notifyUiInteractive()
                }
            }
        }
    }

    /**
     * Call once the first Compose frame is up (MainActivity). Starts SignalR / E2E / list
     * prefetch without blocking cold start paint.
     */
    fun notifyUiInteractive() {
        if (networkStarted) return
        synchronized(this) {
            if (networkStarted) return
            networkStarted = true
        }
        startEarlyNetworkSession()
    }

    suspend fun awaitEssentials() {
        startEarly()
        essentialsDeferred?.await()
    }

    suspend fun awaitWarm() {
        startEarly()
        warmDeferred?.await()
    }

    private fun startEarlyNetworkSession() {
        scope.launch(Dispatchers.IO) {
            val userId = tokenManager.peekUserFromToken()?.id?.trim().orEmpty()
            if (userId.isBlank() || !tokenManager.peekHasValidSession()) return@launch
            launch {
                runCatching {
                    e2eCrypto.ensureE2eIdentity(userId, strictUpload = true)
                    chatRepository.prefetchUserChatsIfNeeded()
                    chatRepository.syncSessionE2eKeys()
                    chatRepository.redecryptChatListPreviews()
                }.onFailure { error ->
                    if (error is kotlinx.coroutines.CancellationException) throw error
                    Log.w(ChatOpenPerfLog.TAG, "early E2E identity bootstrap failed", error)
                    runCatching { e2eCrypto.ensureE2eIdentity(userId) }
                }
            }
            ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "early_session_start")
            ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "early_session_start")
            val deferHubs =
                chatRepository.shouldSkipHubListRequest() &&
                    serverRepository.shouldSkipHubListRequest()
            coroutineScope {
                launch {
                    runCatching { serverRepository.prefetchServersIfNeeded() }
                        .onFailure { Log.w(ChatOpenPerfLog.TAG, "early servers prefetch failed", it) }
                }
                if (!deferHubs) {
                    launch {
                        runCatching { authRepository.prefetchCurrentUserVisuals() }
                            .onFailure { Log.w(ChatOpenPerfLog.TAG, "early profile prefetch failed", it) }
                    }
                }
                if (deferHubs) {
                    ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "early_hub_defer_fresh")
                    ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "early_hub_defer_fresh")
                } else {
                    launch {
                        runCatching { chatRepository.connectSignalR(userId) }
                            .onFailure { Log.w(ChatOpenPerfLog.TAG, "early chat hub failed", it) }
                    }
                    launch {
                        runCatching { serverRepository.connectSignalR(userId) }
                            .onFailure { Log.w(ChatOpenPerfLog.TAG, "early server hub failed", it) }
                    }
                }
            }
        }
    }
}
