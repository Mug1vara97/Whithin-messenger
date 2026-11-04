package com.whithin.voice.data.signalr

import android.util.Log
import com.google.gson.Gson
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.whithin.voice.data.local.TokenManager
import com.google.gson.JsonObject
import com.whithin.voice.data.model.AvailableGroupUser
import com.whithin.voice.data.model.ChatDetailInfo
import com.whithin.voice.data.model.ChatParticipant
import com.whithin.voice.data.model.Message
import com.whithin.voice.data.model.MessagePoll
import com.whithin.voice.data.model.MessagesPageMeta
import com.whithin.voice.util.ChatOpenPerfLog
import io.reactivex.rxjava3.core.Single
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.UUID
import com.google.gson.reflect.TypeToken
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class ChatHub @Inject constructor(
    private val tokenManager: TokenManager,
    private val gson: Gson
) {
    private var connection: HubConnection? = null
    private var currentChatId: String? = null
    private var connectedUserId: String? = null
    private val backgroundJoinedGroups = mutableSetOf<String>()
    private val deliveryAcknowledgedKeys = mutableSetOf<String>()
    private val reconnectController = SignalRReconnectController("ChatHub")
    private var onReconnected: (() -> Unit)? = null
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    
    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()
    
    private var onMessagesReceived: ((List<Message>) -> Unit)? = null
    private var onMessagesMetaReceived: ((MessagesPageMeta) -> Unit)? = null
    private var onMessageReceived: ((Message) -> Unit)? = null
    private var onMessageEdited: ((String, String) -> Unit)? = null
    private var onMessageDeleted: ((String) -> Unit)? = null
    private var onBackgroundMessageDeleted: ((String) -> Unit)? = null

    private var onChatInfoReceived: ((ChatDetailInfo) -> Unit)? = null
    private var onChatParticipantsReceived: ((List<ChatParticipant>) -> Unit)? = null
    private var onChatDeletedSignal: ((String) -> Unit)? = null
    private var onUserTyping: ((String, String, String) -> Unit)? = null
    private var onUserStoppedTyping: ((String, String) -> Unit)? = null
    private var onMessageStatusChanged: ((String, String) -> Unit)? = null
    private var onAvailableUsersReceived: ((List<AvailableGroupUser>) -> Unit)? = null
    private var onUserAddedToGroup: ((String) -> Unit)? = null
    private var onGroupUpdated: ((String, String) -> Unit)? = null
    private var onMessagePinned: ((String, String?) -> Unit)? = null
    private var onMessageUnpinned: ((String) -> Unit)? = null
    private var onPinnedMessagesReceived: ((List<Message>) -> Unit)? = null
    private var onPollUpdated: ((String, MessagePoll?) -> Unit)? = null
    private var onCallMissed: ((String, String) -> Unit)? = null
    private var onCallAccepted: ((String, String?) -> Unit)? = null
    private var onCallCancelled: ((String, String) -> Unit)? = null
    private var onIncomingCallDismissed: ((String, String, String?) -> Unit)? = null
    private var onIncomingCall: ((String, String?, String, String) -> Unit)? = null

    fun setOnIncomingCall(callback: ((String, String?, String, String) -> Unit)?) {
        onIncomingCall = callback
    }

    fun setOnCallMissed(callback: ((String, String) -> Unit)?) {
        onCallMissed = callback
    }

    fun setOnCallAccepted(callback: ((String, String?) -> Unit)?) {
        onCallAccepted = callback
    }

    fun setOnCallCancelled(callback: ((String, String) -> Unit)?) {
        onCallCancelled = callback
    }

    fun setOnIncomingCallDismissed(callback: ((String, String, String?) -> Unit)?) {
        onIncomingCallDismissed = callback
    }

    fun setOnAvailableUsersReceived(callback: ((List<AvailableGroupUser>) -> Unit)?) {
        onAvailableUsersReceived = callback
    }

    fun setOnUserAddedToGroup(callback: ((String) -> Unit)?) {
        onUserAddedToGroup = callback
    }

    fun setOnGroupUpdated(callback: ((String, String) -> Unit)?) {
        onGroupUpdated = callback
    }

    fun setOnMessagePinned(callback: ((String, String?) -> Unit)?) {
        onMessagePinned = callback
    }

    fun setOnMessageUnpinned(callback: ((String) -> Unit)?) {
        onMessageUnpinned = callback
    }

    fun setOnPinnedMessagesReceived(callback: ((List<Message>) -> Unit)?) {
        onPinnedMessagesReceived = callback
    }

    fun setOnPollUpdated(callback: ((String, MessagePoll?) -> Unit)?) {
        onPollUpdated = callback
    }

    fun setOnChatInfoReceived(callback: ((ChatDetailInfo) -> Unit)?) {
        onChatInfoReceived = callback
    }

    fun setOnChatParticipantsReceived(callback: ((List<ChatParticipant>) -> Unit)?) {
        onChatParticipantsReceived = callback
    }

    fun setOnChatDeletedSignal(callback: ((String) -> Unit)?) {
        onChatDeletedSignal = callback
    }

    fun setOnUserTyping(callback: ((String, String, String) -> Unit)?) {
        onUserTyping = callback
    }

    fun setOnUserStoppedTyping(callback: ((String, String) -> Unit)?) {
        onUserStoppedTyping = callback
    }

    fun setOnMessageStatusChanged(callback: ((String, String) -> Unit)?) {
        onMessageStatusChanged = callback
    }

    private fun chatIdFromDeletedPayload(raw: Any): String? {
        return try {
            when (raw) {
                is String -> raw.trim().trim('"')
                else -> {
                    val el = gson.toJsonTree(raw)
                    if (!el.isJsonObject) null
                    else {
                        val o = el.asJsonObject
                        when {
                            o.has("chatId") && !o["chatId"].isJsonNull ->
                                o["chatId"].asString
                            o.has("ChatId") && !o["ChatId"].isJsonNull ->
                                o["ChatId"].asString
                            else -> null
                        }
                    }
                }
            }
        } catch (_: Exception) {
            null
        }
    }

    /** Connected to this exact chat (not switching, not idle). */
    fun isActiveSessionFor(chatId: String): Boolean =
        connection?.connectionState == HubConnectionState.CONNECTED && currentChatId == chatId

    /** Warm GroupChatHub session for background delivery ack (replaces MessageDeliveryHub). */
    suspend fun ensureUserSession(userId: String): Result<Unit> {
        return try {
            val normalizedUserId = userId.trim()
            if (normalizedUserId.isBlank()) {
                return Result.failure(IllegalArgumentException("userId is blank"))
            }
            connectedUserId = normalizedUserId

            if (connection?.connectionState == HubConnectionState.CONNECTED) {
                acknowledgePendingDeliveries()
                return Result.success(Unit)
            }

            reconnectController.enable()
            connection = buildConnection()
            registerEventHandlers(connection!!)

            suspendCancellableCoroutine { continuation ->
                try {
                    connection?.start()?.blockingAwait()
                    Log.d("ChatHub", "User session connected for userId=$normalizedUserId")
                    _isConnected.value = true
                    acknowledgePendingDeliveries()
                    continuation.resume(Unit)
                } catch (error: Exception) {
                    Log.e("ChatHub", "User session connection failed", error)
                    _isConnected.value = false
                    continuation.resumeWithException(error)
                }
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "ensureUserSession failed", e)
            Result.failure(e)
        }
    }

    fun syncBackgroundChatGroups(
        chatIds: Collection<String>,
        activeChatId: String? = null,
        maxGroups: Int = MAX_BACKGROUND_GROUPS,
    ) {
        val conn = connection ?: return
        if (conn.connectionState != HubConnectionState.CONNECTED) return

        val active = activeChatId?.trim()?.takeIf { it.isNotBlank() }
        val desired = LinkedHashSet<String>()
        active?.let { desired.add(it) }
        chatIds
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .forEach { chatId ->
                if (desired.size >= maxGroups) return@forEach
                desired.add(chatId)
            }

        val stale = backgroundJoinedGroups.filter { it !in desired }
        stale.forEach { leaveBackgroundGroup(it) }

        desired.forEach { chatId ->
            if (backgroundJoinedGroups.contains(chatId)) return@forEach
            try {
                conn.invoke("JoinGroup", chatId)?.blockingAwait()
                backgroundJoinedGroups.add(chatId)
                Log.d("ChatHub", "Background joined group $chatId")
            } catch (e: Exception) {
                Log.w("ChatHub", "Background join failed for $chatId", e)
            }
        }

        acknowledgePendingDeliveries()
    }

    fun leaveBackgroundGroup(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        if (!backgroundJoinedGroups.remove(normalized)) return
        try {
            connection?.invoke("LeaveGroup", normalized)?.blockingAwait()
            Log.d("ChatHub", "Background left group $normalized")
        } catch (e: Exception) {
            Log.w("ChatHub", "Background leave failed for $normalized", e)
        }
    }
    
    suspend fun connect(chatId: String): Result<Unit> {
        return try {
            val normalizedChatId = chatId.trim()
            if (normalizedChatId.isBlank()) {
                return Result.failure(IllegalArgumentException("chatId is blank"))
            }

            // If already connected to the same chat, refresh subscriptions
            if (connection?.connectionState == HubConnectionState.CONNECTED && currentChatId == normalizedChatId) {
                Log.d("ChatHub", "Already connected to chat: $normalizedChatId")
                ChatOpenPerfLog.mark(normalizedChatId, "chatHub_mode", "same_chat_resubscribe")
                val resubStartedAt = android.os.SystemClock.elapsedRealtime()
                resubscribeActiveChat()
                ChatOpenPerfLog.mark(
                    normalizedChatId,
                    "chatHub_resubscribe_done",
                    "ms=${android.os.SystemClock.elapsedRealtime() - resubStartedAt}",
                )
                return Result.success(Unit)
            }
            
            // If connected to different chat, switch active chat without tearing down WebSocket
            if (connection?.connectionState == HubConnectionState.CONNECTED && currentChatId != normalizedChatId) {
                reconnectController.enable()
                val previousChatId = currentChatId?.trim().orEmpty()
                Log.d("ChatHub", "Switching active chat $currentChatId -> $normalizedChatId")
                ChatOpenPerfLog.mark(
                    normalizedChatId,
                    "chatHub_mode",
                    "switch from=$currentChatId",
                )
                if (previousChatId.isNotBlank() && !previousChatId.equals(normalizedChatId, ignoreCase = true)) {
                    leaveGroup(previousChatId)
                }
                currentChatId = normalizedChatId
                val switchStartedAt = android.os.SystemClock.elapsedRealtime()
                resubscribeActiveChat()
                ChatOpenPerfLog.mark(
                    normalizedChatId,
                    "chatHub_switch_done",
                    "ms=${android.os.SystemClock.elapsedRealtime() - switchStartedAt}",
                )
                return Result.success(Unit)
            }
            
            ChatOpenPerfLog.mark(normalizedChatId, "chatHub_mode", "cold_connect")
            if (connection != null) {
                reconnectController.pauseScheduledReconnect = true
                try {
                    connection?.stop()
                } catch (_: Exception) {
                }
                connection = null
                reconnectController.pauseScheduledReconnect = false
            }

            currentChatId = normalizedChatId
            reconnectController.enable()
            connection = buildConnection()
            registerEventHandlers(connection!!)

            suspendCancellableCoroutine { continuation ->
                try {
                    val startMs = android.os.SystemClock.elapsedRealtime()
                    connection?.start()?.blockingAwait()
                    val connectMs = android.os.SystemClock.elapsedRealtime() - startMs
                    Log.d("ChatHub", "Connected successfully in ${connectMs}ms")
                    ChatOpenPerfLog.mark(
                        normalizedChatId,
                        "chatHub_websocket_connected",
                        "ms=$connectMs",
                    )
                    _isConnected.value = true
                    val resubStartedAt = android.os.SystemClock.elapsedRealtime()
                    resubscribeActiveChat()
                    ChatOpenPerfLog.mark(
                        normalizedChatId,
                        "chatHub_cold_resubscribe_done",
                        "ms=${android.os.SystemClock.elapsedRealtime() - resubStartedAt}",
                    )
                    continuation.resume(Unit)
                } catch (error: Exception) {
                    Log.e("ChatHub", "Connection failed", error)
                    _isConnected.value = false
                    continuation.resumeWithException(error)
                }
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "Error connecting", e)
            _isConnected.value = false
            Result.failure(e)
        }
    }

    private fun buildConnection(): HubConnection {
        val conn =
            HubConnectionBuilder.create("https://whithin.ru/groupchathub")
                .withFreshAccessToken(tokenManager)
                .build()
        reconnectController.bindOnClosed(conn) { restartConnection() }
        return conn
    }

    private suspend fun restartConnection(): Result<Unit> {
        val chatId = currentChatId?.trim().orEmpty()
        if (chatId.isBlank() || !reconnectController.isEnabled) {
            return Result.failure(IllegalStateException("ChatHub reconnect skipped"))
        }
        return reconnectController.withReconnectPaused {
            try {
                try {
                    connection?.stop()
                } catch (_: Exception) {
                }
                connection = buildConnection()
                registerEventHandlers(connection!!)
                connection?.start()?.blockingAwait()
                _isConnected.value = true
                resubscribeActiveChat()
                onReconnected?.invoke()
                Result.success(Unit)
            } catch (e: Exception) {
                _isConnected.value = false
                Result.failure(e)
            }
        }
    }

    private fun resubscribeActiveChat() {
        val chatId = currentChatId?.trim().orEmpty()
        if (chatId.isBlank()) return
        val startedAt = android.os.SystemClock.elapsedRealtime()
        joinGroupAwait(chatId)
        getMessages(chatId)
        acknowledgePendingDeliveries()
        ChatOpenPerfLog.mark(
            chatId,
            "chatHub_resubscribe_invoked",
            "ms=${android.os.SystemClock.elapsedRealtime() - startedAt}",
        )
        CoroutineScope(Dispatchers.IO).launch {
            requestChatInfo(chatId)
            requestChatParticipants(chatId)
            requestPinnedMessages(chatId)
        }
    }

    private fun registerEventHandlers(conn: HubConnection) {
            conn.on("ReceiveMessages", { raw: Any ->
                try {
                    val json = gson.toJson(raw)
                    val type = object : TypeToken<List<Message>>() {}.type
                    val messageList: List<Message> = gson.fromJson(json, type) ?: emptyList()
                    Log.d("ChatHub", "Received ${messageList.size} messages")
                    val processedMessages =
                        messageList.map { message ->
                            if (message.senderUsernameValue.isEmpty() && !message.username.isNullOrEmpty()) {
                                message.copy(senderUsername = message.username)
                            } else {
                                message
                            }
                        }
                    onMessagesReceived?.invoke(processedMessages)
                    Log.d("ChatHub", "Processed ${processedMessages.size} messages page")
                } catch (e: Exception) {
                    Log.e("ChatHub", "Error handling ReceiveMessages", e)
                }
            }, Any::class.java)

            conn.on("ReceiveMessagesMeta", { payload: Any ->
                try {
                    val meta = parseMessagesPageMeta(payload) ?: return@on
                    onMessagesMetaReceived?.invoke(meta)
                } catch (e: Exception) {
                    Log.e("ChatHub", "Error handling ReceiveMessagesMeta", e)
                }
            }, Any::class.java)
            
            conn.on("MessageSent", { messageData: Any ->
                try {
                    Log.d("ChatHub", "MessageSent event received: $messageData")
                    // Convert to Message object using Gson
                    val messageJson = gson.toJson(messageData)
                    Log.d("ChatHub", "Message JSON: $messageJson")
                    val message = gson.fromJson(messageJson, Message::class.java)
                    Log.d("ChatHub", "Deserialized message - messageId: ${message.messageIdValue}, senderUsername: ${message.senderUsername}, username: ${message.username}, senderUsernameValue: ${message.senderUsernameValue}")
                    
                    // If username is set but senderUsername is not, copy it
                    // MessageSent sends "username" field, not "senderUsername"
                    val finalMessage = if ((message.senderUsername.isNullOrEmpty() && message.senderUsernameAlt.isNullOrEmpty()) && !message.username.isNullOrEmpty()) {
                        Log.d("ChatHub", "Copying username to senderUsername: ${message.username}")
                        message.copy(senderUsername = message.username)
                    } else {
                        message
                    }
                    
                    Log.d("ChatHub", "Final message - senderUsernameValue: ${finalMessage.senderUsernameValue}, content: ${finalMessage.contentValue}")

                    maybeAcknowledgeBackgroundDelivery(finalMessage)

                    val activeChatId = currentChatId?.trim().orEmpty()
                    val messageChatId = finalMessage.chatIdValue.trim()
                    if (activeChatId.isBlank() || !messageChatId.equals(activeChatId, ignoreCase = true)) {
                        return@on
                    }

                    val currentMessages = _messages.value.toMutableList()
                    if (!currentMessages.any { it.messageIdValue == finalMessage.messageIdValue }) {
                        currentMessages.add(finalMessage)
                        _messages.value = currentMessages
                        onMessageReceived?.invoke(finalMessage)
                        Log.d("ChatHub", "Added new message, total: ${_messages.value.size}, senderUsername: ${finalMessage.senderUsernameValue}")
                    } else {
                        Log.d("ChatHub", "Message already exists, updating it")
                        val index = currentMessages.indexOfFirst {
                            it.messageIdValue == finalMessage.messageIdValue
                        }
                        if (index >= 0) {
                            currentMessages[index] = finalMessage
                            _messages.value = currentMessages
                            Log.d("ChatHub", "Updated message at index $index, senderUsername: ${finalMessage.senderUsernameValue}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("ChatHub", "Error handling MessageSent", e)
                    e.printStackTrace()
                }
            }, Any::class.java)
            
            conn.on("MessageEdited", { messageId: String, newContent: String ->
                try {
                    Log.d("ChatHub", "MessageEdited event received - messageId: $messageId")
                    val currentMessages = _messages.value.toMutableList()
                    val index = currentMessages.indexOfFirst { 
                        it.messageIdValue == messageId 
                    }
                    if (index >= 0) {
                        val updatedMessage = currentMessages[index].copy(
                            content = newContent,
                            isEdited = true
                        )
                        currentMessages[index] = updatedMessage
                        _messages.value = currentMessages
                        onMessageEdited?.invoke(messageId, newContent)
                        Log.d("ChatHub", "Updated message at index $index")
                    }
                } catch (e: Exception) {
                    Log.e("ChatHub", "Error handling MessageEdited", e)
                }
            }, String::class.java, String::class.java)
            
            conn.on("MessageDeleted", { messageId: String ->
                try {
                    val normalizedId = messageId.trim().trim('"')
                    Log.d("ChatHub", "MessageDeleted event received - $normalizedId")
                    val currentMessages = _messages.value.toMutableList()
                    currentMessages.removeAll { it.messageIdValue == normalizedId }
                    _messages.value = currentMessages
                    onBackgroundMessageDeleted?.invoke(normalizedId)
                    onMessageDeleted?.invoke(normalizedId)
                    Log.d("ChatHub", "Removed message, total: ${_messages.value.size}")
                } catch (e: Exception) {
                    Log.e("ChatHub", "Error handling MessageDeleted", e)
                }
            }, String::class.java)

            conn.on(
                "MessageStatusChanged",
                { messageId: String, status: String ->
                    try {
                        onMessageStatusChanged?.invoke(messageId, status)
                    } catch (e: Exception) {
                        Log.e("ChatHub", "Error handling MessageStatusChanged", e)
                    }
                },
                String::class.java,
                String::class.java,
            )
            
            conn.on("Error", { error: String ->
                Log.e("ChatHub", "SignalR error received: $error")
            }, String::class.java)

            conn.on("ChatInfoReceived", { payload: Any ->
                try {
                    val dto = gson.fromJson(gson.toJson(payload), ChatDetailInfo::class.java)
                        ?: return@on
                    onChatInfoReceived?.invoke(dto)
                } catch (e: Exception) {
                    Log.e("ChatHub", "ChatInfoReceived parse error", e)
                }
            }, Any::class.java)

            conn.on(
                "ReceiveChatParticipants",
                { raw: Any ->
                    try {
                        val json = gson.toJson(raw)
                        val type = object : TypeToken<List<ChatParticipant>>() {}.type
                        val list: List<ChatParticipant> = gson.fromJson(json, type) ?: emptyList()
                        onChatParticipantsReceived?.invoke(list)
                    } catch (e: Exception) {
                        Log.e("ChatHub", "ReceiveChatParticipants parse error", e)
                    }
                },
                Any::class.java,
            )

            conn.on("chatdeleted", { raw: Any ->
                val cid = chatIdFromDeletedPayload(raw)
                if (!cid.isNullOrBlank()) {
                    onChatDeletedSignal?.invoke(cid)
                }
            }, Any::class.java)

            conn.on(
                "ReceiveAvailableUsers",
                { raw: Any ->
                    try {
                        val json = gson.toJson(raw)
                        val type = object : TypeToken<List<AvailableGroupUser>>() {}.type
                        val list: List<AvailableGroupUser> = gson.fromJson(json, type) ?: emptyList()
                        onAvailableUsersReceived?.invoke(list)
                    } catch (e: Exception) {
                        Log.e("ChatHub", "ReceiveAvailableUsers parse error", e)
                    }
                },
                Any::class.java,
            )

            conn.on(
                "UserAddedToGroup",
                { userId: String ->
                    onUserAddedToGroup?.invoke(userId)
                },
                String::class.java,
            )

            conn.on(
                "GroupUpdated",
                { action: String, payload: String ->
                    onGroupUpdated?.invoke(action, payload)
                },
                String::class.java,
                String::class.java,
            )

            conn.on(
                "UserTyping",
                { eventChatId: String, typingUserId: String, typingUsername: String ->
                    onUserTyping?.invoke(eventChatId, typingUserId, typingUsername)
                },
                String::class.java,
                String::class.java,
                String::class.java,
            )

            conn.on(
                "UserStoppedTyping",
                { eventChatId: String, typingUserId: String ->
                    onUserStoppedTyping?.invoke(eventChatId, typingUserId)
                },
                String::class.java,
                String::class.java,
            )

            conn.on("MessagePinned", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val messageId = obj.readString("messageId", "MessageId") ?: return@on
                    val pinnedAt = obj.readString("pinnedAt", "PinnedAt")
                    onMessagePinned?.invoke(messageId, pinnedAt)
                } catch (e: Exception) {
                    Log.e("ChatHub", "MessagePinned parse error", e)
                }
            }, Any::class.java)

            conn.on("MessageUnpinned", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val messageId = obj.readString("messageId", "MessageId") ?: return@on
                    onMessageUnpinned?.invoke(messageId)
                } catch (e: Exception) {
                    Log.e("ChatHub", "MessageUnpinned parse error", e)
                }
            }, Any::class.java)

            conn.on("ReceivePinnedMessages", { raw: Any ->
                try {
                    val json = gson.toJson(raw)
                    val type = object : TypeToken<List<Message>>() {}.type
                    val list: List<Message> = gson.fromJson(json, type) ?: emptyList()
                    Log.d("ChatHub", "ReceivePinnedMessages: ${list.size} item(s)")
                    onPinnedMessagesReceived?.invoke(list)
                } catch (e: Exception) {
                    Log.e("ChatHub", "ReceivePinnedMessages parse error", e)
                }
            }, Any::class.java)

            conn.on("PollUpdated", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val messageId = obj.readString("messageId", "MessageId") ?: return@on
                    val pollElement = when {
                        obj.has("poll") && !obj["poll"].isJsonNull -> obj["poll"]
                        obj.has("Poll") && !obj["Poll"].isJsonNull -> obj["Poll"]
                        else -> null
                    }
                    val poll =
                        pollElement?.let { gson.fromJson(it, MessagePoll::class.java) }
                    onPollUpdated?.invoke(messageId, poll)
                } catch (e: Exception) {
                    Log.e("ChatHub", "PollUpdated parse error", e)
                }
            }, Any::class.java)

            conn.on("CallMissed", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val chatId = obj.readString("chatId", "ChatId") ?: return@on
                    val callerId = obj.readString("callerId", "CallerId") ?: return@on
                    onCallMissed?.invoke(chatId, callerId)
                } catch (e: Exception) {
                    Log.e("ChatHub", "CallMissed parse error", e)
                }
            }, Any::class.java)

            conn.on("CallCancelled", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val chatId = obj.readString("chatId", "ChatId") ?: return@on
                    val callerId = obj.readString("callerId", "CallerId") ?: return@on
                    onCallCancelled?.invoke(chatId, callerId)
                } catch (e: Exception) {
                    Log.e("ChatHub", "CallCancelled parse error", e)
                }
            }, Any::class.java)

            conn.on("CallAccepted", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val chatId = obj.readString("chatId", "ChatId") ?: return@on
                    val calleeId = obj.readString("calleeId", "CalleeId")
                    onCallAccepted?.invoke(chatId, calleeId)
                } catch (e: Exception) {
                    Log.e("ChatHub", "CallAccepted parse error", e)
                }
            }, Any::class.java)

            conn.on("IncomingCallDismissed", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val chatId = obj.readString("chatId", "ChatId") ?: return@on
                    val reason = obj.readString("reason", "Reason").orEmpty().ifBlank { "missed" }
                    val actorUserId = obj.readString("actorUserId", "ActorUserId")
                    onIncomingCallDismissed?.invoke(chatId, reason, actorUserId)
                } catch (e: Exception) {
                    Log.e("ChatHub", "IncomingCallDismissed parse error", e)
                }
            }, Any::class.java)

            conn.on("IncomingCall", { payload: Any ->
                try {
                    val obj = gson.toJsonTree(payload).asJsonObject
                    val chatId = obj.readString("chatId", "ChatId") ?: return@on
                    val callerId = obj.readString("callerId", "CallerId")
                    val callerName =
                        obj.readString("caller", "Caller").orEmpty().ifBlank { "Пользователь" }
                    val roomId = obj.readString("roomId", "RoomId") ?: chatId
                    onIncomingCall?.invoke(chatId, callerId, callerName, roomId)
                } catch (e: Exception) {
                    Log.e("ChatHub", "IncomingCall parse error", e)
                }
            }, Any::class.java)
    }

    fun setOnReconnected(callback: (() -> Unit)?) {
        onReconnected = callback
    }

    /** Clear active chat UI binding but keep WebSocket + background groups for delivery ack. */
    fun leaveActiveChat(leavingChatId: String? = currentChatId) {
        try {
            val normalized = leavingChatId?.trim().orEmpty()
            currentChatId = null
            _messages.value = emptyList()
            if (normalized.isNotBlank()) {
                leaveGroupAwait(normalized)
            }
            Log.d("ChatHub", "Detached active chat=$normalized, connection kept alive")
        } catch (e: Exception) {
            Log.e("ChatHub", "Error leaving active chat", e)
        }
    }

    fun disconnect() {
        try {
            reconnectController.disable()
            _isConnected.value = false
            _messages.value = emptyList()
            currentChatId = null
            connectedUserId = null
            backgroundJoinedGroups.clear()
            deliveryAcknowledgedKeys.clear()
            val currentConnection = connection
            connection = null
            reconnectController.pauseScheduledReconnect = true
            if (currentConnection != null) {
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        currentConnection.stop()
                        Log.d("ChatHub", "Disconnected")
                    } catch (e: Exception) {
                        Log.e("ChatHub", "Error stopping connection", e)
                    } finally {
                        reconnectController.pauseScheduledReconnect = false
                    }
                }
            } else {
                reconnectController.pauseScheduledReconnect = false
            }
        } catch (e: Exception) {
            Log.e("ChatHub", "Error disconnecting", e)
        }
    }
    
    fun joinGroup(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        Log.d("ChatHub", "Joining group: $normalized")
        invokeAsync("JoinGroup", normalized)
        backgroundJoinedGroups.add(normalized)
    }

    private fun joinGroupAwait(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        Log.d("ChatHub", "Joining group (await): $normalized")
        try {
            connection?.invoke("JoinGroup", normalized)?.blockingAwait()
            backgroundJoinedGroups.add(normalized)
        } catch (e: Exception) {
            Log.e("ChatHub", "JoinGroup await failed for $normalized", e)
        }
    }
    
    private fun leaveGroupAwait(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        Log.d("ChatHub", "Leaving group (await): $normalized")
        try {
            connection?.invoke("LeaveGroup", normalized)?.blockingAwait()
            backgroundJoinedGroups.remove(normalized)
        } catch (e: Exception) {
            Log.e("ChatHub", "LeaveGroup await failed for $normalized", e)
        }
    }

    fun leaveGroup(chatId: String) {
        Log.d("ChatHub", "Leaving group: $chatId")
        invokeAsync("LeaveGroup", chatId)
    }
    
    fun getMessages(chatId: String, limit: Int = DEFAULT_MESSAGE_PAGE_SIZE, beforeMessageId: String? = null) {
        val before = beforeMessageId?.trim()?.takeIf { it.isNotBlank() }.orEmpty()
        Log.d("ChatHub", "Requesting messages for chatId: $chatId limit=$limit before=$before")
        // SignalR Java omits trailing null args — always send a string (empty = first page).
        invokeAsync("GetMessages", chatId, limit, before)
    }

    fun requestChatInfo(chatId: String) {
        try {
            val guid = UUID.fromString(chatId.trim())
            invokeAsync("GetChatInfo", guid)
        } catch (e: Exception) {
            Log.e("ChatHub", "requestChatInfo invalid chatId=$chatId", e)
        }
    }

    fun requestChatParticipants(chatId: String) {
        if (chatId.isBlank()) return
        invokeAsync("GetChatParticipants", chatId.trim())
    }

    fun deleteChat(chatId: String): Result<Unit> {
        return try {
            val conn = connection
                ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            conn.invoke("DeleteChat", UUID.fromString(chatId.trim()))
                ?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "DeleteChat failed", e)
            Result.failure(e)
        }
    }

    fun requestAvailableUsers(chatId: String) {
        if (chatId.isBlank()) return
        invokeAsync("GetAvailableUsers", chatId.trim())
    }

    fun addUserToGroup(chatId: String, targetUserId: String): Result<Unit> {
        return try {
            val conn = connection
                ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            conn.invoke("AddUserToGroup", chatId.trim(), targetUserId.trim())?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "AddUserToGroup failed", e)
            Result.failure(e)
        }
    }

    fun leaveGroupChat(chatId: String): Result<Unit> {
        return try {
            val conn = connection
                ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            conn.invoke("LeaveGroupChat", UUID.fromString(chatId.trim()))?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "LeaveGroupChat failed", e)
            Result.failure(e)
        }
    }

    fun deleteGroupChat(chatId: String): Result<Unit> {
        return try {
            val conn = connection
                ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            conn.invoke("DeleteGroupChat", UUID.fromString(chatId.trim()))?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "DeleteGroupChat failed", e)
            Result.failure(e)
        }
    }

    /** [GroupChatHub.EditMessage] — после успеха приходит [MessageEdited]. */
    fun editMessage(messageId: String, newContent: String, username: String): Result<Unit> {
        return try {
            val conn = connection
                ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            val guid = UUID.fromString(messageId.trim())
            val trimmed = newContent.trim()
            if (trimmed.isEmpty()) {
                return Result.failure(IllegalArgumentException("Пустой текст"))
            }
            conn.invoke("EditMessage", guid, trimmed, username)?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "EditMessage failed", e)
            Result.failure(e)
        }
    }

    /** [GroupChatHub.DeleteMessage] — после успеха приходит [MessageDeleted]. */
    fun deleteMessage(messageId: String, username: String): Result<Unit> {
        return try {
            val conn = connection
                ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            val guid = UUID.fromString(messageId.trim())
            conn.invoke("DeleteMessage", guid, username)?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "DeleteMessage failed", e)
            Result.failure(e)
        }
    }

    /**
     * Как веб [ChatRoom.jsx] `SendCallNotification`: собеседники получают IncomingCall + FCM.
     * ([GroupChatHub.SendCallNotification])
     */
    fun notifyTyping(chatId: String, username: String) {
        invokeAsync("NotifyTyping", chatId, username)
    }

    fun notifyStopTyping(chatId: String) {
        invokeAsync("NotifyStopTyping", chatId)
    }

    fun acknowledgeDelivery(messageId: String, chatId: String) {
        try {
            val messageGuid = UUID.fromString(messageId.trim())
            val chatGuid = UUID.fromString(chatId.trim())
            invokeAsync("AcknowledgeDelivery", messageGuid, chatGuid)
        } catch (e: Exception) {
            Log.e("ChatHub", "acknowledgeDelivery failed messageId=$messageId chatId=$chatId", e)
        }
    }

    fun acknowledgePendingDeliveries() {
        invokeAsync("AcknowledgePendingDeliveries")
    }

    fun sendOutgoingCallNotification(chatId: String, callerDisplayName: String, callerUserId: String) {
        try {
            val conn = connection
            if (conn?.connectionState != HubConnectionState.CONNECTED) {
                Log.w(
                    "ChatHub",
                    "sendOutgoingCallNotification skipped: state=${conn?.connectionState}"
                )
                return
            }
            val chatGuid = UUID.fromString(chatId)
            val callerGuid = UUID.fromString(callerUserId)
            invokeAsync("SendCallNotification", chatGuid, callerDisplayName, callerGuid)
        } catch (e: Exception) {
            Log.e("ChatHub", "sendOutgoingCallNotification failed", e)
        }
    }

    fun acceptCall(chatId: String) = invokeCallGuidMethod("AcceptCall", chatId)

    fun declineCall(chatId: String) = invokeCallGuidMethod("DeclineCall", chatId)

    fun cancelOutgoingCall(chatId: String) = invokeCallGuidMethod("CancelOutgoingCall", chatId)

    fun reportMissedCall(chatId: String) = invokeCallGuidMethod("ReportMissedCall", chatId)

    fun endCall(chatId: String, durationSeconds: Int) {
        try {
            val conn = connection
            if (conn?.connectionState != HubConnectionState.CONNECTED) return
            val chatGuid = UUID.fromString(chatId.trim())
            invokeAsync("EndCall", chatGuid, durationSeconds.coerceAtLeast(0))
        } catch (e: Exception) {
            Log.e("ChatHub", "endCall failed", e)
        }
    }

    private fun invokeCallGuidMethod(method: String, chatId: String) {
        try {
            val conn = connection
            if (conn?.connectionState != HubConnectionState.CONNECTED) return
            invokeAsync(method, UUID.fromString(chatId.trim()))
        } catch (e: Exception) {
            Log.e("ChatHub", "$method failed", e)
        }
    }
    
    fun sendMessage(
        chatId: String,
        message: String,
        username: String,
        repliedToMessageId: String? = null,
        forwardedFromMessageId: String? = null,
        encryptionVersion: Int = 0,
    ) {
        invokeSendMessage(
            connection = connection,
            chatId = chatId,
            message = message,
            username = username,
            repliedToMessageId = repliedToMessageId,
            forwardedFromMessageId = forwardedFromMessageId,
            encryptionVersion = encryptionVersion,
        )
    }

    /**
     * Пересылка в другой чат: если открыт [activeChatId], временно переключаем группу hub;
     * иначе — отдельное краткое подключение.
     */
    suspend fun forwardMessage(
        targetChatId: String,
        comment: String,
        username: String,
        forwardedFromMessageId: String,
        activeChatId: String?,
    ): Result<Unit> {
        val sourceId = forwardedFromMessageId.trim()
        if (sourceId.isBlank()) {
            return Result.failure(IllegalArgumentException("Некорректные параметры пересылки"))
        }
        return deliverMessageToChat(
            targetChatId = targetChatId,
            message = comment,
            username = username,
            activeChatId = activeChatId,
            forwardedFromMessageId = sourceId,
        )
    }

    suspend fun sendMessageToAnyChat(
        targetChatId: String,
        message: String,
        username: String,
        activeChatId: String?,
        encryptionVersion: Int = 0,
    ): Result<Unit> {
        return deliverMessageToChat(
            targetChatId = targetChatId,
            message = message,
            username = username,
            activeChatId = activeChatId,
            forwardedFromMessageId = null,
            encryptionVersion = encryptionVersion,
        )
    }

    private suspend fun deliverMessageToChat(
        targetChatId: String,
        message: String,
        username: String,
        activeChatId: String?,
        forwardedFromMessageId: String?,
        encryptionVersion: Int = 0,
    ): Result<Unit> {
        val target = targetChatId.trim()
        if (target.isBlank()) {
            return Result.failure(IllegalArgumentException("Некорректный chatId"))
        }
        val payload =
            if (message.isBlank() && !forwardedFromMessageId.isNullOrBlank()) {
                " "
            } else {
                message
            }
        if (payload.isBlank()) {
            return Result.failure(IllegalArgumentException("Пустое сообщение"))
        }

        if (isActiveSessionFor(target)) {
            return try {
                sendMessage(
                    target,
                    payload,
                    username,
                    repliedToMessageId = null,
                    forwardedFromMessageId = forwardedFromMessageId,
                    encryptionVersion = encryptionVersion,
                )
                Result.success(Unit)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

        val active = activeChatId?.trim()?.takeIf { it.isNotBlank() }
        val conn = connection
        if (active != null && conn?.connectionState == HubConnectionState.CONNECTED) {
            return try {
                invokeGroupActionBlocking(conn, "LeaveGroup", active)
                invokeGroupActionBlocking(conn, "JoinGroup", target)
                invokeSendMessage(conn, target, payload, username, null, forwardedFromMessageId, encryptionVersion)
                invokeGroupActionBlocking(conn, "LeaveGroup", target)
                invokeGroupActionBlocking(conn, "JoinGroup", active)
                getMessages(active)
                Result.success(Unit)
            } catch (e: Exception) {
                Log.e("ChatHub", "deliverMessageToChat via group switch failed", e)
                try {
                    invokeGroupActionBlocking(conn, "JoinGroup", active)
                    getMessages(active)
                } catch (_: Exception) {
                }
                Result.failure(e)
            }
        }

        return deliverViaEphemeralConnection(
            targetChatId = target,
            message = payload,
            username = username,
            forwardedFromMessageId = forwardedFromMessageId,
            encryptionVersion = encryptionVersion,
        )
    }

    private suspend fun forwardViaEphemeralConnection(
        targetChatId: String,
        comment: String,
        username: String,
        forwardedFromMessageId: String,
    ): Result<Unit> =
        deliverViaEphemeralConnection(
            targetChatId = targetChatId,
            message = comment,
            username = username,
            forwardedFromMessageId = forwardedFromMessageId,
        )

    private suspend fun deliverViaEphemeralConnection(
        targetChatId: String,
        message: String,
        username: String,
        forwardedFromMessageId: String?,
        encryptionVersion: Int = 0,
    ): Result<Unit> {
        var temp: HubConnection? = null
        return try {
            temp =
                HubConnectionBuilder.create("https://whithin.ru/groupchathub")
                    .withFreshAccessToken(tokenManager)
                    .build()
            temp.start().blockingAwait()
            invokeGroupActionBlocking(temp, "JoinGroup", targetChatId)
            invokeSendMessage(temp, targetChatId, message, username, null, forwardedFromMessageId, encryptionVersion)
            invokeGroupActionBlocking(temp, "LeaveGroup", targetChatId)
            temp.stop().blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "forwardViaEphemeralConnection failed", e)
            try {
                temp?.stop()
            } catch (_: Exception) {
            }
            Result.failure(e)
        }
    }

    private fun invokeGroupActionBlocking(conn: HubConnection, method: String, chatId: String) {
        conn.invoke(method, chatId)?.blockingAwait()
    }

    private fun invokeSendMessage(
        connection: HubConnection?,
        chatId: String,
        message: String,
        username: String,
        repliedToMessageId: String?,
        forwardedFromMessageId: String?,
        encryptionVersion: Int = 0,
    ) {
        val conn =
            connection ?: throw IllegalStateException("Not connected")
        if (conn.connectionState != HubConnectionState.CONNECTED) {
            throw IllegalStateException("Hub not connected")
        }
        val replyGuid =
            repliedToMessageId?.trim()?.takeIf { it.isNotBlank() }?.let { UUID.fromString(it) }
        val forwardGuid =
            forwardedFromMessageId?.trim()?.takeIf { it.isNotBlank() }?.let { UUID.fromString(it) }
        Log.d(
            "ChatHub",
            "SendMessage chatId=$chatId reply=$replyGuid forward=$forwardGuid e2e=$encryptionVersion",
        )
        conn.invoke(
            "SendMessage",
            message,
            username,
            chatId,
            replyGuid as Any?,
            forwardGuid as Any?,
            encryptionVersion,
        )
            ?.blockingAwait()
    }
    
    fun requestPinnedMessages(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        invokeAsync("GetPinnedMessages", normalized)
    }

    suspend fun pinMessage(messageId: String): Result<Unit> {
        return invokeGuidMethod("PinMessage", messageId)
    }

    suspend fun unpinMessage(messageId: String): Result<Unit> {
        return invokeGuidMethod("UnpinMessage", messageId)
    }

    suspend fun createPoll(
        chatId: String,
        question: String,
        options: List<String>,
        allowMultiple: Boolean,
        isAnonymous: Boolean,
    ): Result<Unit> {
        return try {
            val conn = connection ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            conn.invoke(
                "CreatePoll",
                chatId.trim(),
                question.trim(),
                options.map { it.trim() }.filter { it.isNotBlank() }.toTypedArray(),
                allowMultiple,
                isAnonymous,
            )?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "createPoll failed", e)
            Result.failure(e)
        }
    }

    suspend fun votePoll(messageId: String, optionIds: List<String>): Result<Unit> {
        return try {
            val conn = connection ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            val guids = optionIds.mapNotNull { runCatching { UUID.fromString(it.trim()) }.getOrNull() }.toTypedArray()
            val messageGuid = UUID.fromString(messageId.trim())
            conn.invoke("VotePoll", messageGuid, guids)?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "votePoll failed", e)
            Result.failure(e)
        }
    }

    private suspend fun invokeGuidMethod(method: String, id: String): Result<Unit> {
        return try {
            val conn = connection ?: return Result.failure(IllegalStateException("Not connected"))
            if (conn.connectionState != HubConnectionState.CONNECTED) {
                return Result.failure(IllegalStateException("Hub not connected"))
            }
            conn.invoke(method, UUID.fromString(id.trim()))?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatHub", "$method failed", e)
            Result.failure(e)
        }
    }

    fun setOnMessagesReceived(callback: ((List<Message>) -> Unit)?) {
        onMessagesReceived = callback
    }

    fun setOnMessagesMetaReceived(callback: ((MessagesPageMeta) -> Unit)?) {
        onMessagesMetaReceived = callback
    }
    
    fun setOnMessageReceived(callback: ((Message) -> Unit)?) {
        onMessageReceived = callback
    }
    
    fun setOnMessageEdited(callback: ((String, String) -> Unit)?) {
        onMessageEdited = callback
    }
    
    fun setOnMessageDeleted(callback: ((String) -> Unit)?) {
        onMessageDeleted = callback
    }

    /** Always active (incl. detached chat UI) — keep Room cache in sync. */
    fun setOnBackgroundMessageDeleted(callback: ((String) -> Unit)?) {
        onBackgroundMessageDeleted = callback
    }

    companion object {
        const val DEFAULT_MESSAGE_PAGE_SIZE = 50
        const val MAX_BACKGROUND_GROUPS = 15
    }

    private fun maybeAcknowledgeBackgroundDelivery(message: Message) {
        val senderId = message.senderIdValue.trim()
        val userId = connectedUserId?.trim().orEmpty()
        if (senderId.isNotBlank() && userId.isNotBlank() && senderId.equals(userId, ignoreCase = true)) {
            return
        }

        val messageId = message.messageIdValue.trim()
        val chatId = message.chatIdValue.trim()
        if (messageId.isBlank() || chatId.isBlank()) return

        val deliveryKey = "$chatId:$messageId"
        if (deliveryAcknowledgedKeys.contains(deliveryKey)) return
        deliveryAcknowledgedKeys.add(deliveryKey)
        acknowledgeDelivery(messageId, chatId)
    }

    private fun parseMessagesPageMeta(payload: Any): MessagesPageMeta? {
        return try {
            val root = gson.toJsonTree(payload)
            if (!root.isJsonObject) return null
            val obj = root.asJsonObject
            MessagesPageMeta(
                hasMoreOlder = obj.readBool("hasMoreOlder", "HasMoreOlder") ?: false,
                limit = obj.readInt("limit", "Limit") ?: DEFAULT_MESSAGE_PAGE_SIZE,
                beforeMessageId = obj.readString("beforeMessageId", "BeforeMessageId"),
            )
        } catch (e: Exception) {
            Log.e("ChatHub", "parseMessagesPageMeta failed", e)
            null
        }
    }

    private fun JsonObject.readString(vararg keys: String): String? {
        keys.forEach { key ->
            if (!has(key) || get(key).isJsonNull) return@forEach
            val raw = get(key).asString.trim().trim('"')
            if (raw.isNotBlank()) return raw
        }
        return null
    }

    private fun JsonObject.readBool(vararg keys: String): Boolean? {
        keys.forEach { key ->
            if (!has(key) || get(key).isJsonNull) return@forEach
            return get(key).asBoolean
        }
        return null
    }

    private fun JsonObject.readInt(vararg keys: String): Int? {
        keys.forEach { key ->
            if (!has(key) || get(key).isJsonNull) return@forEach
            return get(key).asInt
        }
        return null
    }

    private fun invokeAsync(methodName: String, vararg args: Any?) {
        try {
            connection?.invoke(methodName, *args)
                ?.subscribe(
                    { Log.d("ChatHub", "$methodName invoked successfully") },
                    { error -> Log.e("ChatHub", "Error invoking $methodName", error) }
                )
        } catch (e: Exception) {
            Log.e("ChatHub", "Exception invoking $methodName", e)
        }
    }
}
