package com.whithin.voice.data.model

object MessageStatus {
    const val SENDING = "sending"
    const val SENT = "sent"
    const val DELIVERED = "delivered"
    const val READ = "read"
    const val FAILED = "failed"

    private val rank =
        mapOf(
            FAILED to -1,
            SENDING to 0,
            SENT to 1,
            DELIVERED to 2,
            READ to 3,
        )

    fun normalize(raw: String?): String {
        val value = raw?.trim()?.lowercase().orEmpty()
        return when (value) {
            SENDING, SENT, DELIVERED, READ, FAILED -> value
            else -> SENT
        }
    }

    fun pickHigher(current: String?, next: String?): String {
        val left = normalize(current)
        val right = normalize(next)
        return if ((rank[right] ?: 0) > (rank[left] ?: 0)) right else left
    }
}
