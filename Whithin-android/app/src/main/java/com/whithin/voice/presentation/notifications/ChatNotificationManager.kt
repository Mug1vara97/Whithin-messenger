package com.whithin.voice.presentation.notifications

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.graphics.drawable.IconCompat
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.whithin.voice.R
import com.whithin.voice.data.local.AppSettingsStore
import com.whithin.voice.presentation.ui.theme.AppThemePresets
import com.whithin.voice.presentation.ui.theme.primaryColorInt
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatNotificationManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appSettingsStore: AppSettingsStore,
) {
    /** Active stacked notification state per chat. */
    private val bundlesByChat = ConcurrentHashMap<String, ChatNotificationBundle>()

    /** Shown notification ids per normalized chat id for dismissal on open-chat. */
    private val notificationIdsByChat = ConcurrentHashMap<String, MutableSet<Int>>()

    private val incomingCallStatePrefs by lazy {
        context.getSharedPreferences(INCOMING_CALL_STATE_PREFS, Context.MODE_PRIVATE)
    }

    private data class StoredMessage(
        val text: String,
        val timestamp: Long,
        val senderName: String,
        val senderAvatarBitmap: Bitmap,
    )

    private data class ChatNotificationBundle(
        val conversationLabel: String,
        val chatTitle: String,
        val isGroupChat: Boolean,
        val serverId: String?,
        val messages: MutableList<StoredMessage>,
    )

    fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val customSound = customSoundUri()
        val chatChannel = NotificationChannel(
            CHAT_CHANNEL_ID,
            "Chat messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications about new chat messages"
            if (customSound != null) {
                val attributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                setSound(customSound, attributes)
            }
        }

        val friendRequestChannel = NotificationChannel(
            FRIEND_REQUEST_CHANNEL_ID,
            "Friend requests",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications about new friend requests"
            if (customSound != null) {
                val attributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                setSound(customSound, attributes)
            }
        }

        val incomingCallChannel = NotificationChannel(
            INCOMING_CALL_CHANNEL_ID,
            context.getString(R.string.incoming_call_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(R.string.incoming_call_channel_description)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = INCOMING_CALL_VIBRATION_PATTERN
            enableLights(true)
            setBypassDnd(true)
            val incomingCallSound = incomingCallSoundUri()
            if (incomingCallSound != null) {
                val attributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                setSound(incomingCallSound, attributes)
            }
        }

        val manager = context.getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannels(listOf(chatChannel, friendRequestChannel, incomingCallChannel))
    }

    fun showFriendRequestNotification(
        title: String,
        message: String,
        requestId: String?,
        senderId: String?
    ) {
        if (!hasNotificationPermission()) return
        createChannel()

        val notificationTitle = title.ifBlank { "Запрос в друзья" }
        val contentText = message.ifBlank { "Новый запрос в друзья" }
        val notificationId = friendRequestNotificationId(requestId, senderId)

        val openAppIntent = Intent(context, com.whithin.voice.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(PushNotificationIntents.EXTRA_OPEN_FRIENDS, true)
            requestId?.let { putExtra(PushNotificationIntents.EXTRA_REQUEST_ID, it) }
            senderId?.let { putExtra(PushNotificationIntents.EXTRA_SENDER_ID, it) }
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, FRIEND_REQUEST_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(notificationTitle)
            .setContentText(contentText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(contentText))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .applyCustomSound(FRIEND_REQUEST_CHANNEL_ID)
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }

    fun showMessageNotification(
        chatId: String,
        chatTitle: String,
        message: String,
        senderName: String? = null,
        senderAvatarUrl: String? = null,
        senderAvatarColor: String? = null,
    ) {
        showPushNotification(
            chatId = chatId,
            title = chatTitle,
            message = message,
            senderName = senderName,
            senderAvatarUrl = senderAvatarUrl,
            senderAvatarColor = senderAvatarColor,
        )
    }

    fun showPushNotification(
        chatId: String?,
        title: String,
        message: String,
        messageType: String? = null,
        thumbnailBitmap: Bitmap? = null,
        senderName: String? = null,
        senderAvatarUrl: String? = null,
        senderAvatarColor: String? = null,
        preloadedSenderAvatar: Bitmap? = null,
        serverName: String? = null,
        serverId: String? = null,
        isGroupChat: Boolean = false,
    ) {
        if (!hasNotificationPermission()) return
        val settings = appSettingsStore.peekSettings()
        if (!settings.inAppNotificationsEnabled) return
        createChannel()

        val normalizedChatId = chatId?.trim().orEmpty()
        val chatTitle = title.trim().ifBlank { "Whithin" }
        val contentText = message.ifBlank { "Новое сообщение" }
        val resolvedSenderName = senderName?.trim().orEmpty().ifBlank { chatTitle }.ifBlank { "Пользователь" }
        val conversationLabel = listOfNotNull(
            serverName?.trim()?.takeIf { it.isNotBlank() },
            chatTitle.takeIf { it.isNotBlank() },
        ).joinToString(" • ").ifBlank { chatTitle }
        val resolvedIsGroupChat = isGroupChat || serverName?.isNotBlank() == true
        val normalizedServerId = serverId?.trim()?.takeIf { it.isNotEmpty() }

        val senderAvatarBitmap =
            preloadedSenderAvatar?.let { NotificationAvatarHelper.scaleForLargeIcon(it) }
                ?: NotificationAvatarHelper.avatarForNotification(
                    name = resolvedSenderName,
                    avatarUrl = senderAvatarUrl,
                    colorHex = senderAvatarColor,
                )

        val chatKey = bundleKey(normalizedChatId, chatTitle)
        val timestamp = System.currentTimeMillis()
        val bundle =
            bundlesByChat.compute(chatKey) { _, existing ->
                val stored =
                    StoredMessage(
                        text = contentText,
                        timestamp = timestamp,
                        senderName = resolvedSenderName,
                        senderAvatarBitmap = senderAvatarBitmap,
                    )
                if (existing == null) {
                    ChatNotificationBundle(
                        conversationLabel = conversationLabel,
                        chatTitle = chatTitle,
                        isGroupChat = resolvedIsGroupChat,
                        serverId = normalizedServerId,
                        messages = mutableListOf(stored),
                    )
                } else {
                    existing.messages.add(stored)
                    while (existing.messages.size > MAX_STACKED_MESSAGES) {
                        existing.messages.removeAt(0)
                    }
                    existing.copy(
                        conversationLabel = conversationLabel,
                        chatTitle = chatTitle,
                        isGroupChat = resolvedIsGroupChat || existing.isGroupChat,
                        serverId = normalizedServerId ?: existing.serverId,
                    )
                }
            } ?: return

        val messagingMessages =
            bundle.messages.map { stored ->
                val senderPerson =
                    Person.Builder()
                        .setName(stored.senderName)
                        .setIcon(IconCompat.createWithBitmap(stored.senderAvatarBitmap))
                        .setKey(stored.senderName)
                        .build()
                NotificationCompat.MessagingStyle.Message(
                    stored.text,
                    stored.timestamp,
                    senderPerson,
                )
            }

        val style =
            buildMessagingStyle(
                conversationLabel = bundle.conversationLabel,
                messages = messagingMessages,
                isGroupChat = bundle.isGroupChat,
            )

        val notificationId = notificationIdForChat(chatKey)
        val latestMessage = bundle.messages.last()
        val latestSenderName = latestMessage.senderName
        val latestAvatar = latestMessage.senderAvatarBitmap

        val openAppIntent = Intent(context, com.whithin.voice.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (normalizedChatId.isNotBlank()) {
                putExtra(PushNotificationIntents.EXTRA_OPEN_CHAT, true)
                putExtra(PushNotificationIntents.EXTRA_CHAT_ID, normalizedChatId)
                putExtra(IncomingCallIntents.EXTRA_CHAT_ID, normalizedChatId)
            }
            putExtra(PushNotificationIntents.EXTRA_CHAT_TITLE, bundle.chatTitle)
            bundle.serverId?.takeIf { it.isNotBlank() }?.let { serverId ->
                putExtra(PushNotificationIntents.EXTRA_SERVER_ID, serverId)
                putExtra("type", PushNotificationIntents.TYPE_SERVER_MESSAGE)
            }
        }
        val contentPendingIntent = activityPendingIntent(openAppIntent, notificationId)

        val markReadIntent =
            Intent(context, ChatNotificationActionReceiver::class.java).apply {
                setPackage(context.packageName)
                action = PushNotificationIntents.ACTION_MARK_CHAT_READ
                putExtra(PushNotificationIntents.EXTRA_CHAT_ID, normalizedChatId)
            }
        val markReadAction =
            NotificationCompat.Action.Builder(
                0,
                "Пометить как прочитанное",
                broadcastPendingIntent(
                    markReadIntent,
                    actionRequestCode(chatKey, ACTION_MARK_READ_OFFSET),
                    mutable = false,
                ),
            ).build()

        val replyIntent =
            Intent(context, ChatNotificationActionReceiver::class.java).apply {
                setPackage(context.packageName)
                action = PushNotificationIntents.ACTION_REPLY_TO_CHAT
                putExtra(PushNotificationIntents.EXTRA_CHAT_ID, normalizedChatId)
            }
        val remoteInput =
            RemoteInput.Builder(PushNotificationIntents.EXTRA_REPLY_INPUT)
                .setLabel("Сообщение")
                .build()
        val replyAction =
            NotificationCompat.Action.Builder(
                0,
                "Ответить",
                broadcastPendingIntent(
                    replyIntent,
                    actionRequestCode(chatKey, ACTION_REPLY_OFFSET),
                    mutable = true,
                ),
            )
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .build()

        val notificationBuilder =
            NotificationCompat.Builder(context, CHAT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(
                    if (bundle.isGroupChat) bundle.conversationLabel else latestSenderName,
                )
                .setContentText(latestMessage.text)
                .setSubText(if (bundle.isGroupChat) latestSenderName else bundle.conversationLabel)
                .setStyle(style)
                .setLargeIcon(latestAvatar)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setWhen(timestamp)
                .setShowWhen(true)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setGroup(APP_MESSAGES_GROUP)
                .setSortKey(sortKeyForTimestamp(timestamp))
                .setContentIntent(contentPendingIntent)
                .applyCustomSound(CHAT_CHANNEL_ID, settings.soundNotificationsEnabled)

        if (normalizedChatId.isNotBlank()) {
            notificationBuilder
                .addAction(markReadAction)
                .addAction(replyAction)
        }

        val notification = notificationBuilder.build()

        val notificationManager = NotificationManagerCompat.from(context)
        try {
            // Summary first so the bundle appears immediately (even with a single chat).
            postMessagesGroupSummary(notificationManager, settings.soundNotificationsEnabled)
            // Re-post (not update in-place) so the channel sound plays on every message.
            if (settings.soundNotificationsEnabled) {
                notificationManager.cancel(notificationId)
            }
            notificationManager.notify(notificationId, notification)
            trackShownNotificationIds(chatKey, notificationId)
            Log.d(
                TAG,
                "Stacked notification chatKey=$chatKey count=${bundle.messages.size} " +
                    "activeChats=${bundlesByChat.size}",
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to post message notification", e)
        }
    }

    /** System tray notifications stay until cancelled; clearing when user opens the chat. */
    fun cancelNotificationsForChat(chatId: String) {
        val key = chatKey(chatId) ?: return
        bundlesByChat.remove(key)
        val nm = NotificationManagerCompat.from(context)
        notificationIdsByChat.remove(key)?.forEach { nm.cancel(it) }
        nm.cancel(notificationIdForChat(key))
        val settings = appSettingsStore.peekSettings()
        postMessagesGroupSummary(nm, settings.soundNotificationsEnabled)
    }

    fun cancelNotificationById(notificationId: Int) {
        if (notificationId != -1) {
            NotificationManagerCompat.from(context).cancel(notificationId)
        }
    }

    fun cancelIncomingCallNotification(chatId: String?, callerId: String?, roomId: String?) {
        val notificationId = incomingCallNotificationId(chatId, callerId, roomId)
        Log.d(
            INCOMING_CALL_LOG_TAG,
            "Cancel notification: chatId=$chatId roomId=$roomId callerId=$callerId notificationId=$notificationId",
        )
        cancelNotificationById(notificationId)
        IncomingCallRingingService.stop(context)
    }

    /** Stop ringing UI + notification when the call was handled on another device. */
    fun dismissActiveIncomingCall(chatId: String?, callerId: String? = null, roomId: String? = null) {
        Log.d(
            INCOMING_CALL_LOG_TAG,
            "Dismiss active incoming call: chatId=$chatId roomId=$roomId callerId=$callerId",
        )
        rememberIncomingCallDismissed(chatId = chatId, roomId = roomId)
        cancelIncomingCallNotification(chatId, callerId, roomId)
        context.sendBroadcast(
            Intent(IncomingCallIntents.ACTION_DISMISS_INCOMING_CALL_UI)
                .setPackage(context.packageName),
        )
    }

    fun stopIncomingCallRinging() {
        IncomingCallRingingService.stop(context)
    }

    /** Remember ids shown for this chat so we can dismiss the whole bundle. */
    private fun trackShownNotificationIds(chatKey: String, notificationId: Int) {
        notificationIdsByChat.computeIfAbsent(chatKey) { ConcurrentHashMap.newKeySet() }.add(notificationId)
    }

    fun showIncomingCallNotification(
        chatId: String?,
        roomId: String?,
        callerId: String?,
        callerName: String,
        callerAvatar: String? = null,
        callerAvatarColor: String? = null,
    ) {
        Log.d(
            INCOMING_CALL_LOG_TAG,
            "Show incoming call requested: chatId=$chatId roomId=$roomId callerId=$callerId caller=$callerName",
        )
        if (shouldSuppressRecentlyDismissedIncomingCall(chatId = chatId, roomId = roomId)) {
            Log.w(
                INCOMING_CALL_LOG_TAG,
                "Show incoming call suppressed: recently dismissed chatId=$chatId roomId=$roomId",
            )
            return
        }
        if (!hasNotificationPermission()) {
            Log.w(INCOMING_CALL_LOG_TAG, "Show incoming call skipped: notification permission/settings disabled")
            return
        }
        createChannel()

        val payload = createIncomingCallPayload(
            chatId = chatId,
            roomId = roomId,
            callerId = callerId,
            callerName = callerName,
            callerAvatar = callerAvatar,
            callerAvatarColor = callerAvatarColor,
        )
        Log.d(
            INCOMING_CALL_LOG_TAG,
            "Incoming call payload created: chatId=${payload.chatId} roomId=${payload.roomId} " +
                "callerId=${payload.callerId} notificationId=${payload.notificationId}",
        )
        postIncomingCallNotification(payload)
        IncomingCallUiLauncher.launchIncomingCallUi(context, payload)
    }

    fun postIncomingCallNotification(payload: IncomingCallPayload) {
        if (!hasNotificationPermission()) {
            Log.w(INCOMING_CALL_LOG_TAG, "Post incoming call skipped: notification permission/settings disabled")
            return
        }
        createChannel()
        runCatching {
            val notification = buildIncomingCallForegroundNotification(payload)
            NotificationManagerCompat.from(context).notify(payload.notificationId, notification)
            Log.d(
                INCOMING_CALL_LOG_TAG,
                "Notification posted: notificationId=${payload.notificationId} " +
                    "chatId=${payload.chatId} roomId=${payload.roomId}",
            )
        }.onFailure { error ->
            Log.e(INCOMING_CALL_LOG_TAG, "Notification post failed; using fallback", error)
            runCatching {
                NotificationManagerCompat.from(context).notify(
                    payload.notificationId,
                    buildIncomingCallFallbackNotification(payload),
                )
                Log.d(INCOMING_CALL_LOG_TAG, "Fallback notification posted: notificationId=${payload.notificationId}")
            }.onFailure { fallbackError ->
                Log.e(INCOMING_CALL_LOG_TAG, "Fallback notification post failed", fallbackError)
            }
        }
    }

    fun buildIncomingCallForegroundNotification(payload: IncomingCallPayload): Notification {
        createChannel()

        val incomingCallLabel = payload.callerName.ifBlank { "Пользователь" }

        val callerAvatarBitmap =
            NotificationAvatarHelper.avatarForNotification(
                incomingCallLabel,
                payload.callerAvatar,
                payload.callerAvatarColor,
            )

        return buildIncomingCallNotification(
            payload = payload,
            incomingCallLabel = incomingCallLabel,
            callerAvatarBitmap = callerAvatarBitmap,
        )
    }

    private fun createIncomingCallPayload(
        chatId: String?,
        roomId: String?,
        callerId: String?,
        callerName: String,
        callerAvatar: String?,
        callerAvatarColor: String?,
    ): IncomingCallPayload {
        val incomingCallLabel = callerName.ifBlank { "Пользователь" }
        return IncomingCallPayload(
            notificationId = incomingCallNotificationId(chatId, callerId, roomId),
            chatId = chatId,
            roomId = roomId,
            callerId = callerId,
            callerName = incomingCallLabel,
            callerAvatar = callerAvatar,
            callerAvatarColor = callerAvatarColor,
        )
    }

    private fun buildIncomingCallNotification(
        payload: IncomingCallPayload,
        incomingCallLabel: String,
        callerAvatarBitmap: Bitmap,
    ): Notification {
        val notificationId = payload.notificationId

        val callerPerson =
            Person.Builder()
                .setName(incomingCallLabel)
                .setIcon(IconCompat.createWithBitmap(callerAvatarBitmap))
                .setImportant(true)
                .build()

        val openAppIntent =
            Intent(context, IncomingCallActivity::class.java).apply {
                flags =
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                putIncomingCallExtras(payload)
            }
        val fullScreenPendingIntent = fullScreenActivityPendingIntent(openAppIntent, notificationId)
        val canUseFullScreenIntent =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                (context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)
                    ?.canUseFullScreenIntent()
            } else {
                null
            }
        Log.d(
            INCOMING_CALL_LOG_TAG,
            "Build notification: notificationId=$notificationId channel=$INCOMING_CALL_CHANNEL_ID " +
                "fullScreenIntent=true canUseFullScreenIntent=$canUseFullScreenIntent " +
                "chatId=${payload.chatId} roomId=${payload.roomId}",
        )

        val acceptIntent = buildAcceptCallMainActivityIntent(context, payload)
        val acceptPendingIntent =
            fullScreenActivityPendingIntent(acceptIntent, notificationId + 1)

        val declineIntent =
            Intent(context, IncomingCallActionReceiver::class.java).apply {
                setPackage(context.packageName)
                action = IncomingCallIntents.ACTION_DECLINE_CALL
                putIncomingCallExtras(payload)
            }
        val declinePendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + 2,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val themePreset =
            AppThemePresets.find(appSettingsStore.peekThemePresetId())
                ?: AppThemePresets.all.first()
        val accentArgb = themePreset.primaryColorInt()

        val notificationTitle = context.getString(R.string.incoming_call_notification_title)
        val notificationText =
            context.getString(R.string.incoming_call_notification_text, incomingCallLabel)

        val builder =
            NotificationCompat.Builder(context, INCOMING_CALL_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_call)
                .setContentTitle(notificationTitle)
                .setContentText(notificationText)
                .setLargeIcon(callerAvatarBitmap)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(accentArgb)
                .setColorized(true)
                .setAutoCancel(false)
                .setOngoing(true)
                .setTimeoutAfter(INCOMING_CALL_TIMEOUT_MS)
                .setOnlyAlertOnce(false)
                .setContentIntent(fullScreenPendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .applyCustomSound(INCOMING_CALL_CHANNEL_ID)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            runCatching {
                val callStyle =
                    NotificationCompat.CallStyle.forIncomingCall(
                        callerPerson,
                        declinePendingIntent,
                        acceptPendingIntent,
                    )
                builder.setStyle(callStyle)
            }.onFailure { error ->
                Log.w(TAG, "CallStyle unavailable; using action buttons", error)
                builder
                    .setStyle(NotificationCompat.BigTextStyle().bigText(notificationText))
                    .addAction(
                        0,
                        context.getString(R.string.incoming_call_decline),
                        declinePendingIntent,
                    )
                    .addAction(
                        0,
                        context.getString(R.string.incoming_call_accept),
                        acceptPendingIntent,
                    )
            }
        } else {
            builder
                .setStyle(NotificationCompat.BigTextStyle().bigText(notificationText))
                .addAction(
                    0,
                    context.getString(R.string.incoming_call_decline),
                    declinePendingIntent,
                )
                .addAction(
                    0,
                    context.getString(R.string.incoming_call_accept),
                    acceptPendingIntent,
                )
        }

        return builder.build()
    }

    private fun buildIncomingCallFallbackNotification(payload: IncomingCallPayload): Notification {
        val incomingCallLabel = payload.callerName.ifBlank { "Пользователь" }
        val callerAvatarBitmap =
            NotificationAvatarHelper.avatarForNotification(
                incomingCallLabel,
                payload.callerAvatar,
                payload.callerAvatarColor,
            )
        return buildIncomingCallNotification(
            payload = payload,
            incomingCallLabel = incomingCallLabel,
            callerAvatarBitmap = callerAvatarBitmap,
        )
    }

    private fun fullScreenActivityPendingIntent(intent: Intent, requestCode: Int): PendingIntent {
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        // Do not pass ActivityOptions with background start mode here — ColorOS/Android 15
        // rejects PendingIntent creation with pendingIntentBackgroundActivityStartMode set.
        // Full-screen call UI is allowed via USE_FULL_SCREEN_INTENT + CATEGORY_CALL.
        return PendingIntent.getActivity(context, requestCode, intent, flags)
    }

    private fun buildMessagingStyle(
        conversationLabel: String,
        messages: List<NotificationCompat.MessagingStyle.Message>,
        isGroupChat: Boolean,
    ): NotificationCompat.MessagingStyle {
        val selfPerson = Person.Builder().setName("Вы").build()
        val style =
            NotificationCompat.MessagingStyle(selfPerson)
                .setConversationTitle(conversationLabel)
                .setGroupConversation(isGroupChat)
        messages.forEach { style.addMessage(it) }
        return style
    }

    private fun activityPendingIntent(intent: Intent, requestCode: Int): PendingIntent =
        PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun broadcastPendingIntent(intent: Intent, requestCode: Int, mutable: Boolean): PendingIntent {
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        flags =
            if (mutable && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags or PendingIntent.FLAG_MUTABLE
            } else {
                flags or PendingIntent.FLAG_IMMUTABLE
            }
        return PendingIntent.getBroadcast(context, requestCode, intent, flags)
    }

    private fun hasNotificationPermission(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "POST_NOTIFICATIONS not granted — notification skipped")
            return false
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            Log.w(TAG, "Notifications disabled in system settings — notification skipped")
            return false
        }
        return true
    }

    private fun chatKey(raw: String): String? =
        raw.trim().lowercase(Locale.ROOT).takeIf { it.isNotBlank() }

    private fun bundleKey(normalizedChatId: String, chatTitle: String): String =
        chatKey(normalizedChatId) ?: chatTitle.trim().lowercase(Locale.ROOT).ifBlank { "whithin" }

    private fun notificationIdForChat(chatKey: String): Int =
        ("chat_notif_$chatKey").hashCode() and 0x7FFFFFFF

    private fun actionRequestCode(chatKey: String, offset: Int): Int =
        (chatKey.hashCode() + offset) and 0x7FFFFFFF

    /** Parent card for all chat notifications — shown immediately, even for a single chat. */
    private fun postMessagesGroupSummary(
        notificationManager: NotificationManagerCompat,
        soundEnabled: Boolean,
    ) {
        if (bundlesByChat.isEmpty()) {
            notificationManager.cancel(MESSAGES_SUMMARY_NOTIFICATION_ID)
            return
        }

        val sortedBundles =
            bundlesByChat.values.sortedByDescending { bundle -> bundle.messages.last().timestamp }
        val totalMessages = sortedBundles.sumOf { it.messages.size }
        val activeChats = sortedBundles.size
        val previewLines =
            sortedBundles.take(MAX_SUMMARY_LINES).map { bundle ->
                val latest = bundle.messages.last()
                val label =
                    if (bundle.isGroupChat) {
                        "${latest.senderName}: ${latest.text}"
                    } else {
                        latest.text
                    }
                "${bundle.conversationLabel}: $label"
            }

        val contentText =
            when {
                activeChats == 1 && totalMessages == 1 ->
                    previewLines.firstOrNull() ?: "Новое сообщение"
                activeChats == 1 ->
                    "$totalMessages новых сообщений"
                else ->
                    "$totalMessages новых сообщений в $activeChats чатах"
            }

        val inboxStyle =
            NotificationCompat.InboxStyle()
                .setBigContentTitle(APP_NAME)
                .setSummaryText(contentText)
                .also { style -> previewLines.forEach { style.addLine(it) } }

        val openAppIntent =
            Intent(context, com.whithin.voice.MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        val contentPendingIntent =
            activityPendingIntent(openAppIntent, MESSAGES_SUMMARY_NOTIFICATION_ID)

        val summaryBuilder =
            NotificationCompat.Builder(context, CHAT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(APP_NAME)
                .setContentText(contentText)
                .setStyle(inboxStyle)
                .setGroup(APP_MESSAGES_GROUP)
                .setGroupSummary(true)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOnlyAlertOnce(false)
                .setSilent(true)
                .setContentIntent(contentPendingIntent)

        if (!soundEnabled) {
            summaryBuilder.setSilent(true)
        }

        try {
            notificationManager.notify(MESSAGES_SUMMARY_NOTIFICATION_ID, summaryBuilder.build())
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to post messages group summary", e)
        }
    }

    private fun sortKeyForTimestamp(timestamp: Long): String =
        (Long.MAX_VALUE - timestamp).toString().padStart(20, '0')

    private fun customSoundUri(): Uri? {
        val soundResId = context.resources.getIdentifier(
            "notification_sound",
            "raw",
            context.packageName
        )
        if (soundResId == 0) return null
        return Uri.parse("android.resource://${context.packageName}/$soundResId")
    }

    private fun incomingCallSoundUri(): Uri? {
        val soundResId = context.resources.getIdentifier(
            "den_den_mushi",
            "raw",
            context.packageName
        )
        if (soundResId == 0) return null
        return Uri.parse("android.resource://${context.packageName}/$soundResId")
    }

    private fun NotificationCompat.Builder.applyCustomSound(
        channelId: String,
        soundEnabled: Boolean = true,
    ): NotificationCompat.Builder {
        if (!soundEnabled) {
            return setSilent(true)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) return this
        val customSound = when (channelId) {
            INCOMING_CALL_CHANNEL_ID -> incomingCallSoundUri()
            else -> customSoundUri()
        } ?: return this
        return setSound(customSound)
    }

    private fun incomingCallNotificationId(chatId: String?, callerId: String?, roomId: String?): Int {
        val base = listOf(chatId, roomId)
            .filterNotNull()
            .joinToString("|")
            .ifBlank { "incoming_call_default" }
        return "incoming_$base".hashCode()
    }

    private fun rememberIncomingCallDismissed(chatId: String?, roomId: String?) {
        val now = System.currentTimeMillis()
        val keys = incomingCallSuppressionKeys(chatId, roomId)
        if (keys.isEmpty()) return
        incomingCallStatePrefs.edit().apply {
            keys.forEach { key ->
                putLong(key, now)
            }
        }.apply()
        Log.d(INCOMING_CALL_LOG_TAG, "Remember dismissed incoming call keys=$keys at=$now")
    }

    private fun shouldSuppressRecentlyDismissedIncomingCall(chatId: String?, roomId: String?): Boolean {
        val now = System.currentTimeMillis()
        val keys = incomingCallSuppressionKeys(chatId, roomId)
        if (keys.isEmpty()) return false
        var matchedKey: String? = null
        val shouldSuppress =
            keys.any { key ->
                val dismissedAt = incomingCallStatePrefs.getLong(key, 0L)
                val recent = dismissedAt > 0L && now - dismissedAt <= INCOMING_CALL_SUPPRESS_AFTER_DISMISS_MS
                if (recent) {
                    matchedKey = key
                }
                recent
            }
        if (shouldSuppress) {
            Log.d(INCOMING_CALL_LOG_TAG, "Suppression matched key=$matchedKey ageMs=${now - incomingCallStatePrefs.getLong(matchedKey, now)}")
        }
        cleanupOldIncomingCallSuppressions(now)
        return shouldSuppress
    }

    private fun cleanupOldIncomingCallSuppressions(now: Long) {
        val staleKeys =
            incomingCallStatePrefs.all
                .mapNotNull { (key, value) ->
                    val timestamp = value as? Long ?: return@mapNotNull key
                    if (now - timestamp > INCOMING_CALL_SUPPRESS_AFTER_DISMISS_MS) key else null
                }
        if (staleKeys.isEmpty()) return
        incomingCallStatePrefs.edit().apply {
            staleKeys.forEach(::remove)
        }.apply()
    }

    private fun incomingCallSuppressionKeys(chatId: String?, roomId: String?): Set<String> {
        return listOf(chatId, roomId)
            .mapNotNull { it?.trim()?.takeIf(String::isNotBlank) }
            .map { "dismissed_$it" }
            .toSet()
    }

    private fun friendRequestNotificationId(requestId: String?, senderId: String?): Int {
        val base = listOf(requestId, senderId)
            .filterNotNull()
            .joinToString("|")
            .ifBlank { "friend_request_default" }
        return "friend_request_$base".hashCode()
    }

    companion object {
        private const val TAG = "ChatNotificationManager"
        private const val INCOMING_CALL_LOG_TAG = "WhithinIncomingCall"
        private const val INCOMING_CALL_STATE_PREFS = "incoming_call_state"
        private const val INCOMING_CALL_SUPPRESS_AFTER_DISMISS_MS = 30_000L
        private const val APP_NAME = "Whithin"
        /** All chat child notifications share this group — bundled under one parent card. */
        private const val APP_MESSAGES_GROUP = "com.whithin.voice.messages"
        private const val MESSAGES_SUMMARY_NOTIFICATION_ID = 9001
        // Bump channel id so Android re-creates channel with custom sound settings.
        private const val CHAT_CHANNEL_ID = "chat_messages_v4"
        private const val FRIEND_REQUEST_CHANNEL_ID = "friend_requests_v1"
        private const val INCOMING_CALL_CHANNEL_ID = "incoming_calls_v5"
        private const val INCOMING_CALL_TIMEOUT_MS = 60_000L
        private val INCOMING_CALL_VIBRATION_PATTERN = longArrayOf(0, 700, 500, 700)
        private const val MAX_STACKED_MESSAGES = 12
        private const val MAX_SUMMARY_LINES = 5
        private const val ACTION_MARK_READ_OFFSET = 31_001
        private const val ACTION_REPLY_OFFSET = 31_002
    }
}
