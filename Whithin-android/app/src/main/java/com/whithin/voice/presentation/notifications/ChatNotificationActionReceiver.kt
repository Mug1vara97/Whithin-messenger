package com.whithin.voice.presentation.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ChatNotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return

        val chatId = intent.getStringExtra(PushNotificationIntents.EXTRA_CHAT_ID)?.trim().orEmpty()
        if (chatId.isBlank()) {
            Log.w(TAG, "Notification action ignored — missing chat_id")
            return
        }

        val action = intent.action
        if (action.isNullOrBlank()) {
            Log.w(TAG, "Notification action ignored — missing action chatId=$chatId")
            return
        }

        Log.d(TAG, "Notification action=$action chatId=$chatId")

        val appContext = context.applicationContext
        val entryPoint =
            EntryPointAccessors.fromApplication(
                appContext,
                ChatNotificationEntryPoint::class.java,
            )
        val chatRepository = entryPoint.chatRepository()
        val chatNotificationManager = entryPoint.chatNotificationManager()
        val tokenManager = entryPoint.tokenManager()

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                when (action) {
                    PushNotificationIntents.ACTION_MARK_CHAT_READ ->
                        handleMarkRead(chatRepository, chatNotificationManager, chatId)
                    PushNotificationIntents.ACTION_REPLY_TO_CHAT ->
                        handleReply(
                            intent = intent,
                            chatId = chatId,
                            chatRepository = chatRepository,
                            chatNotificationManager = chatNotificationManager,
                            tokenManager = tokenManager,
                        )
                    else -> Log.w(TAG, "Unknown notification action=$action")
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun handleMarkRead(
        chatRepository: com.whithin.voice.data.repository.ChatRepository,
        chatNotificationManager: ChatNotificationManager,
        chatId: String,
    ) {
        val result =
            withContext(Dispatchers.IO) {
                chatRepository.markChatAsRead(chatId)
            }
        result
            .onSuccess {
                Log.d(TAG, "markChatAsRead succeeded chatId=$chatId")
                chatNotificationManager.cancelNotificationsForChat(chatId)
            }
            .onFailure { error ->
                Log.w(TAG, "markChatAsRead failed chatId=$chatId", error)
            }
    }

    private suspend fun handleReply(
        intent: Intent,
        chatId: String,
        chatRepository: com.whithin.voice.data.repository.ChatRepository,
        chatNotificationManager: ChatNotificationManager,
        tokenManager: com.whithin.voice.data.local.TokenManager,
    ) {
        val replyText =
            RemoteInput.getResultsFromIntent(intent)
                ?.getCharSequence(PushNotificationIntents.EXTRA_REPLY_INPUT)
                ?.toString()
                ?.trim()
                .orEmpty()
        if (replyText.isBlank()) {
            Log.w(TAG, "Reply ignored — empty text chatId=$chatId")
            return
        }

        val user = tokenManager.getUserFromToken()
        if (user == null) {
            Log.w(TAG, "Reply ignored — no auth session chatId=$chatId")
            return
        }

        val username = user.username.ifBlank { "User" }
        val result =
            withContext(Dispatchers.IO) {
                chatRepository.sendMessageFromNotification(
                    chatId = chatId,
                    content = replyText,
                    username = username,
                )
            }

        result
            .onSuccess {
                Log.d(TAG, "Reply sent chatId=$chatId")
                chatNotificationManager.cancelNotificationsForChat(chatId)
            }
            .onFailure { error ->
                Log.w(TAG, "Reply failed chatId=$chatId", error)
            }
    }

    companion object {
        private const val TAG = "ChatNotifAction"
    }
}
