package com.whithin.voice.presentation.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.whithin.voice.data.repository.FriendRepository
import com.whithin.voice.data.repository.PushTokenRepository
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@AndroidEntryPoint
class WhithinFirebaseMessagingService : FirebaseMessagingService() {
    private val entryPoint by lazy {
        dagger.hilt.android.EntryPointAccessors.fromApplication(
            applicationContext,
            ChatNotificationEntryPoint::class.java,
        )
    }

    private val chatNotificationManager: ChatNotificationManager by lazy {
        entryPoint.chatNotificationManager()
    }
    @Inject
    lateinit var pushTokenRepository: PushTokenRepository
    @Inject
    lateinit var friendRepository: FriendRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Received new FCM token: $token")
        serviceScope.launch {
            val result = pushTokenRepository.syncToken(token)
            if (result.isFailure) {
                Log.w(
                    TAG,
                    "Failed to register new FCM token; will retry after login",
                    result.exceptionOrNull()
                )
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        chatNotificationManager.createChannel()

        val data = remoteMessage.data
        val type = data["type"]?.trim()?.lowercase()
        Log.d(TAG, "FCM message received type=$type keys=${data.keys} hasNotification=${remoteMessage.notification != null}")

        // Data-only chat pushes — always handled here with MessagingStyle UI (Discord-like).
        val chatId = data["chat_id"] ?: data["chatId"]
        val roomId = data["room_id"] ?: data["roomId"] ?: chatId
        val callerId = data["caller_id"] ?: data["callerId"]
        val callerName = data["caller_name"]
            ?: data["callerName"]
            ?: data["chat_title"]
            ?: remoteMessage.notification?.title
            ?: DEFAULT_CALLER_NAME
        val callerAvatar = data["caller_avatar"] ?: data["callerAvatar"]
        val callerAvatarColor = data["caller_avatar_color"] ?: data["callerAvatarColor"]
        val title = data["chat_title"]
            ?: data["title"]
            ?: remoteMessage.notification?.title
            ?: DEFAULT_TITLE
        val body = data["message"]
            ?: data["body"]
            ?: data["content"]
            ?: remoteMessage.notification?.body

        if (type == TYPE_INCOMING_CALL) {
            Log.d(
                INCOMING_CALL_LOG_TAG,
                "FCM incoming_call: chatId=$chatId roomId=$roomId callerId=$callerId " +
                    "caller=$callerName keys=${data.keys}",
            )
            try {
                chatNotificationManager.showIncomingCallNotification(
                    chatId = chatId,
                    roomId = roomId,
                    callerId = callerId,
                    callerName = callerName,
                    callerAvatar = callerAvatar,
                    callerAvatarColor = callerAvatarColor,
                )
            } catch (error: Exception) {
                Log.e(TAG, "Failed to show incoming call notification", error)
            }
            return
        }

        if (type == TYPE_CALL_DISMISSED) {
            Log.d(
                INCOMING_CALL_LOG_TAG,
                "FCM call_dismissed: chatId=$chatId roomId=$roomId callerId=$callerId reason=${data["reason"]}",
            )
            try {
                chatNotificationManager.dismissActiveIncomingCall(
                    chatId = chatId,
                    callerId = callerId,
                    roomId = roomId,
                )
                Log.d(TAG, "Dismissed incoming call from push chatId=$chatId reason=${data["reason"]}")
            } catch (error: Exception) {
                Log.e(TAG, "Failed to dismiss incoming call from push", error)
            }
            return
        }

        if (type == PushNotificationIntents.TYPE_FRIEND_REQUEST) {
            val requestId = data["request_id"] ?: data["requestId"]
            val senderId = data["sender_id"] ?: data["senderId"]
            val senderUsername = data["sender_username"] ?: data["senderUsername"]
            val friendTitle = data["title"]?.takeIf { it.isNotBlank() } ?: "Запрос в друзья"
            val friendMessage = body?.takeIf { it.isNotBlank() }
                ?: data["message"]?.takeIf { it.isNotBlank() }
                ?: senderUsername?.let { "$it хочет добавить вас в друзья" }
                ?: "Новый запрос в друзья"

            serviceScope.launch {
                friendRepository.loadFriendRequests()
            }

            chatNotificationManager.showFriendRequestNotification(
                title = friendTitle,
                message = friendMessage,
                requestId = requestId,
                senderId = senderId
            )
            return
        }

        val messageType = data["msg_type"] ?: data["message_type"] ?: data["messageType"]
        val previewText = data["preview_text"] ?: data["previewText"]
        val isChatMessage =
            type == TYPE_CHAT_MESSAGE ||
                type == PushNotificationIntents.TYPE_SERVER_MESSAGE ||
                type == "direct_message" ||
                type == "group_message" ||
                type.isNullOrBlank()
        if (!isChatMessage && type != null) {
            Log.d(TAG, "Ignoring unknown push type: $type")
            return
        }

        val senderName = data["sender_username"]
            ?: data["senderUsername"]
            ?: data["sender_name"]
            ?: data["senderName"]
        val senderAvatar = data["sender_avatar"] ?: data["senderAvatar"]
        val senderAvatarColor = data["sender_avatar_color"] ?: data["senderAvatarColor"]
        val serverName = data["server_name"] ?: data["serverName"]
        val serverId = data["server_id"] ?: data["serverId"]
        val pushType = type.orEmpty()
        val isGroupChat =
            pushType == "group_message" ||
                pushType == PushNotificationIntents.TYPE_SERVER_MESSAGE ||
                data["is_group"] == "true"

        serviceScope.launch(Dispatchers.IO) {
            val resolvedBody =
                resolvePushMessageBody(
                    data = data,
                    messageType = messageType,
                    fallbackMessage = body.orEmpty(),
                    previewText = previewText,
                )

            if (ActiveChatState.shouldSuppressMessageNotification(chatId)) {
                Log.d(TAG, "Suppressing message notification — chat is open in foreground: $chatId")
                return@launch
            }

            val resolvedSenderName =
                senderName?.trim().orEmpty().ifBlank { title.trim() }.ifBlank { "Пользователь" }
            val preloadedSenderAvatar =
                NotificationAvatarHelper.avatarForNotification(
                    name = resolvedSenderName,
                    avatarUrl = senderAvatar,
                    colorHex = senderAvatarColor,
                )

            showChatPushNotification(
                chatId = chatId,
                title = title,
                message = resolvedBody,
                messageType = messageType,
                senderName = senderName,
                senderAvatar = senderAvatar,
                senderAvatarColor = senderAvatarColor,
                serverName = serverName,
                serverId = serverId,
                isGroupChat = isGroupChat,
                preloadedSenderAvatar = preloadedSenderAvatar,
            )
        }
    }

    private suspend fun resolvePushMessageBody(
        data: Map<String, String>,
        messageType: String?,
        fallbackMessage: String,
        previewText: String?,
    ): String {
        val encryptionVersion =
            data["encryption_version"]?.toIntOrNull()
                ?: data["encryptionVersion"]?.toIntOrNull()
                ?: 0
        val encrypted = encryptionVersion > 0
        val userId = entryPoint.tokenManager().peekUserFromToken()?.id?.trim().orEmpty()

        if (encrypted && userId.isNotBlank()) {
            val decrypted =
                MessageNotificationPreview.resolveEncryptedPushBody(
                    data = data,
                    userId = userId,
                    e2eCrypto = entryPoint.e2eCryptoService(),
                )
            if (!decrypted.isNullOrBlank()) {
                return decrypted
            }
            Log.d(TAG, "E2E push decrypt unavailable chatId=${data["chat_id"] ?: data["chatId"]}")
        }

        return MessageNotificationPreview.previewForPush(
            messageType = messageType,
            fallbackMessage = fallbackMessage,
            previewText = previewText,
            encrypted = encrypted,
        ).ifBlank { fallbackMessage.trim() }
            .ifBlank { "Новое сообщение" }
    }

    private fun showChatPushNotification(
        chatId: String?,
        title: String,
        message: String,
        messageType: String?,
        senderName: String?,
        senderAvatar: String?,
        senderAvatarColor: String?,
        serverName: String?,
        serverId: String?,
        isGroupChat: Boolean,
        preloadedSenderAvatar: android.graphics.Bitmap?,
    ) {
        try {
            chatNotificationManager.showPushNotification(
                chatId = chatId,
                title = title,
                message = message,
                messageType = messageType,
                thumbnailBitmap = null,
                senderName = senderName,
                senderAvatarUrl = senderAvatar,
                senderAvatarColor = senderAvatarColor,
                preloadedSenderAvatar = preloadedSenderAvatar,
                serverName = serverName,
                serverId = serverId,
                isGroupChat = isGroupChat,
            )
            Log.d(TAG, "Notification posted chatId=$chatId title=$title")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to post notification chatId=$chatId", e)
        }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "WhithinFcmService"
        private const val INCOMING_CALL_LOG_TAG = "WhithinIncomingCall"
        private const val DEFAULT_TITLE = "Whithin"
        private const val DEFAULT_CALLER_NAME = "Пользователь"
        private const val TYPE_INCOMING_CALL = "incoming_call"
        private const val TYPE_CALL_DISMISSED = "call_dismissed"
        private const val TYPE_CHAT_MESSAGE = "chat_message"
    }
}
