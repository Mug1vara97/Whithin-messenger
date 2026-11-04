package com.whithin.voice.util

import android.os.SystemClock
import android.util.Log
import com.whithin.voice.BuildConfig
import java.util.concurrent.ConcurrentHashMap

/**
 * Timing logs for chat/server list load at startup. Filter logcat by tag [TAG].
 *
 * Example: `adb logcat -s WhithinListPerf`
 */
object ListLoadPerfLog {
    const val TAG = "WhithinListPerf"
    const val CHATS = "chats"
    const val SERVERS = "servers"
    const val FRIENDS = "friends"

    private data class Session(
        val listId: String,
        val startedAtMs: Long,
        var lastMarkMs: Long,
        var cacheReadyLogged: Boolean = false,
        var syncReadyLogged: Boolean = false,
    )

    private val sessions = ConcurrentHashMap<String, Session>()

    private fun log(message: String) {
        if (BuildConfig.DEBUG) {
            Log.d(TAG, message)
        }
    }

    fun begin(listId: String, label: String = "startup") {
        val id = listId.trim()
        if (id.isBlank()) return
        if (sessions.containsKey(id)) return
        val now = SystemClock.elapsedRealtime()
        sessions[id] = Session(id, now, now)
        log("[$id] START $label")
    }

    fun mark(listId: String, phase: String, extra: String = "") {
        val id = listId.trim()
        if (id.isBlank()) return
        val session = sessions[id] ?: return
        val now = SystemClock.elapsedRealtime()
        val sinceStartMs = now - session.startedAtMs
        val sinceLastMs = now - session.lastMarkMs
        session.lastMarkMs = now
        val suffix = if (extra.isNotBlank()) " | $extra" else ""
        log("[$id] +${sinceStartMs}ms (Δ${sinceLastMs}ms) $phase$suffix")
    }

    /** First paint from Room cache — list visible offline. */
    fun endCacheReady(listId: String, count: Int) {
        val id = listId.trim()
        if (id.isBlank()) return
        val session = sessions[id] ?: return
        if (session.cacheReadyLogged) return
        session.cacheReadyLogged = true
        val totalMs = SystemClock.elapsedRealtime() - session.startedAtMs
        log("[$id] DONE cache_ready total=${totalMs}ms | count=$count")
    }

    /** First network sync (REST or hub) after startup. */
    fun endSyncReady(listId: String, source: String, count: Int) {
        val id = listId.trim()
        if (id.isBlank()) return
        val session = sessions[id] ?: return
        if (session.syncReadyLogged) return
        session.syncReadyLogged = true
        val totalMs = SystemClock.elapsedRealtime() - session.startedAtMs
        log("[$id] DONE sync_ready total=${totalMs}ms | source=$source count=$count")
    }

    fun cancel(listId: String, reason: String) {
        val id = listId.trim()
        if (id.isBlank()) return
        val session = sessions.remove(id) ?: return
        val totalMs = SystemClock.elapsedRealtime() - session.startedAtMs
        log("[$id] CANCEL $reason after=${totalMs}ms")
    }
}
