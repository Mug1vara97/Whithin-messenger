package com.whithin.voice.data.signalr

import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.whithin.voice.data.e2e.E2eChatListPreview
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.model.ChatInfo
import com.whithin.voice.data.model.UserSearchInfo
import io.reactivex.rxjava3.core.Single
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class ChatListHub @Inject constructor(
    private val tokenManager: TokenManager,
    private val gson: Gson,
) {
    private var connection: HubConnection? = null
    private var connectedUserId: String? = null
    private val reconnectController = SignalRReconnectController("ChatListHub")
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    
    private val _chats = MutableStateFlow<List<ChatInfo>>(emptyList())
    val chats: StateFlow<List<ChatInfo>> = _chats.asStateFlow()
    
    private var onChatsReceived: ((List<ChatInfo>) -> Unit)? = null
    private var onChatCreated: ((ChatInfo) -> Unit)? = null
    private var onChatUpdated: ((ChatInfo) -> Unit)? = null
    private var onChatUnreadUpdated: ((String, Int) -> Unit)? = null
    private var onSearchResultsReceived: ((List<UserSearchInfo>) -> Unit)? = null
    private var onE2eChatKeyRewrapNeeded: ((chatId: String, userId: String, deviceId: String) -> Unit)? = null
    
    suspend fun connect(userId: String, requestInitialList: Boolean = true): Result<Unit> {
        return try {
            connectedUserId = userId
            reconnectController.enable()

            val currentState = connection?.connectionState
            if (currentState == HubConnectionState.CONNECTED) {
                Log.d("ChatListHub", "Already connected, callback is set: ${onSearchResultsReceived != null}")
                if (requestInitialList) {
                    requestChats()
                }
                return Result.success(Unit)
            }

            if (connection != null && currentState != null &&
                currentState != HubConnectionState.CONNECTED &&
                currentState != HubConnectionState.DISCONNECTED
            ) {
                Log.d("ChatListHub", "Resetting connection in state: $currentState")
                stopConnection(clearConnection = true)
            }

            connection = buildConnection(userId)
            startConnection(requestInitialList = requestInitialList)
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error connecting", e)
            _isConnected.value = false
            Result.failure(e)
        }
    }

    private fun buildConnection(userId: String): HubConnection {
        val hubUrl = "https://whithin.ru/chatlisthub?userId=$userId"
        val conn =
            HubConnectionBuilder.create(hubUrl)
                .withFreshAccessToken(tokenManager)
                .build()
        registerEventHandlers(conn)
        reconnectController.bindOnClosed(conn) { restartConnection() }
        return conn
    }

    private suspend fun startConnection(requestInitialList: Boolean) {
        Log.d("ChatListHub", "Starting connection, callback is set: ${onSearchResultsReceived != null}")
        suspendCancellableCoroutine { continuation ->
            try {
                connection?.start()?.blockingAwait()
                Log.d("ChatListHub", "Connected successfully")
                _isConnected.value = true
                if (requestInitialList) {
                    requestChats()
                }
                continuation.resume(Unit)
            } catch (error: Exception) {
                Log.e("ChatListHub", "Connection failed", error)
                _isConnected.value = false
                continuation.resumeWithException(error)
            }
        }
    }

    private suspend fun restartConnection(): Result<Unit> {
        val userId = connectedUserId?.trim().orEmpty()
        if (userId.isBlank() || !reconnectController.isEnabled) {
            return Result.failure(IllegalStateException("ChatListHub reconnect skipped"))
        }
        return reconnectController.withReconnectPaused {
            try {
                stopConnection(clearConnection = false)
                connection = buildConnection(userId)
                startConnection(requestInitialList = true)
                Result.success(Unit)
            } catch (e: Exception) {
                _isConnected.value = false
                Result.failure(e)
            }
        }
    }

    private fun stopConnection(clearConnection: Boolean) {
        try {
            connection?.stop()
        } catch (e: Exception) {
            Log.w("ChatListHub", "Error stopping connection", e)
        }
        _isConnected.value = false
        if (clearConnection) {
            connection = null
        }
    }

    private fun registerEventHandlers(conn: HubConnection) {
        conn.on("receivechats", { chats: Array<ChatInfo> ->
                try {
                    val chatList = chats.toList()
                    Log.d("ChatListHub", "Received ${chatList.size} chats from SignalR")
                    chatList.forEachIndexed { index, chat ->
                        Log.d("ChatListHub", "  Chat[$index]: ${chat.chatIdValue} - ${chat.usernameValue}")
                    }
                    _chats.value = chatList
                    onChatsReceived?.invoke(chatList)
                    Log.d("ChatListHub", "Updated _chats StateFlow with ${_chats.value.size} chats")
                } catch (e: Exception) {
                    Log.e("ChatListHub", "Error handling receivechats", e)
                }
            }, Array<ChatInfo>::class.java)
            
            // chatcreated event sends (userId: Guid, chatData: object) - request updated list instead
            conn.on("chatcreated", { userId: String, chatData: Map<String, Any> ->
                try {
                    Log.d("ChatListHub", "SignalR: Chat created event received - userId: $userId, chatData: $chatData")
                    // Request updated chat list after chat creation
                    requestChats()
                } catch (e: Exception) {
                    Log.e("ChatListHub", "Error handling chatcreated", e)
                }
            }, String::class.java, Map::class.java)
            
            // chatupdated sends one object: chatId, lastMessage, lastMessageTime, encryptionVersion, encryptedPayload, senderId
            conn.on("chatupdated", { payload: Any ->
                try {
                    val normalized = E2eChatListPreview.normalizeChatUpdatedPayload(payload, gson)
                    val chatId = normalized.chatId?.trim().orEmpty()
                    if (chatId.isBlank()) {
                        Log.w("ChatListHub", "chatupdated ignored: missing chatId")
                        return@on
                    }
                    Log.d(
                        "ChatListHub",
                        "SignalR: Chat updated - chatId: $chatId, encV=${normalized.lastMessageEncryptionVersion}",
                    )

                    val currentChats = _chats.value.toMutableList()
                    val chatIndex = currentChats.indexOfFirst { it.chatIdValue == chatId }

                    if (chatIndex >= 0) {
                        val existingChat = currentChats[chatIndex]
                        val encrypted = normalized.lastMessageEncryptionVersion > 0
                        val payload =
                            normalized.lastMessageEncryptedPayload?.trim()?.takeIf { it.isNotBlank() }
                                ?: existingChat.lastMessageEncryptedPayloadValue
                        val updatedChat =
                            existingChat.copy(
                                lastMessage = normalized.lastMessage,
                                lastMessageAlt = normalized.lastMessage,
                                lastMessageTime = normalized.lastMessageTime,
                                lastMessageTimeAlt = normalized.lastMessageTime,
                                lastMessageEncryptionVersion =
                                    normalized.lastMessageEncryptionVersion.takeIf { it > 0 }
                                        ?: existingChat.lastMessageEncryptionVersionValue.takeIf { it > 0 },
                                lastMessageEncryptionVersionAlt =
                                    normalized.lastMessageEncryptionVersion.takeIf { it > 0 }
                                        ?: existingChat.lastMessageEncryptionVersionValue.takeIf { it > 0 },
                                lastMessageEncryptedPayload = payload,
                                lastMessageEncryptedPayloadAlt = payload,
                                lastMessageSenderId =
                                    normalized.lastMessageSenderId ?: existingChat.lastMessageSenderIdValue,
                                lastMessageSenderIdAlt =
                                    normalized.lastMessageSenderId ?: existingChat.lastMessageSenderIdValue,
                                e2eLastMessageDecrypted = if (encrypted) false else existingChat.e2eLastMessageDecrypted,
                                e2eLastMessageDecryptedAlt = if (encrypted) false else existingChat.e2eLastMessageDecryptedAlt,
                            )
                        currentChats[chatIndex] = updatedChat
                        _chats.value = currentChats
                        onChatUpdated?.invoke(updatedChat)
                    } else {
                        Log.d("ChatListHub", "Chat $chatId not found in local list, requesting full list")
                        requestChats()
                    }
                } catch (e: Exception) {
                    Log.e("ChatListHub", "Error handling chatupdated", e)
                }
            }, Any::class.java)

            conn.on("chatunreadupdated", { chatId: String, unreadCount: Int ->
                try {
                    Log.d("ChatListHub", "SignalR: Chat unread updated - chatId: $chatId, unreadCount: $unreadCount")
                    onChatUnreadUpdated?.invoke(chatId, unreadCount)
                } catch (e: Exception) {
                    Log.e("ChatListHub", "Error handling chatunreadupdated", e)
                }
            }, String::class.java, Int::class.java)
            
            // privatechatcreated event sends (chatData: object) - request updated list instead
            conn.on("privatechatcreated", { chatData: Map<String, Any> ->
                try {
                    Log.d("ChatListHub", "SignalR: Private chat created event received - chatData: $chatData")
                    // Request updated chat list after private chat creation
                    requestChats()
                } catch (e: Exception) {
                    Log.e("ChatListHub", "Error handling privatechatcreated", e)
                }
            }, Map::class.java)
            
            conn.on("error", { error: String ->
                Log.e("ChatListHub", "SignalR error received: $error")
            }, String::class.java)
            
            conn.on("Error", { error: String ->
                Log.e("ChatListHub", "SignalR Error (capital) received: $error")
            }, String::class.java)

            conn.on("e2echatkeyrewrapneeded", { payload: Any ->
                try {
                    val json = gson.toJsonTree(payload).asJsonObject
                    val chatId = json.get("chatId")?.asString?.trim().orEmpty()
                    val userId = json.get("userId")?.asString?.trim().orEmpty()
                    val deviceId = json.get("deviceId")?.asString?.trim().orEmpty()
                    if (chatId.isBlank() || userId.isBlank()) {
                        Log.w("ChatListHub", "e2echatkeyrewrapneeded ignored: invalid payload=$payload")
                        return@on
                    }
                    onE2eChatKeyRewrapNeeded?.invoke(chatId, userId, deviceId.ifBlank { "default" })
                } catch (e: Exception) {
                    Log.e("ChatListHub", "Error handling e2echatkeyrewrapneeded", e)
                }
            }, Any::class.java)
            
            // Handle search results - register BEFORE connection starts
            // Try to receive as List<Map<String, Any>> first, then convert
            conn.on("receivesearchresults", { usersData: Any ->
                try {
                    Log.d("ChatListHub", "Received search results event, raw data type: ${usersData::class.java.simpleName}")
                    
                    val userList = when (usersData) {
                        is Array<*> -> {
                            Log.d("ChatListHub", "Received as Array, count: ${usersData.size}")
                            usersData.mapNotNull { userData ->
                                try {
                                    val userJson = gson.toJson(userData)
                                    Log.d("ChatListHub", "Converting user data: $userJson")
                                    gson.fromJson(userJson, UserSearchInfo::class.java)
                                } catch (e: Exception) {
                                    Log.e("ChatListHub", "Error converting user data", e)
                                    null
                                }
                            }
                        }
                        is List<*> -> {
                            Log.d("ChatListHub", "Received as List, count: ${usersData.size}")
                            usersData.mapNotNull { userData ->
                                try {
                                    val userJson = gson.toJson(userData)
                                    Log.d("ChatListHub", "Converting user data: $userJson")
                                    gson.fromJson(userJson, UserSearchInfo::class.java)
                                } catch (e: Exception) {
                                    Log.e("ChatListHub", "Error converting user data", e)
                                    null
                                }
                            }
                        }
                        else -> {
                            Log.d("ChatListHub", "Received as unknown type, trying to convert as JSON array")
                            try {
                                val jsonString = gson.toJson(usersData)
                                Log.d("ChatListHub", "JSON string: $jsonString")
                                val type = object : TypeToken<List<UserSearchInfo>>() {}.type
                                gson.fromJson<List<UserSearchInfo>>(jsonString, type) ?: emptyList()
                            } catch (e: Exception) {
                                Log.e("ChatListHub", "Error converting unknown type", e)
                                emptyList()
                            }
                        }
                    }
                    
                    Log.d("ChatListHub", "Converted ${userList.size} search results, callback is null: ${onSearchResultsReceived == null}")
                    if (onSearchResultsReceived != null) {
                        onSearchResultsReceived!!.invoke(userList)
                        Log.d("ChatListHub", "Search results callback invoked with ${userList.size} users")
                    } else {
                        Log.w("ChatListHub", "Search results callback is null!")
                    }
                } catch (e: Exception) {
                    Log.e("ChatListHub", "Error handling receivesearchresults", e)
                    e.printStackTrace()
                }
            }, Any::class.java)
            
            Log.d("ChatListHub", "Search results handler registered, callback set: ${onSearchResultsReceived != null}")
    }
    
    fun disconnect() {
        try {
            reconnectController.disable()
            connectedUserId = null
            reconnectController.pauseScheduledReconnect = true
            stopConnection(clearConnection = true)
            reconnectController.pauseScheduledReconnect = false
            Log.d("ChatListHub", "Disconnected")
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error disconnecting", e)
        }
    }
    
    fun requestChats() {
        try {
            Log.d("ChatListHub", "Requesting chats from server...")
            connection?.invoke("GetUserChats")
                ?.blockingAwait()
            Log.d("ChatListHub", "GetUserChats invoked successfully")
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error requesting chats", e)
        }
    }
    
    fun setOnChatsReceived(callback: (List<ChatInfo>) -> Unit) {
        onChatsReceived = callback
    }
    
    fun setOnChatCreated(callback: (ChatInfo) -> Unit) {
        onChatCreated = callback
    }
    
    fun setOnChatUpdated(callback: (ChatInfo) -> Unit) {
        onChatUpdated = callback
    }

    fun setOnChatUnreadUpdated(callback: (String, Int) -> Unit) {
        onChatUnreadUpdated = callback
    }
    
    fun setOnSearchResultsReceived(callback: (List<UserSearchInfo>) -> Unit) {
        Log.d("ChatListHub", "Setting search results callback")
        onSearchResultsReceived = callback
        Log.d("ChatListHub", "Search results callback set: ${onSearchResultsReceived != null}")
    }

    fun setOnE2eChatKeyRewrapNeeded(callback: (chatId: String, userId: String, deviceId: String) -> Unit) {
        onE2eChatKeyRewrapNeeded = callback
    }
    
    fun searchUsers(query: String) {
        try {
            val currentConnection = connection
            val connectionState = currentConnection?.connectionState
            Log.d("ChatListHub", "Searching users with query: $query, connection state: $connectionState")
            
            if (currentConnection == null || connectionState != HubConnectionState.CONNECTED) {
                Log.e("ChatListHub", "Cannot search users: connection is not active (state: $connectionState)")
                return
            }
            
            Log.d("ChatListHub", "Invoking SearchUsers on active connection")
            currentConnection.invoke("SearchUsers", query.trim())
                .blockingAwait()
            Log.d("ChatListHub", "SearchUsers invoked successfully")
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error searching users", e)
            e.printStackTrace()
        }
    }
    
    suspend fun createPrivateChat(targetUserId: String): Result<Unit> {
        return try {
            Log.d("ChatListHub", "Creating private chat with targetUserId: $targetUserId")
            val targetUserIdGuid = java.util.UUID.fromString(targetUserId)
            connection?.invoke("CreatePrivateChat", targetUserIdGuid)
                ?.blockingAwait()
            Log.d("ChatListHub", "CreatePrivateChat invoked successfully")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error creating private chat", e)
            Result.failure(e)
        }
    }

    suspend fun createGroupChat(chatName: String, userIds: List<String>): Result<Unit> {
        return try {
            Log.d("ChatListHub", "Creating group chat '$chatName' with ${userIds.size} users")
            val memberIds = userIds.map { java.util.UUID.fromString(it) }
            connection?.invoke("CreateGroupChat", chatName.trim(), memberIds)
                ?.blockingAwait()
            requestChats()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error creating group chat", e)
            Result.failure(e)
        }
    }

    suspend fun pinChat(chatId: String): Result<Unit> {
        return invokeChatPin(chatId, method = "PinChat")
    }

    suspend fun unpinChat(chatId: String): Result<Unit> {
        return invokeChatPin(chatId, method = "UnpinChat")
    }

    suspend fun reorderPinnedChats(chatIds: List<String>): Result<Unit> {
        return try {
            val chatUuids = chatIds.map { java.util.UUID.fromString(it.trim()) }
            connection?.invoke("ReorderPinnedChats", chatUuids)?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error reordering pinned chats", e)
            Result.failure(e)
        }
    }

    private suspend fun invokeChatPin(chatId: String, method: String): Result<Unit> {
        return try {
            val chatUuid = java.util.UUID.fromString(chatId.trim())
            connection?.invoke(method, chatUuid)?.blockingAwait()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ChatListHub", "Error invoking $method for chatId=$chatId", e)
            Result.failure(e)
        }
    }

}
