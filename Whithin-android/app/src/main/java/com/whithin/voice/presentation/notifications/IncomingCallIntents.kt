package com.whithin.voice.presentation.notifications

import android.content.Context
import android.content.Intent
import com.whithin.voice.MainActivity

object IncomingCallIntents {
    const val ACTION_ACCEPT_CALL = "com.whithin.voice.ACTION_ACCEPT_CALL"
    const val ACTION_DECLINE_CALL = "com.whithin.voice.ACTION_DECLINE_CALL"
    const val ACTION_DISMISS_INCOMING_CALL_UI = "com.whithin.voice.ACTION_DISMISS_INCOMING_CALL_UI"

    const val EXTRA_NOTIFICATION_ID = "incoming_call_notification_id"
    const val EXTRA_CHAT_ID = "chat_id"
    const val EXTRA_ROOM_ID = "room_id"
    const val EXTRA_CALLER_ID = "caller_id"
    const val EXTRA_CALLER_NAME = "caller_name"
    const val EXTRA_CALLER_AVATAR = "caller_avatar"
    const val EXTRA_CALLER_AVATAR_COLOR = "caller_avatar_color"
    const val EXTRA_INCOMING_CALL = "incoming_call"
    const val EXTRA_CALL_ACTION = "call_action"

    const val CALL_ACTION_ACCEPT = "accept"
}

data class IncomingCallPayload(
    val notificationId: Int,
    val chatId: String?,
    val roomId: String?,
    val callerId: String?,
    val callerName: String,
    val callerAvatar: String? = null,
    val callerAvatarColor: String? = null,
)

fun Intent.putIncomingCallExtras(payload: IncomingCallPayload) {
    putExtra(IncomingCallIntents.EXTRA_INCOMING_CALL, true)
    if (payload.notificationId != -1) {
        putExtra(IncomingCallIntents.EXTRA_NOTIFICATION_ID, payload.notificationId)
    }
    payload.chatId?.let { putExtra(IncomingCallIntents.EXTRA_CHAT_ID, it) }
    payload.roomId?.let { putExtra(IncomingCallIntents.EXTRA_ROOM_ID, it) }
    payload.callerId?.let { putExtra(IncomingCallIntents.EXTRA_CALLER_ID, it) }
    putExtra(IncomingCallIntents.EXTRA_CALLER_NAME, payload.callerName)
    payload.callerAvatar?.let { putExtra(IncomingCallIntents.EXTRA_CALLER_AVATAR, it) }
    payload.callerAvatarColor?.let { putExtra(IncomingCallIntents.EXTRA_CALLER_AVATAR_COLOR, it) }
}

fun Intent.toIncomingCallPayload(defaultCallerName: String = "Пользователь"): IncomingCallPayload {
    return IncomingCallPayload(
        notificationId = getIntExtra(IncomingCallIntents.EXTRA_NOTIFICATION_ID, -1),
        chatId = getStringExtra(IncomingCallIntents.EXTRA_CHAT_ID),
        roomId = getStringExtra(IncomingCallIntents.EXTRA_ROOM_ID),
        callerId = getStringExtra(IncomingCallIntents.EXTRA_CALLER_ID),
        callerName = getStringExtra(IncomingCallIntents.EXTRA_CALLER_NAME).orEmpty().ifBlank { defaultCallerName },
        callerAvatar = getStringExtra(IncomingCallIntents.EXTRA_CALLER_AVATAR),
        callerAvatarColor = getStringExtra(IncomingCallIntents.EXTRA_CALLER_AVATAR_COLOR),
    )
}

fun buildAcceptCallMainActivityIntent(context: Context, payload: IncomingCallPayload): Intent =
    Intent(context, MainActivity::class.java).apply {
        flags =
            Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra(IncomingCallIntents.EXTRA_CALL_ACTION, IncomingCallIntents.CALL_ACTION_ACCEPT)
        putIncomingCallExtras(payload)
    }

fun IncomingCallPayload.toLaunchData(): com.whithin.voice.IncomingCallLaunchData {
    val resolvedChatId = chatId?.trim().orEmpty().ifBlank { roomId?.trim().orEmpty() }
    val resolvedRoomId = roomId?.trim().orEmpty().ifBlank { resolvedChatId }
    return com.whithin.voice.IncomingCallLaunchData(
        roomId = resolvedRoomId,
        roomName = callerName,
        chatId = resolvedChatId,
        chatName = callerName,
    )
}

/** Stages accept before launching MainActivity — survives OEM activity-start quirks. */
object IncomingCallAcceptStore {
    @Volatile
    private var stagedPayload: IncomingCallPayload? = null

    fun stage(payload: IncomingCallPayload) {
        stagedPayload = payload
    }

    fun consume(): IncomingCallPayload? = stagedPayload.also { stagedPayload = null }

    fun clear() {
        stagedPayload = null
    }
}
