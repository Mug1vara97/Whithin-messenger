package com.whithin.voice.util

import android.util.Log
import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.data.repository.FriendRepository
import com.whithin.voice.data.repository.PresenceRepository
import com.whithin.voice.data.repository.ServerRepository
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Startup network: list hubs first, then deferred friends/presence/profile (VPN-friendly).
 */
object SessionNetworkCoordinator {
    suspend fun ensureStartupNetwork(
        userId: String,
        chatRepository: ChatRepository,
        serverRepository: ServerRepository,
        friendRepository: FriendRepository,
        presenceRepository: PresenceRepository,
        authRepository: AuthRepository,
    ) {
        ensureListHubsConnected(userId, chatRepository, serverRepository)
        ensureSecondaryNetwork(
            userId = userId,
            chatRepository = chatRepository,
            serverRepository = serverRepository,
            friendRepository = friendRepository,
            presenceRepository = presenceRepository,
            authRepository = authRepository,
        )
    }

    suspend fun ensureListHubsConnected(
        userId: String,
        chatRepository: ChatRepository,
        serverRepository: ServerRepository,
    ) {
        val chatWarm = chatRepository.isHubSessionWarm(userId)
        val serverWarm = serverRepository.isHubSessionWarm(userId)
        if (chatWarm && serverWarm) {
            ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "session_network_skip", "early_hub_warm")
            ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "session_network_skip", "early_hub_warm")
            return
        }

        val useSequentialFresh =
            chatRepository.shouldSkipHubListRequest() &&
                serverRepository.shouldSkipHubListRequest()

        if (useSequentialFresh) {
            ListLoadPerfLog.mark(
                ListLoadPerfLog.CHATS,
                "session_hub_defer",
                "deferMs=${ListSyncPolicy.HUB_DEFER_AFTER_UI_MS}",
            )
            ListLoadPerfLog.mark(
                ListLoadPerfLog.SERVERS,
                "session_hub_defer",
                "deferMs=${ListSyncPolicy.HUB_DEFER_AFTER_UI_MS}",
            )
            delay(ListSyncPolicy.HUB_DEFER_AFTER_UI_MS)
            if (!chatRepository.isHubSessionWarm(userId)) {
                chatRepository.connectSignalR(userId)
            }
            delay(ListSyncPolicy.HUB_STAGGER_MS)
            if (!serverRepository.isHubSessionWarm(userId)) {
                serverRepository.connectSignalR(userId)
            }
            return
        }

        ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "session_network_start")
        ListLoadPerfLog.mark(ListLoadPerfLog.SERVERS, "session_network_start")
        coroutineScope {
            if (!chatWarm) launch { chatRepository.connectSignalR(userId) }
            if (!serverWarm) launch { serverRepository.connectSignalR(userId) }
        }
    }

    private suspend fun ensureSecondaryNetwork(
        userId: String,
        chatRepository: ChatRepository,
        serverRepository: ServerRepository,
        friendRepository: FriendRepository,
        presenceRepository: PresenceRepository,
        authRepository: AuthRepository,
    ) {
        val listFresh =
            chatRepository.shouldSkipHubListRequest() &&
                serverRepository.shouldSkipHubListRequest()

        if (listFresh) {
            ListLoadPerfLog.begin(ListLoadPerfLog.FRIENDS)
            ListLoadPerfLog.mark(
                ListLoadPerfLog.FRIENDS,
                "session_defer",
                "deferMs=${ListSyncPolicy.FRIENDS_DEFER_AFTER_LIST_HUBS_MS}",
            )
            delay(ListSyncPolicy.FRIENDS_DEFER_AFTER_LIST_HUBS_MS)
        }

        if (friendRepository.friends.value.isEmpty()) {
            ListLoadPerfLog.mark(ListLoadPerfLog.FRIENDS, "rest_start")
            val restStartedAt = android.os.SystemClock.elapsedRealtime()
            friendRepository.loadFriends()
            friendRepository.loadFriendRequests()
            val restMs = android.os.SystemClock.elapsedRealtime() - restStartedAt
            ListLoadPerfLog.mark(ListLoadPerfLog.FRIENDS, "rest_ok", "restMs=$restMs")
        }

        if (listFresh) {
            delay(ListSyncPolicy.HUB_STAGGER_MS)
        }

        if (!presenceRepository.isHubSessionWarm(userId)) {
            ListLoadPerfLog.mark(ListLoadPerfLog.FRIENDS, "presence_hub_start")
            val startedAt = android.os.SystemClock.elapsedRealtime()
            presenceRepository.connect(userId)
            ListLoadPerfLog.mark(
                ListLoadPerfLog.FRIENDS,
                "presence_hub_done",
                "hubMs=${android.os.SystemClock.elapsedRealtime() - startedAt}",
            )
        }

        if (listFresh) {
            delay(ListSyncPolicy.HUB_STAGGER_MS)
        }

        if (!friendRepository.isHubSessionWarm(userId)) {
            ListLoadPerfLog.mark(ListLoadPerfLog.FRIENDS, "hub_connect_start")
            val startedAt = android.os.SystemClock.elapsedRealtime()
            friendRepository.connectHubOnly(userId)
            ListLoadPerfLog.mark(
                ListLoadPerfLog.FRIENDS,
                "hub_connect_done",
                "hubMs=${android.os.SystemClock.elapsedRealtime() - startedAt}",
            )
        }

        if (listFresh && authRepository.peekCachedUserVisuals(userId)?.avatarUrl == null) {
            delay(ListSyncPolicy.PROFILE_PREFETCH_DEFER_MS)
            runCatching { authRepository.prefetchCurrentUserVisuals() }
                .onFailure { Log.w(ListLoadPerfLog.TAG, "deferred profile prefetch failed", it) }
        }
    }
}
