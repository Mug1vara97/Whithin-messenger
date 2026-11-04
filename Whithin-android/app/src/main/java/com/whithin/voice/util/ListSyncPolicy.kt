package com.whithin.voice.util

/**
 * When Room list cache is newer than this, skip REST + hub list invoke on cold start.
 * Hub stays connected for realtime events (chatupdated, ServerListUpdated, …).
 */
object ListSyncPolicy {
    const val ROOM_FRESH_MS = 120_000L

    /** After auth UI, brief pause before hubs when Room is fresh (avoids VPN/TLS stampede at t=0). */
    const val HUB_DEFER_AFTER_UI_MS = 800L

    /** Connect chat hub first, then server hub — sequential is faster over high-latency VPN. */
    const val HUB_STAGGER_MS = 600L

    /** After list hubs — REST friends + presence/friend hubs (low priority on cold start). */
    const val FRIENDS_DEFER_AFTER_LIST_HUBS_MS = 2_500L

    /** GroupChatHub background session — only needed for delivery acks, not for list paint. */
    const val CHAT_DELIVERY_HUB_DEFER_MS = 6_000L

    /** Profile avatar REST — sidebar already has cached visuals. */
    const val PROFILE_PREFETCH_DEFER_MS = 4_000L

    fun isListCacheFresh(
        chatRoomUpdatedAtMs: Long,
        serverRoomUpdatedAtMs: Long,
    ): Boolean =
        isRoomFresh(chatRoomUpdatedAtMs) && isRoomFresh(serverRoomUpdatedAtMs)

    fun roomAgeMs(updatedAtMs: Long): Long {
        if (updatedAtMs <= 0L) return Long.MAX_VALUE
        return (System.currentTimeMillis() - updatedAtMs).coerceAtLeast(0L)
    }

    fun isRoomFresh(updatedAtMs: Long): Boolean =
        updatedAtMs > 0L && roomAgeMs(updatedAtMs) < ROOM_FRESH_MS
}
