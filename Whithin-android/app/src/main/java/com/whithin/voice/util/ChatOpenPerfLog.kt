package com.whithin.voice.util

import android.os.SystemClock
import android.util.Log
import com.whithin.voice.BuildConfig
import java.util.concurrent.ConcurrentHashMap

/**
 * Timing logs for chat open / message load. Filter logcat by tag [TAG].
 *
 * Example: `adb logcat -s WhithinChatPerf`
 */
object ChatOpenPerfLog {
    const val TAG = "WhithinChatPerf"

    private data class Session(
        val chatId: String,
        val startedAtMs: Long,
        var lastMarkMs: Long,
    )

    private val sessions = ConcurrentHashMap<String, Session>()

    private fun log(message: String) {
        if (BuildConfig.DEBUG) {
            Log.d(TAG, message)
        }
    }

    fun begin(chatId: String, label: String = "loadMessages") {
        val id = chatId.trim()
        if (id.isBlank()) return
        val now = SystemClock.elapsedRealtime()
        sessions[id] = Session(id, now, now)
        log("[$id] START $label")
    }

    fun mark(chatId: String, phase: String, extra: String = "") {
        val id = chatId.trim()
        if (id.isBlank()) return
        val session = sessions[id] ?: return
        val now = SystemClock.elapsedRealtime()
        val sinceStartMs = now - session.startedAtMs
        val sinceLastMs = now - session.lastMarkMs
        session.lastMarkMs = now
        val suffix = if (extra.isNotBlank()) " | $extra" else ""
        log("[$id] +${sinceStartMs}ms (Δ${sinceLastMs}ms) $phase$suffix")
    }

    fun end(chatId: String, outcome: String, extra: String = "") {
        val id = chatId.trim()
        if (id.isBlank()) return
        val session = sessions.remove(id) ?: return
        val totalMs = SystemClock.elapsedRealtime() - session.startedAtMs
        val suffix = if (extra.isNotBlank()) " | $extra" else ""
        log("[$id] DONE $outcome total=${totalMs}ms$suffix")
    }

    fun cancel(chatId: String, reason: String) {
        val id = chatId.trim()
        if (id.isBlank()) return
        val session = sessions.remove(id) ?: return
        val totalMs = SystemClock.elapsedRealtime() - session.startedAtMs
        log("[$id] CANCEL $reason after=${totalMs}ms")
    }
}
