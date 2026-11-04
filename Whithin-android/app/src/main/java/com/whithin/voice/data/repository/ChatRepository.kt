package com.whithin.voice.data.repository

import android.net.Uri
import android.util.Log
import com.whithin.voice.util.ChatCallSignalingState
import com.whithin.voice.util.OutgoingCallRingtone
import com.whithin.voice.data.api.ChatApi
import com.whithin.voice.data.api.MediaApi
import com.whithin.voice.data.api.UploadMediaBatchResponse
import com.whithin.voice.data.api.UploadMediaResponse
import com.whithin.voice.data.api.toMediaFile
import com.whithin.voice.data.model.AvailableGroupUser
import com.whithin.voice.data.model.ChatLink
import com.whithin.voice.data.model.ChatDetailInfo
import com.whithin.voice.data.model.ChatInfo
import com.whithin.voice.data.model.sortChatList
import com.whithin.voice.data.model.ChatParticipant
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.data.model.Message
import com.whithin.voice.data.model.MessageStatus
import com.whithin.voice.data.model.SendMessageRequest
import com.whithin.voice.data.model.TypingUser
import com.whithin.voice.data.model.UserStatusChangedEvent
import com.whithin.voice.data.model.UserSearchInfo
import com.whithin.voice.data.signalr.ChatHub
import com.whithin.voice.data.signalr.ChatListHub
import com.whithin.voice.util.ChatOpenPerfLog
import com.whithin.voice.util.ListLoadPerfLog
import com.whithin.voice.util.ListSyncPolicy
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import com.whithin.voice.data.local.ChatMessagesLocalStore
import com.whithin.voice.data.local.ChatListLocalStore
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.e2e.E2eChatListPreview
import com.whithin.voice.data.e2e.E2eConstants
import com.whithin.voice.data.e2e.E2eCryptoService
import com.whithin.voice.data.e2e.E2eEncryptionException
import com.whithin.voice.data.e2e.E2eEnvelope
import com.whithin.voice.presentation.ui.utils.LinkExtractor
import android.os.SystemClock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import android.content.Context
import android.webkit.MimeTypeMap
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatRepository @Inject constructor(
    private val chatApi: ChatApi,
    private val mediaApi: MediaApi,
    private val chatListHub: ChatListHub,
    private val chatHub: ChatHub,
    private val presenceRepository: PresenceRepository,
    private val chatMessagesLocalStore: ChatMessagesLocalStore,
    private val chatListLocalStore: ChatListLocalStore,
    private val tokenManager: TokenManager,
    private val e2eCrypto: E2eCryptoService,
) {
    private val mediaUploadHelper = ChatMediaUploadHelper(mediaApi)
    private val e2eTranscript = ChatE2eTranscriptHelper(e2eCrypto)
    private val _chats = MutableStateFlow<List<ChatInfo>>(emptyList())
    val chats: StateFlow<List<ChatInfo>> = _chats.asStateFlow()
    
    val isConnected: StateFlow<Boolean> = chatListHub.isConnected
    
    private var currentUserId: String? = null

    @Volatile
    private var e2eMemberUserIds: List<String> = emptyList()

    @Volatile
    private var e2ePeerUserId: String? = null

    @Volatile
    private var e2eStrictAllMembers: Boolean = false

    fun setE2eContext(
        memberUserIds: List<String>,
        peerUserId: String?,
        strictAllMembers: Boolean,
    ) {
        e2eMemberUserIds = memberUserIds.map { it.trim() }.filter { it.isNotBlank() }.distinct()
        e2ePeerUserId = peerUserId?.trim()?.takeIf { it.isNotBlank() }
        e2eStrictAllMembers = strictAllMembers
        hubSidecarScope.launch {
            val chatId = _activeChatHubChatId?.trim().orEmpty()
            val userId = currentUserId?.trim().orEmpty()
            if (chatId.isNotBlank() && userId.isNotBlank()) {
                e2eCrypto.invalidateChatKeyPrep(chatId)
                e2eCrypto.prepareChatKeyForDecrypt(userId, chatId, e2eMemberUserIds)
                runCatching {
                    e2eCrypto.proactiveSyncChatDeviceWraps(userId, chatId, e2eMemberUserIds)
                }.onFailure { error ->
                    if (error is kotlinx.coroutines.CancellationException) throw error
                    Log.w("ChatRepository", "proactiveSyncChatDeviceWraps failed chatId=$chatId", error)
                }
            }
            redecryptActiveMessages()
            redecryptChatListPreviews()
        }
    }

    suspend fun redecryptChatListPreviews() {
        val userId = resolveE2eUserId()
        if (userId.isBlank()) return
        val current = _chats.value
        if (current.isEmpty()) return
        val decrypted = E2eChatListPreview.decryptChatListItems(current, userId, e2eCrypto)
        if (chatListPreviewsChanged(current, decrypted)) {
            _chats.value = sortChatsByLastMessage(decrypted)
        }
    }

    /** Bootstrap missing chat keys and upload wraps for all chats where this device holds the key. */
    suspend fun syncSessionE2eKeys() {
        val userId = resolveE2eUserId()
        if (userId.isBlank()) return
        val chatMembers =
            coroutineScope {
                _chats.value.mapNotNull { chat ->
                    val chatId = chat.chatIdValue.trim()
                    if (chatId.isBlank()) return@mapNotNull null
                    async {
                        chatId to resolveSessionE2eMemberUserIds(userId, chat)
                    }
                }.awaitAll()
            }
        if (chatMembers.isEmpty()) return
        e2eCrypto.syncSessionChatKeys(userId, chatMembers)
    }

    private suspend fun resolveSessionE2eMemberUserIds(userId: String, chat: ChatInfo): List<String> {
        val baseIds = buildE2eMemberUserIds(userId, chat)
        if (!chat.isGroupChatValue || chat.isSavedMessagesValue) {
            return baseIds
        }

        val participants = fetchChatParticipantUserIds(chat.chatIdValue)
        if (participants.isEmpty()) {
            return baseIds
        }
        return (baseIds + participants).distinct()
    }

    private suspend fun fetchChatParticipantUserIds(chatId: String): List<String> {
        val normalizedChatId = chatId.trim()
        if (normalizedChatId.isBlank()) return emptyList()
        return try {
            val response = chatApi.getChatParticipants(normalizedChatId)
            if (!response.isSuccessful) {
                emptyList()
            } else {
                response.body().orEmpty()
                    .map { it.userIdValue.trim() }
                    .filter { it.isNotBlank() }
                    .distinct()
            }
        } catch (e: Exception) {
            Log.w("ChatRepository", "fetchChatParticipantUserIds failed chatId=$normalizedChatId", e)
            emptyList()
        }
    }

    private fun buildE2eMemberUserIds(userId: String, chat: ChatInfo): List<String> {
        val ids = linkedSetOf<String>()
        userId.trim().takeIf { it.isNotBlank() }?.let { ids.add(it) }
        if (!chat.isGroupChatValue) {
            chat.userIdValue.trim().takeIf { it.isNotBlank() }?.let { ids.add(it) }
        }
        chat.lastMessageSenderIdValue?.trim()?.takeIf { it.isNotBlank() }?.let { ids.add(it) }
        return ids.toList()
    }

    private fun resolveE2eUserId(): String {
        return currentUserId?.trim().orEmpty().ifBlank {
            tokenManager.peekUserFromToken()?.id?.trim().orEmpty()
        }
    }

    /** Paint chat list immediately; decrypt E2E previews on a background worker. */
    private fun publishChatsWithE2eDecrypt(chats: List<ChatInfo>) {
        _chats.value = sortChatsByLastMessage(chats)
        scheduleChatListE2eDecrypt()
    }

    private fun scheduleChatListE2eDecrypt() {
        hubSidecarScope.launch {
            redecryptChatListPreviews()
        }
    }

    suspend fun redecryptActiveMessages() {
        val chatId = _activeChatHubChatId?.trim().orEmpty()
        if (chatId.isBlank()) return
        val current = _messages.value
        if (current.none { it.encryptionVersionValue > 0 }) return
        val decrypted = decryptIncomingMessages(current, chatId, existingMessages = current)
        if (messagesContentChanged(current, decrypted)) {
            _messages.value = decrypted
            persistChatMessagesDebounced(chatId)
        }
    }

    private val hubSidecarScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val cacheWarmMutex = Mutex()
    private val hubConnectMutex = Mutex()
    private val chatsFetchMutex = Mutex()
    @Volatile
    private var hubConnectJob: Deferred<Result<Unit>>? = null
    @Volatile
    private var hubConnectUserId: String? = null
    @Volatile
    private var chatsFetchJob: Deferred<Result<List<ChatInfo>>>? = null
    @Volatile
    private var lastChatsFetchAtMs = 0L
    @Volatile
    private var lastRoomChatsSyncAtMs = 0L

    init {
        hubSidecarScope.launch {
            _chats
                .debounce(250)
                .collect { chats ->
                    if (chats.isEmpty()) return@collect
                    val userId =
                        currentUserId?.trim().orEmpty().ifBlank {
                            tokenManager.getUserFromToken()?.id.orEmpty()
                        }
                    if (userId.isBlank()) return@collect
                    chatListLocalStore.saveChats(userId, chats)
                }
        }
    }

    /** Load last saved chat list from Room — call before UI mounts for instant paint. */
    suspend fun warmFromCache() {
        val startedAt = android.os.SystemClock.elapsedRealtime()
        cacheWarmMutex.withLock {
            if (_chats.value.isNotEmpty()) {
                Log.d(
                    ChatOpenPerfLog.TAG,
                    "warmFromCache skip already=${_chats.value.size} chats",
                )
                return
            }
            val userId = tokenManager.getUserFromToken()?.id?.trim().orEmpty()
            if (userId.isBlank()) return
            lastRoomChatsSyncAtMs = chatListLocalStore.getLastUpdatedAt(userId)
            val cached = chatListLocalStore.loadChats(userId)
            if (cached.isNotEmpty()) {
                if (currentUserId.isNullOrBlank()) {
                    currentUserId = userId
                }
                publishChatsWithE2eDecrypt(cached)
                val elapsed = android.os.SystemClock.elapsedRealtime() - startedAt
                Log.d(
                    ChatOpenPerfLog.TAG,
                    "warmFromCache done count=${cached.size} in ${elapsed}ms",
                )
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.CHATS,
                    "room_cache",
                    "count=${cached.size} roomMs=$elapsed",
                )
                ListLoadPerfLog.endCacheReady(ListLoadPerfLog.CHATS, cached.size)
            }
        }
    }

    @Volatile
    private var preparedScreenChatId: String? = null

    @Volatile
    private var chatScreenSessionId = 0L

    private var markChatReadDebouncedJob: Job? = null
    private var hubMessagesFallbackJob: Job? = null
    private var persistChatMessagesJob: Job? = null
    private var cachedMessagesCollectJob: Job? = null
    private val typingExpiryJobs = mutableMapOf<String, Job>()
    private var _activeChatHubChatId: String? = null
    /** Текущий чат, к которому привязан UI-хаб (для фильтрации stale updates). */
    val activeChatHubChatId: String? get() = _activeChatHubChatId
    private val acknowledgedDeliveries = mutableSetOf<String>()

    private enum class MessagesFetchMode {
        INITIAL,
        OLDER,
    }

    private var messagesFetchMode = MessagesFetchMode.INITIAL

    private val _typingUsers = MutableStateFlow<Map<String, List<TypingUser>>>(emptyMap())
    val typingUsers: StateFlow<Map<String, List<TypingUser>>> = _typingUsers.asStateFlow()

    private val _hasMoreOlder = MutableStateFlow(false)
    val hasMoreOlder: StateFlow<Boolean> = _hasMoreOlder.asStateFlow()

    private val _isLoadingOlder = MutableStateFlow(false)
    val isLoadingOlder: StateFlow<Boolean> = _isLoadingOlder.asStateFlow()

    /** Increments when the first messages page (incl. empty) is acknowledged via hub meta. */
    private val _initialMessagesPageLoaded = MutableStateFlow(0L)
    val initialMessagesPageLoaded: StateFlow<Long> = _initialMessagesPageLoaded.asStateFlow()

    private val _pinnedMessages = MutableStateFlow<List<Message>>(emptyList())
    val pinnedMessages: StateFlow<List<Message>> = _pinnedMessages.asStateFlow()

    val savedMessagesChatId: String?
        get() =
            _chats.value
                .firstOrNull { it.isSavedMessages == true || it.isSavedMessagesAlt == true }
                ?.chatIdValue
                ?.takeIf { it.isNotBlank() }

    @Volatile
    private var onForceEndOutgoingCall: ((String) -> Unit)? = null

    @Volatile
    private var onRemoteIncomingCallSync: ((String, String) -> Unit)? = null

    @Volatile
    private var onIncomingCallSignal: ((String, String?, String) -> Unit)? = null

    @Volatile
    private var localCallAcceptChatId: String? = null

    fun setOnForceEndOutgoingCall(callback: ((String) -> Unit)?) {
        onForceEndOutgoingCall = callback
    }

    fun setOnRemoteIncomingCallSync(callback: ((String, String) -> Unit)?) {
        onRemoteIncomingCallSync = callback
    }

    fun setOnIncomingCallSignal(callback: ((String, String?, String) -> Unit)?) {
        onIncomingCallSignal = callback
    }

    private fun markLocalCallAccept(chatId: String) {
        localCallAcceptChatId = chatId.trim()
    }

    private fun isLocalCallAccept(chatId: String): Boolean =
        localCallAcceptChatId?.equals(chatId.trim(), ignoreCase = true) == true

    private fun clearLocalCallAccept(chatId: String) {
        if (isLocalCallAccept(chatId)) {
            localCallAcceptChatId = null
        }
    }

    /** While chat is open, each new realtime message must mark read — opening only fires once via [loadMessages]. */
    private fun scheduleMarkChatAsReadDebounced(chatId: String) {
        if (chatId.isBlank()) return
        markChatReadDebouncedJob?.cancel()
        markChatReadDebouncedJob = hubSidecarScope.launch {
            delay(500)
            try {
                markChatAsRead(chatId)
            } catch (e: Exception) {
                Log.w("ChatRepository", "markChatAsRead (debounced) failed", e)
            }
        }
    }

    init {
        CoroutineScope(Dispatchers.IO).launch {
            presenceRepository.statusChangedEvents.collect { event ->
                applyStatusUpdate(event)
            }
        }

        chatHub.setOnBackgroundMessageDeleted { messageId ->
            val normalized = messageId.trim().trim('"')
            if (normalized.isBlank()) return@setOnBackgroundMessageDeleted
            hubSidecarScope.launch {
                val chatId = chatMessagesLocalStore.findChatIdForMessage(normalized)
                chatMessagesLocalStore.removeMessage(normalized)
                refreshChatListAfterMessageDelete(chatId)
            }
        }

        chatHub.setOnCallAccepted { chatId, calleeId ->
            OutgoingCallRingtone.stop()
            ChatCallSignalingState.markAnswered(chatId)
            val uid = currentUserId?.trim().orEmpty()
            // Same account answered on another device (e.g. PC) — dismiss ringing UI only.
            if (uid.isNotBlank() && calleeId?.equals(uid, ignoreCase = true) == true && !isLocalCallAccept(chatId)) {
                onRemoteIncomingCallSync?.invoke(chatId, "accepted")
            }
        }
        chatHub.setOnCallMissed { chatId, callerId ->
            OutgoingCallRingtone.stop()
            val uid = currentUserId?.trim().orEmpty()
            if (uid.isNotBlank() && callerId.equals(uid, ignoreCase = true)) {
                ChatCallSignalingState.clear()
                onForceEndOutgoingCall?.invoke(chatId)
            } else if (uid.isNotBlank()) {
                onRemoteIncomingCallSync?.invoke(chatId, "missed")
            }
        }
        chatHub.setOnCallCancelled { chatId, callerId ->
            OutgoingCallRingtone.stop()
            val uid = currentUserId?.trim().orEmpty()
            if (uid.isNotBlank() && callerId.equals(uid, ignoreCase = true)) {
                ChatCallSignalingState.clear()
                onForceEndOutgoingCall?.invoke(chatId)
            } else if (uid.isNotBlank()) {
                onRemoteIncomingCallSync?.invoke(chatId, "cancelled")
            }
        }
        chatHub.setOnIncomingCallDismissed { chatId, reason, _ ->
            OutgoingCallRingtone.stop()
            if (reason == "accepted" && isLocalCallAccept(chatId)) {
                clearLocalCallAccept(chatId)
                return@setOnIncomingCallDismissed
            }
            onRemoteIncomingCallSync?.invoke(chatId, reason)
        }
        chatHub.setOnIncomingCall { chatId, callerId, callerName, _ ->
            val uid = currentUserId?.trim().orEmpty()
            if (callerId != null && uid.isNotBlank() && callerId.equals(uid, ignoreCase = true)) {
                return@setOnIncomingCall
            }
            onIncomingCallSignal?.invoke(chatId, callerId, callerName)
        }
    }

    private suspend fun refreshChatListAfterMessageDelete(chatId: String?) {
        val normalized = chatId?.trim().orEmpty()
        if (normalized.isNotBlank()) {
            val cached = chatMessagesLocalStore.loadMessages(normalized)
            val latest =
                cached
                    .filter { it.messageIdValue.isNotBlank() }
                    .maxWithOrNull(
                        compareBy<Message> { it.createdAtValue }.thenBy { it.messageIdValue },
                    )
            if (latest != null) {
                applyChatListPreview(normalized, latest)
            } else {
                clearChatListPreview(normalized)
            }
        }
        try {
            getUserChats()
        } catch (e: Exception) {
            Log.w("ChatRepository", "refreshChatListAfterMessageDelete failed chatId=$chatId", e)
            try {
                refreshChats()
            } catch (inner: Exception) {
                Log.w("ChatRepository", "refreshChats fallback failed", inner)
            }
        }
    }

    private fun applyChatListPreview(chatId: String, latest: Message) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        val preview = previewTextForChatList(latest)
        val previewTime = latest.createdAtValue
        val encVersion = latest.encryptionVersionValue
        val content = latest.contentValue
        val isEnvelope = encVersion > 0 && E2eEnvelope.isE2eEnvelope(content)
        val senderId = latest.senderIdValue.takeIf { it.isNotBlank() }
        val alreadyDecrypted = encVersion > 0 && !isEnvelope
        val existing =
            _chats.value.firstOrNull { it.chatIdValue.equals(normalized, ignoreCase = true) }
                ?: return
        upsertAndSortChat(
            existing.copy(
                lastMessage = preview,
                lastMessageAlt = null,
                lastMessageTime = previewTime,
                lastMessageTimeAlt = null,
                lastMessageEncryptionVersion = encVersion.takeIf { it > 0 },
                lastMessageEncryptionVersionAlt = encVersion.takeIf { it > 0 },
                lastMessageEncryptedPayload =
                    if (isEnvelope) content else existing.lastMessageEncryptedPayloadValue,
                lastMessageEncryptedPayloadAlt =
                    if (isEnvelope) content else existing.lastMessageEncryptedPayloadValue,
                lastMessageSenderId = senderId ?: existing.lastMessageSenderIdValue,
                lastMessageSenderIdAlt = senderId ?: existing.lastMessageSenderIdValue,
                e2eLastMessageDecrypted = encVersion <= 0 || alreadyDecrypted,
                e2eLastMessageDecryptedAlt = encVersion <= 0 || alreadyDecrypted,
            ),
        )
    }

    private fun clearChatListPreview(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        _chats.value =
            _chats.value.map { chat ->
                if (!chat.chatIdValue.equals(normalized, ignoreCase = true)) {
                    chat
                } else {
                    chat.copy(
                        lastMessage = null,
                        lastMessageAlt = null,
                    )
                }
            }
    }

    private fun previewTextForChatList(message: Message): String {
        return com.whithin.voice.presentation.notifications.MessageNotificationPreview
            .previewForMessage(message, currentUserId.orEmpty())
    }

    private fun persistChatMessagesDebounced(chatId: String) {
        if (chatId.isBlank()) return
        persistChatMessagesJob?.cancel()
        persistChatMessagesJob = hubSidecarScope.launch {
            delay(150)
            try {
                chatMessagesLocalStore.saveMessages(chatId, _messages.value)
            } catch (e: CancellationException) {
                // Expected when a newer debounce task replaces the previous one.
                throw e
            } catch (e: Exception) {
                Log.w("ChatRepository", "persist messages failed chatId=$chatId", e)
            }
        }
    }

    /** Call on logout — tear down hubs + in-memory state; Room list cache stays for next login. */
    fun onUserSessionEnded() {
        disconnectChatHub()
        disconnectSignalR()
        e2eCrypto.clearPeerKeyCache()
        _chats.value = emptyList()
        currentUserId = null
        hubSidecarScope.launch {
            chatMessagesLocalStore.clearAll()
        }
    }

    fun loadOlderMessages(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank() || !_hasMoreOlder.value || _isLoadingOlder.value) return
        if (_activeChatHubChatId != normalized) return

        val oldest =
            _messages.value
                .filter { it.messageIdValue.isNotBlank() }
                .minWithOrNull(
                    compareBy<Message> { it.createdAtValue }.thenBy { it.messageIdValue },
                )
                ?: return

        messagesFetchMode = MessagesFetchMode.OLDER
        _isLoadingOlder.value = true
        chatHub.getMessages(normalized, ChatHub.DEFAULT_MESSAGE_PAGE_SIZE, oldest.messageIdValue)
    }

    private fun stopObservingCachedMessages() {
        cachedMessagesCollectJob?.cancel()
        cachedMessagesCollectJob = null
    }

    private fun startObservingCachedMessages(chatId: String) {
        stopObservingCachedMessages()
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        cachedMessagesCollectJob =
            hubSidecarScope.launch {
                chatMessagesLocalStore.observeMessages(normalized).collect { cached ->
                    if (_activeChatHubChatId != normalized) return@collect
                    if (chatHub.isActiveSessionFor(normalized)) return@collect
                    if (_messages.value != cached) {
                        _messages.value = cached
                    }
                }
            }
    }

    private fun scheduleChatDeliveryHub(userId: String) {
        hubSidecarScope.launch {
            if (shouldSkipHubListRequest()) {
                delay(ListSyncPolicy.CHAT_DELIVERY_HUB_DEFER_MS)
            }
            try {
                chatHub.ensureUserSession(userId)
                syncBackgroundChatGroups()
            } catch (e: Exception) {
                Log.w("ChatRepository", "ChatHub user session failed", e)
            }
        }
    }

    private fun prefetchTopChatMessages() {
        hubSidecarScope.launch {
            delay(PREFETCH_START_DELAY_MS)
            val topChats = _chats.value.take(PREFETCH_CHAT_COUNT)
            if (topChats.isEmpty()) return@launch
            val semaphore = Semaphore(PREFETCH_CONCURRENCY)
            coroutineScope {
                topChats.map { chat ->
                    async {
                        semaphore.withPermit {
                            val chatId = chat.chatIdValue.trim()
                            if (chatId.isBlank()) return@withPermit
                            try {
                                if (chatMessagesLocalStore.hasMessages(chatId)) return@withPermit
                                val response =
                                    chatApi.getMessagesPage(
                                        chatId = chatId,
                                        limit = ChatHub.DEFAULT_MESSAGE_PAGE_SIZE,
                                    )
                                if (!response.isSuccessful) return@withPermit
                                val page = response.body()?.messages.orEmpty()
                                if (page.isNotEmpty()) {
                                    chatMessagesLocalStore.saveMessages(chatId, page)
                                }
                            } catch (e: Exception) {
                                Log.w("ChatRepository", "prefetch messages failed chatId=$chatId", e)
                            }
                        }
                    }
                }.awaitAll()
            }
        }
    }

    private fun syncBackgroundChatGroups() {
        val chatIds =
            _chats.value
                .sortedByDescending { it.lastMessageTimeValue }
                .map { it.chatIdValue }
                .filter { it.isNotBlank() }
        chatHub.syncBackgroundChatGroups(
            chatIds = chatIds,
            activeChatId = _activeChatHubChatId,
        )
    }

    /** REST chat list; deduped with cooldown unless [force]. */
    suspend fun getUserChats(force: Boolean = false): Result<List<ChatInfo>> {
        if (!force && shouldSkipRestFetch()) {
            val tag =
                if (ListSyncPolicy.isRoomFresh(lastRoomChatsSyncAtMs)) {
                    "rest_skip_room_fresh"
                } else {
                    "rest_skip_cooldown"
                }
            ListLoadPerfLog.mark(
                ListLoadPerfLog.CHATS,
                tag,
                "roomAgeMs=${ListSyncPolicy.roomAgeMs(lastRoomChatsSyncAtMs)} count=${_chats.value.size}",
            )
            return Result.success(_chats.value)
        }
        val job =
            chatsFetchMutex.withLock {
                chatsFetchJob?.takeIf { it.isActive }
                    ?: hubSidecarScope.async { fetchUserChatsInternal() }.also { chatsFetchJob = it }
            }
        return job.await().also { result ->
            if (result.isSuccess) {
                markChatsRestSynced()
            }
        }
    }

    /** After token is available at cold start — does not wait for auth UI. */
    suspend fun prefetchUserChatsIfNeeded() {
        val userId = tokenManager.getUserFromToken()?.id?.trim().orEmpty()
        if (userId.isBlank()) return
        currentUserId = userId
        if (shouldSkipRestFetch()) {
            ListLoadPerfLog.mark(
                ListLoadPerfLog.CHATS,
                "early_rest_skip_fresh",
                "roomAgeMs=${ListSyncPolicy.roomAgeMs(lastRoomChatsSyncAtMs)} count=${_chats.value.size}",
            )
            return
        }
        ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "early_rest_prefetch")
        getUserChats(force = false)
    }

    fun shouldSkipHubListRequest(): Boolean = shouldSkipRestFetch()

    private fun shouldSkipRestFetch(): Boolean {
        if (_chats.value.isEmpty()) return false
        if (ListSyncPolicy.isRoomFresh(lastRoomChatsSyncAtMs)) {
            return true
        }
        val memAge = SystemClock.elapsedRealtime() - lastChatsFetchAtMs
        return lastChatsFetchAtMs > 0L &&
            memAge < CHATS_FETCH_COOLDOWN_MS &&
            _chats.value.isNotEmpty()
    }

    private fun markChatsRestSynced() {
        lastChatsFetchAtMs = SystemClock.elapsedRealtime()
        lastRoomChatsSyncAtMs = System.currentTimeMillis()
    }

    private suspend fun fetchUserChatsInternal(): Result<List<ChatInfo>> {
        return try {
            ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "rest_start")
            val restStartedAt = SystemClock.elapsedRealtime()
            Log.d("ChatRepository", "Fetching user chats from API...")
            val response = chatApi.getUserChats()
            val restMs = android.os.SystemClock.elapsedRealtime() - restStartedAt
            Log.d("ChatRepository", "API response code: ${response.code()}, isSuccessful: ${response.isSuccessful}")
            
            if (response.isSuccessful && response.body() != null) {
                val chatList = response.body()!!
                Log.d("ChatRepository", "Received ${chatList.size} chats from API")
                chatList.forEachIndexed { index, chat ->
                    Log.d("ChatRepository", "Chat[$index]: id=${chat.chatIdValue}, username=${chat.usernameValue}")
                }
                
                publishChatsWithE2eDecrypt(mergeIncomingChats(_chats.value, chatList))
                syncBackgroundChatGroups()
                prefetchTopChatMessages()
                Log.d("ChatRepository", "Updated _chats StateFlow with ${_chats.value.size} chats")
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.CHATS,
                    "rest_ok",
                    "count=${chatList.size} restMs=$restMs",
                )
                ListLoadPerfLog.endSyncReady(ListLoadPerfLog.CHATS, "rest", chatList.size)
                Result.success(chatList)
            } else {
                val cached = _chats.value
                if (cached.isNotEmpty()) {
                    Log.w("ChatRepository", "API error ${response.code()}, using ${cached.size} cached chats")
                    ListLoadPerfLog.mark(
                        ListLoadPerfLog.CHATS,
                        "rest_fail_use_cache",
                        "code=${response.code()} count=${cached.size} restMs=$restMs",
                    )
                    return Result.success(cached)
                }
                val errorMessage = response.errorBody()?.string() ?: "Failed to get chats"
                Log.e("ChatRepository", "API error: $errorMessage, code: ${response.code()}")
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.CHATS,
                    "rest_fail",
                    "code=${response.code()} restMs=$restMs",
                )
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            val cached = _chats.value
            if (cached.isNotEmpty()) {
                Log.w("ChatRepository", "Network error, using ${cached.size} cached chats", e)
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.CHATS,
                    "rest_error_use_cache",
                    "count=${cached.size} err=${e.message.orEmpty()}",
                )
                return Result.success(cached)
            }
            Log.e("ChatRepository", "Exception while fetching chats", e)
            ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "rest_error", e.message.orEmpty())
            Result.failure(e)
        }
    }
    
    suspend fun connectSignalR(userId: String): Result<Unit> {
        if (chatListHub.isConnected.value && currentUserId == userId) {
            Log.d("ChatRepository", "Already connected to SignalR for userId: $userId, skipping reconnection")
            return Result.success(Unit)
        }
        val job =
            hubConnectMutex.withLock {
                hubConnectJob?.takeIf { it.isActive }?.also {
                    Log.d("ChatRepository", "connectSignalR: joining in-flight hub connect")
                    ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "hub_connect_join_inflight")
                }
                    ?: hubSidecarScope.async { connectSignalRInternal(userId) }.also {
                        hubConnectJob = it
                        hubConnectUserId = userId.trim()
                    }
            }
        return try {
            job.await()
        } finally {
            hubConnectMutex.withLock {
                if (hubConnectJob === job) {
                    hubConnectJob = null
                    hubConnectUserId = null
                }
            }
        }
    }

    /** Connected or connect already in flight for this user (e.g. after [ColdStartBootstrap]). */
    fun isHubSessionWarm(userId: String): Boolean {
        val id = userId.trim()
        if (id.isBlank()) return false
        if (chatListHub.isConnected.value && currentUserId == id) return true
        return hubConnectJob?.isActive == true && hubConnectUserId == id
    }

    private suspend fun connectSignalRInternal(userId: String): Result<Unit> {
        return try {
            currentUserId = userId
            Log.d("ChatRepository", "Connecting to SignalR for userId: $userId")
            ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "hub_connect_start")

            // Set up search results callback FIRST, before connecting
            chatListHub.setOnSearchResultsReceived { users ->
                Log.d("ChatRepository", "SignalR: Received ${users.size} search results")
                users.forEachIndexed { index, user ->
                    Log.d("ChatRepository", "  User[$index]: ${user.userIdValue} - ${user.usernameValue}")
                }
                _searchResults.value = users
                Log.d("ChatRepository", "Updated _searchResults StateFlow with ${_searchResults.value.size} users")
            }
            
            // Set up callbacks
            chatListHub.setOnChatsReceived { chatList ->
                Log.d("ChatRepository", "SignalR: Received ${chatList.size} chats")
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.CHATS,
                    "hub_list_received",
                    "count=${chatList.size}",
                )
                ListLoadPerfLog.endSyncReady(ListLoadPerfLog.CHATS, "hub", chatList.size)
                hubSidecarScope.launch {
                    publishChatsWithE2eDecrypt(mergeIncomingChats(_chats.value, chatList))
                    syncBackgroundChatGroups()
                    Log.d("ChatRepository", "Updated _chats StateFlow from SignalR with ${_chats.value.size} chats")
                }
            }

            chatListHub.setOnChatCreated { chat ->
                Log.d("ChatRepository", "SignalR: Chat created - ${chat.chatIdValue}")
                if (_chats.value.none { it.chatIdValue == chat.chatIdValue }) {
                    upsertAndSortChat(chat)
                    syncBackgroundChatGroups()
                    Log.d("ChatRepository", "Added new chat, total: ${_chats.value.size}")
                }
            }

            chatListHub.setOnChatUpdated { chat ->
                Log.d("ChatRepository", "SignalR: Chat updated - ${chat.chatIdValue}")
                upsertAndSortChat(chat)
            }

            chatListHub.setOnChatUnreadUpdated { chatId, unreadCount ->
                val currentChats = _chats.value.toMutableList()
                val index = currentChats.indexOfFirst { it.chatIdValue == chatId }
                if (index >= 0) {
                    val existingChat = currentChats[index]
                    currentChats[index] = existingChat.copy(
                        unreadCount = unreadCount,
                        unreadCountAlt = null
                    )
                    _chats.value = currentChats
                }
            }

            chatListHub.setOnE2eChatKeyRewrapNeeded { chatId, userIdWithChangedKey, deviceId ->
                hubSidecarScope.launch {
                    val current = currentUserId?.trim().orEmpty()
                    if (current.isBlank()) return@launch
                    runCatching {
                        val activeChatId = _activeChatHubChatId?.trim().orEmpty()
                        val members =
                            if (activeChatId.equals(chatId.trim(), ignoreCase = true) && e2eMemberUserIds.isNotEmpty()) {
                                e2eMemberUserIds
                            } else {
                                listOf(current, userIdWithChangedKey)
                            }

                        // Drop stale peer-key cache on rotation events before any new wrap sync.
                        if (!userIdWithChangedKey.equals(current, ignoreCase = true)) {
                            e2eCrypto.clearPeerKeyCache()
                            e2eCrypto.proactiveSyncChatDeviceWraps(
                                userId = current,
                                chatId = chatId,
                                memberUserIds = members,
                            )
                            return@runCatching
                        }

                        // Current user rotated/reinstalled this device: attempt direct key recovery.
                        e2eCrypto.invalidateChatKeyPrep(chatId)
                        e2eCrypto.bootstrapChatKeyIfPossible(
                            userId = current,
                            chatId = chatId,
                            memberUserIds = members,
                        )
                        e2eCrypto.proactiveSyncChatDeviceWraps(
                            userId = current,
                            chatId = chatId,
                            memberUserIds = members,
                        )
                    }.onFailure { error ->
                        Log.w(
                            "ChatRepository",
                            "E2E rewrap sync failed for chatId=$chatId deviceId=$deviceId",
                            error,
                        )
                    }
                }
            }
            
            val requestHubList = !shouldSkipHubListRequest()
            if (!requestHubList) {
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.CHATS,
                    "hub_list_skip_fresh",
                    "roomAgeMs=${ListSyncPolicy.roomAgeMs(lastRoomChatsSyncAtMs)} count=${_chats.value.size}",
                )
            }
            val hubStartedAt = android.os.SystemClock.elapsedRealtime()
            val result = chatListHub.connect(userId, requestInitialList = requestHubList)
            val hubMs = android.os.SystemClock.elapsedRealtime() - hubStartedAt
            if (result.isSuccess) {
                Log.d("ChatRepository", "SignalR connected successfully")
                ListLoadPerfLog.mark(ListLoadPerfLog.CHATS, "hub_connect_done", "hubMs=$hubMs")
                scheduleChatDeliveryHub(userId)
            } else {
                Log.e("ChatRepository", "SignalR connection failed", result.exceptionOrNull())
                ListLoadPerfLog.mark(
                    ListLoadPerfLog.CHATS,
                    "hub_connect_fail",
                    "hubMs=$hubMs err=${result.exceptionOrNull()?.message.orEmpty()}",
                )
            }
            result
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while connecting SignalR", e)
            Result.failure(e)
        }
    }
    
    fun disconnectSignalR() {
        android.util.Log.d("ChatRepository", "disconnectSignalR called - this should only be called on logout or app exit")
        hubConnectJob?.cancel()
        hubConnectJob = null
        hubConnectUserId = null
        chatsFetchJob?.cancel()
        chatsFetchJob = null
        lastChatsFetchAtMs = 0L
        chatListHub.disconnect()
    }
    
    fun refreshChats() {
        chatListHub.requestChats()
    }
    
    suspend fun searchUsers(query: String) {
        if (query.isBlank()) {
            _searchResults.value = emptyList()
            return
        }
        
        // Ensure connection is active before searching
        if (!chatListHub.isConnected.value) {
            Log.w("ChatRepository", "Connection not active, reconnecting before search...")
            currentUserId?.let { userId ->
                connectSignalR(userId)
            } ?: run {
                Log.e("ChatRepository", "Cannot reconnect: userId is null")
                return
            }
        }
        
        chatListHub.searchUsers(query)
    }
    
    suspend fun createPrivateChat(targetUserId: String): Result<Unit> {
        return try {
            Log.d("ChatRepository", "Creating private chat with userId: $targetUserId")
            chatListHub.createPrivateChat(targetUserId)
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while creating private chat", e)
            Result.failure(e)
        }
    }

    suspend fun createGroupChat(chatName: String, memberIds: List<String>): Result<Unit> {
        return try {
            Log.d("ChatRepository", "Creating group chat '$chatName' with ${memberIds.size} members")
            chatListHub.createGroupChat(chatName, memberIds)
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while creating group chat", e)
            Result.failure(e)
        }
    }

    suspend fun setChatPinned(chatId: String, pinned: Boolean): Result<Unit> {
        val normalized = chatId.trim()
        if (normalized.isBlank()) {
            return Result.failure(IllegalArgumentException("chatId is blank"))
        }
        applyLocalChatPinState(normalized, pinned)
        return try {
            val result =
                if (pinned) {
                    chatListHub.pinChat(normalized)
                } else {
                    chatListHub.unpinChat(normalized)
                }
            if (result.isFailure) {
                chatListHub.requestChats()
            }
            result
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while changing chat pin chatId=$normalized pinned=$pinned", e)
            chatListHub.requestChats()
            Result.failure(e)
        }
    }

    private fun applyLocalChatPinState(chatId: String, pinned: Boolean) {
        val nowIso =
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(java.util.Date())
        val updated =
            _chats.value.map { chat ->
                if (!chat.chatIdValue.equals(chatId, ignoreCase = true)) {
                    chat
                } else {
                    chat.copy(
                        isPinned = pinned,
                        isPinnedAlt = pinned,
                        pinnedAt = if (pinned) nowIso else null,
                        pinnedAtAlt = if (pinned) nowIso else null,
                        pinOrder = if (pinned) chat.pinOrderValue ?: 0 else null,
                        pinOrderAlt = if (pinned) chat.pinOrderValue ?: 0 else null,
                    )
                }
            }
        publishChatsWithE2eDecrypt(updated)
    }

    suspend fun reorderPinnedChats(orderedChatIds: List<String>): Result<Unit> {
        if (orderedChatIds.isEmpty()) return Result.success(Unit)
        applyLocalPinnedOrder(orderedChatIds)
        return try {
            val result = chatListHub.reorderPinnedChats(orderedChatIds)
            if (result.isFailure) {
                chatListHub.requestChats()
            }
            result
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while reordering pinned chats", e)
            chatListHub.requestChats()
            Result.failure(e)
        }
    }

    private fun applyLocalPinnedOrder(orderedChatIds: List<String>) {
        val orderMap =
            orderedChatIds
                .mapIndexed { index, id -> id.trim().lowercase() to index }
                .toMap()
        val updated =
            _chats.value.map { chat ->
                if (!chat.isPinnedValue) return@map chat
                val order = orderMap[chat.chatIdValue.trim().lowercase()] ?: chat.pinOrderValue
                chat.copy(
                    pinOrder = order,
                    pinOrderAlt = order,
                )
            }
        publishChatsWithE2eDecrypt(updated)
    }
    
    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    val chatHubConnected: StateFlow<Boolean> = chatHub.isConnected

    private val _chatDetailInfo = MutableStateFlow<ChatDetailInfo?>(null)
    val chatDetailInfo: StateFlow<ChatDetailInfo?> = _chatDetailInfo.asStateFlow()

    private val _chatParticipants = MutableStateFlow<List<ChatParticipant>>(emptyList())
    val chatParticipants: StateFlow<List<ChatParticipant>> = _chatParticipants.asStateFlow()

    private val _chatMediaFiles = MutableStateFlow<List<MediaFile>>(emptyList())
    val chatMediaFiles: StateFlow<List<MediaFile>> = _chatMediaFiles.asStateFlow()

    private val _chatMediaLoading = MutableStateFlow(false)
    val chatMediaLoading: StateFlow<Boolean> = _chatMediaLoading.asStateFlow()

    private val _chatLinks = MutableStateFlow<List<ChatLink>>(emptyList())
    val chatLinks: StateFlow<List<ChatLink>> = _chatLinks.asStateFlow()

    private val _chatLinksLoading = MutableStateFlow(false)
    val chatLinksLoading: StateFlow<Boolean> = _chatLinksLoading.asStateFlow()

    private val _chatDeleted = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val chatDeleted: SharedFlow<String> = _chatDeleted.asSharedFlow()

    private val _groupAvailableUsers = MutableStateFlow<List<AvailableGroupUser>>(emptyList())
    val groupAvailableUsers: StateFlow<List<AvailableGroupUser>> = _groupAvailableUsers.asStateFlow()

    private val _groupAvailableUsersLoading = MutableStateFlow(false)
    val groupAvailableUsersLoading: StateFlow<Boolean> = _groupAvailableUsersLoading.asStateFlow()
    
    // Search results
    private val _searchResults = MutableStateFlow<List<UserSearchInfo>>(emptyList())
    val searchResults: StateFlow<List<UserSearchInfo>> = _searchResults.asStateFlow()
    
    suspend fun getMessages(@Suppress("UNUSED_PARAMETER") chatId: String): Result<List<Message>> {
        // Messages will be received through SignalR
        // This method is kept for compatibility but messages come from SignalR
        return Result.success(_messages.value)
    }
    
    suspend fun sendMessage(chatId: String, content: String, username: String, repliedToMessageId: String? = null, forwardedFromMessageId: String? = null): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                Log.d("ChatRepository", "Sending message via SignalR to chatId: $chatId")
                val prepared = prepareOutgoingText(chatId, content)
                chatHub.sendMessage(
                    chatId,
                    prepared.first,
                    username,
                    repliedToMessageId,
                    forwardedFromMessageId,
                    prepared.second,
                )
                Log.d("ChatRepository", "Message sent successfully via SignalR")
                Result.success(Unit)
            } catch (e: E2eEncryptionException) {
                Log.e("ChatRepository", "E2E encryption failed", e)
                Result.failure(e)
            } catch (e: CancellationException) {
                // Do not convert structured coroutine cancellation into a send failure.
                throw e
            } catch (e: Exception) {
                Log.e("ChatRepository", "Exception while sending message via SignalR", e)
                Result.failure(e)
            }
        }
    }

    private suspend fun prepareOutgoingText(chatId: String, content: String): Pair<String, Int> =
        e2eTranscript.prepareOutgoingText(
            userId = currentUserId,
            chatId = chatId,
            content = content,
            memberUserIds = e2eMemberUserIds,
            strictAllMembers = e2eStrictAllMembers,
        )

    suspend fun sendMessageToAnyChat(
        chatId: String,
        content: String,
        username: String,
    ): Result<Unit> =
        withContext(Dispatchers.IO) {
            val prepared = prepareOutgoingText(chatId, content)
            chatHub.sendMessageToAnyChat(
                targetChatId = chatId,
                message = prepared.first,
                username = username,
                activeChatId = _activeChatHubChatId,
                encryptionVersion = prepared.second,
            )
        }

    /** Reply/mark-read from notification tray — works when UI hub is not connected. */
    suspend fun sendMessageFromNotification(
        chatId: String,
        content: String,
        username: String,
    ): Result<Unit> {
        val trimmedChatId = chatId.trim()
        val trimmedContent = content.trim()
        if (trimmedChatId.isBlank() || trimmedContent.isBlank()) {
            return Result.failure(IllegalArgumentException("Некорректные параметры сообщения"))
        }

        sendMessageToAnyChat(
            chatId = trimmedChatId,
            content = trimmedContent,
            username = username,
        ).onSuccess { return Result.success(Unit) }

        return try {
            val prepared = prepareOutgoingText(trimmedChatId, trimmedContent)
            val response =
                chatApi.sendMessage(
                    trimmedChatId,
                    SendMessageRequest(
                        content = prepared.first,
                        encryptionVersion = prepared.second,
                    ),
                )
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(
                    Exception(response.errorBody()?.string() ?: "Не удалось отправить сообщение"),
                )
            }
        } catch (e: Exception) {
            Log.e("ChatRepository", "sendMessageFromNotification REST failed", e)
            Result.failure(e)
        }
    }

    suspend fun fetchChatInfoRest(chatId: String) {
        if (chatId.isBlank()) return
        val normalizedChatId = chatId.trim()
        try {
            val response = chatApi.getChatInfo(normalizedChatId)
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.chatIdValue.equals(normalizedChatId, ignoreCase = true)) {
                    _chatDetailInfo.value = body
                }
            }
        } catch (e: Exception) {
            Log.w("ChatRepository", "fetchChatInfoRest failed", e)
        }
    }

    fun beginChatDetailRefresh(chatId: String) {
        if (chatId.isBlank()) return
        _chatDetailInfo.value = null
    }

    fun refreshChatDetailFromHub(chatId: String) {
        chatHub.requestChatInfo(chatId)
        chatHub.requestChatParticipants(chatId)
    }

    suspend fun loadChatMediaFiles(chatId: String) {
        if (chatId.isBlank()) return
        _chatMediaLoading.value = true
        _chatMediaFiles.value = emptyList()
        try {
            val aggregated = ArrayList<MediaFile>()
            var page = 1
            var hasMore = true
            while (hasMore && page <= 20) {
                val response =
                    mediaApi.getChatMediaFiles(
                        chatId = chatId.trim(),
                        page = page,
                        pageSize = 100,
                    )
                if (!response.isSuccessful) {
                    Log.w("ChatRepository", "loadChatMediaFiles failed: ${response.code()}")
                    return
                }
                val body = response.body() ?: break
                val batch = body.mediaFiles.orEmpty().map { it.toMediaFile() }
                aggregated.addAll(batch)
                hasMore = body.hasMore && batch.isNotEmpty()
                page++
            }
            _chatMediaFiles.value =
                aggregated.distinctBy { file ->
                    file.idValue.ifBlank { file.filePathValue }.trim()
                }
            Log.d("ChatRepository", "Loaded ${_chatMediaFiles.value.size} media files for chat info")
        } catch (e: Exception) {
            Log.w("ChatRepository", "loadChatMediaFiles failed", e)
        } finally {
            _chatMediaLoading.value = false
        }
    }

    suspend fun loadChatLinks(chatId: String) {
        if (chatId.isBlank()) return
        _chatLinksLoading.value = true
        _chatLinks.value = emptyList()
        try {
            val aggregated = ArrayList<Message>()
            var beforeMessageId: String? = null
            repeat(30) { page ->
                val response =
                    chatApi.getMessagesPage(
                        chatId = chatId.trim(),
                        limit = 100,
                        beforeMessageId = beforeMessageId,
                    )
                if (!response.isSuccessful) {
                    Log.w("ChatRepository", "loadChatLinks failed: ${response.code()} page=$page")
                    return
                }
                val batch = response.body()?.messages.orEmpty()
                if (batch.isEmpty()) return
                aggregated.addAll(batch)
                val oldest =
                    batch.minWithOrNull(
                        compareBy<Message> { it.createdAtValue }.thenBy { it.messageIdValue },
                    )
                beforeMessageId = oldest?.messageIdValue
                if (batch.size < 100) return
            }
            _chatLinks.value = LinkExtractor.extractFromMessages(aggregated)
            Log.d("ChatRepository", "Loaded ${_chatLinks.value.size} links for chat info")
        } catch (e: Exception) {
            Log.w("ChatRepository", "loadChatLinks failed", e)
        } finally {
            _chatLinksLoading.value = false
        }
    }

    suspend fun uploadChatAvatar(chatId: String, uri: Uri, context: Context): Result<String?> {
        return try {
            withContext(Dispatchers.IO) {
                val resolver = context.contentResolver
                val mime = resolver.getType(uri).orEmpty().ifBlank { "image/jpeg" }
                val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "jpg"
                var rawName = "avatar.$ext"
                resolver.query(uri, null, null, null, null)?.use { c ->
                    val idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (c.moveToFirst() && idx >= 0) {
                        c.getString(idx)?.takeIf { it.isNotBlank() }?.let { rawName = it }
                    }
                }
                val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: return@withContext Result.failure(Exception("Cannot read file"))
                val body = bytes.toRequestBody(mime.toMediaTypeOrNull())
                val part = MultipartBody.Part.createFormData("file", rawName, body)
                val response = chatApi.uploadChatAvatar(chatId.trim(), part)
                if (response.isSuccessful) {
                    val url = response.body()?.avatarUrl
                    fetchChatInfoRest(chatId.trim())
                    Result.success(url)
                } else {
                    Result.failure(Exception(response.errorBody()?.string() ?: "Upload failed"))
                }
            }
        } catch (e: Exception) {
            Log.e("ChatRepository", "uploadChatAvatar failed", e)
            Result.failure(e)
        }
    }

    suspend fun deleteChatViaHub(chatId: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            val normalized = chatId.trim()
            val result = chatHub.deleteChat(normalized)
            if (result.isSuccess) {
                removeChatLocally(normalized)
            }
            result
        }

    fun requestGroupAvailableUsers(chatId: String) {
        if (chatId.isBlank()) return
        _groupAvailableUsersLoading.value = true
        _groupAvailableUsers.value = emptyList()
        chatHub.requestAvailableUsers(chatId.trim())
    }

    suspend fun addUserToGroup(chatId: String, targetUserId: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            chatHub.addUserToGroup(chatId.trim(), targetUserId.trim())
        }

    suspend fun leaveGroupChat(chatId: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            val normalized = chatId.trim()
            val result = chatHub.leaveGroupChat(normalized)
            if (result.isSuccess) {
                removeChatLocally(normalized)
            }
            result
        }

    suspend fun deleteGroupChat(chatId: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            val normalized = chatId.trim()
            val result = chatHub.deleteGroupChat(normalized)
            if (result.isSuccess) {
                removeChatLocally(normalized)
            }
            result
        }

    private fun removeChatLocally(chatId: String) {
        chatHub.leaveBackgroundGroup(chatId)
        _chats.value = _chats.value.filterNot { it.chatIdValue.equals(chatId, ignoreCase = true) }
        hubSidecarScope.launch {
            chatMessagesLocalStore.clearChat(chatId)
        }
    }

    suspend fun deleteMessageViaHub(messageId: String, username: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            chatHub.deleteMessage(messageId.trim(), username.trim())
        }

    suspend fun editMessageViaHub(messageId: String, newContent: String, username: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            chatHub.editMessage(messageId.trim(), newContent.trim(), username.trim())
        }

    suspend fun forwardMessage(
        sourceMessageId: String,
        targetChatId: String,
        comment: String,
        username: String,
        activeChatId: String?,
    ): Result<Unit> =
        withContext(Dispatchers.IO) {
            chatHub.forwardMessage(
                targetChatId = targetChatId,
                comment = comment,
                username = username,
                forwardedFromMessageId = sourceMessageId,
                activeChatId = activeChatId,
            )
        }

    suspend fun markChatAsRead(chatId: String): Result<Unit> {
        return try {
            val response = chatApi.markChatAsRead(chatId)
            if (response.isSuccessful) {
                val currentChats = _chats.value.toMutableList()
                val index = currentChats.indexOfFirst { it.chatIdValue == chatId }
                if (index >= 0) {
                    val existing = currentChats[index]
                    currentChats[index] = existing.copy(unreadCount = 0, unreadCountAlt = null)
                    _chats.value = currentChats
                }
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to mark chat as read"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Hydrate transcript from Room immediately (Telegram-style open), then hub sync replaces/merges.
     */
    fun beginChatScreenSession(): Long {
        chatScreenSessionId =
            if (chatScreenSessionId >= Long.MAX_VALUE - 1) {
                1L
            } else {
                chatScreenSessionId + 1
            }
        return chatScreenSessionId
    }

    private fun isChatScreenSessionActive(sessionId: Long): Boolean =
        sessionId > 0L && sessionId == chatScreenSessionId

    suspend fun prepareChatScreenMessages(chatId: String) {
        val normalized = chatId.trim()
        if (
            chatHub.isActiveSessionFor(normalized) &&
                _messages.value.isNotEmpty() &&
                preparedScreenChatId == normalized
        ) {
            ChatOpenPerfLog.mark(chatId, "prepare_skip_active_hub")
            return
        }
        if (normalized.isBlank()) return
        if (preparedScreenChatId != normalized) {
            _messages.value = emptyList()
        }
        val startedAt = android.os.SystemClock.elapsedRealtime()
        var loaded = chatMessagesLocalStore.loadMessages(normalized)
        val roomMs = android.os.SystemClock.elapsedRealtime() - startedAt
        _messages.value = loaded
        stopObservingCachedMessages()
        preparedScreenChatId = normalized
        ChatOpenPerfLog.mark(
            normalized,
            "room_load",
            "count=${loaded.size} roomMs=$roomMs",
        )
    }

    suspend fun loadOfflineCachedMessages(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        _messages.value = chatMessagesLocalStore.loadMessages(normalized)
    }

    suspend fun connectChatHub(chatId: String, sessionId: Long): Result<Unit> {
        return try {
            if (!isChatScreenSessionActive(sessionId)) {
                return Result.failure(kotlinx.coroutines.CancellationException("stale chat screen session"))
            }
            Log.d("ChatRepository", "Connecting to ChatHub for chatId: $chatId")
            ChatOpenPerfLog.mark(chatId, "repo_connectChatHub_enter")

            markChatReadDebouncedJob?.cancel()
            val normalized = chatId.trim()
            if (
                _activeChatHubChatId != null &&
                    !_activeChatHubChatId.equals(normalized, ignoreCase = true) &&
                    preparedScreenChatId != normalized
            ) {
                _messages.value = emptyList()
                preparedScreenChatId = null
            }
            _activeChatHubChatId = chatId
            acknowledgedDeliveries.clear()
            _hasMoreOlder.value = false
            _isLoadingOlder.value = false
            _initialMessagesPageLoaded.value = 0L
            messagesFetchMode = MessagesFetchMode.INITIAL
            _chatDetailInfo.value = null
            _chatParticipants.value = emptyList()
            // Reset E2E context immediately to avoid reusing participants from previously open chat.
            e2eMemberUserIds = emptyList()
            e2ePeerUserId = null
            e2eStrictAllMembers = false
            _chatMediaFiles.value = emptyList()
            _chatMediaLoading.value = false
            _pinnedMessages.value = emptyList()
            if (preparedScreenChatId != normalized) {
                prepareChatScreenMessages(chatId)
            } else {
                ChatOpenPerfLog.mark(chatId, "prepare_skip_already_loaded")
            }

            // Set up callbacks
            chatHub.setOnMessagesMetaReceived { meta ->
                _hasMoreOlder.value = meta.hasMoreOlder
                _isLoadingOlder.value = false
            }

            chatHub.setOnMessagesReceived { messages ->
                Log.d("ChatRepository", "SignalR: Received ${messages.size} messages")
                hubSidecarScope.launch {
                    val currentMessages = _messages.value
                    val wasInitialFetch = messagesFetchMode == MessagesFetchMode.INITIAL
                    if (wasInitialFetch) {
                        ChatOpenPerfLog.mark(
                            chatId,
                            "hub_receive_messages",
                            "count=${messages.size}",
                        )
                        ChatOpenPerfLog.end(chatId, "hub_sync_done", "count=${messages.size}")
                        if (_initialMessagesPageLoaded.value == 0L) {
                            _initialMessagesPageLoaded.value = 1L
                        }
                    }
                    val existingById = currentMessages.associateBy { it.messageIdValue }
                    val normalizedMessages =
                        messages.map { msg ->
                            mergeIncomingMessage(msg, existingById[msg.messageIdValue])
                        }
                    if (wasInitialFetch && normalizedMessages.isNotEmpty()) {
                        val quickMerged =
                            mergeInitialPageWithCachedMessages(
                                cached = currentMessages,
                                incoming =
                                    normalizedMessages.map { msg ->
                                        pendingE2eMessagePreview(msg, existingById[msg.messageIdValue])
                                    },
                            )
                        _messages.value = quickMerged
                    }
                    val decryptedMessages =
                        decryptIncomingMessages(
                            normalizedMessages,
                            chatId,
                            existingMessages = _messages.value,
                        )
                    val mergedMessages =
                        when (messagesFetchMode) {
                            MessagesFetchMode.INITIAL ->
                                mergeInitialPageWithCachedMessages(
                                    cached = currentMessages,
                                    incoming = decryptedMessages,
                                )
                            MessagesFetchMode.OLDER -> {
                                val incomingIds = decryptedMessages.map { it.messageIdValue }.toSet()
                                val olderCached =
                                    currentMessages.filter { it.messageIdValue !in incomingIds }
                                (olderCached + decryptedMessages)
                                    .distinctBy { it.messageIdValue }
                                    .sortedBy { it.createdAtValue }
                            }
                        }
                    messagesFetchMode = MessagesFetchMode.INITIAL
                    if (wasInitialFetch || currentMessages != mergedMessages) {
                        _messages.value = mergedMessages
                        if (mergedMessages.isNotEmpty()) {
                            persistChatMessagesDebounced(chatId)
                        }
                        if (wasInitialFetch && _pinnedMessages.value.isEmpty()) {
                            val pinnedInPage =
                                mergedMessages
                                    .filter { it.isPinnedValue }
                                    .sortedByDescending { it.pinnedAtValue.orEmpty() }
                            if (pinnedInPage.isNotEmpty()) {
                                _pinnedMessages.value = pinnedInPage
                            }
                        }
                    }
                    mergedMessages
                        .filter { !isOwnMessage(it) }
                        .forEach { acknowledgeIncomingDelivery(it, chatId) }
                }
            }
            
            chatHub.setOnMessageReceived { message ->
                Log.d("ChatRepository", "SignalR: New message received - ${message.messageIdValue}")
                hubSidecarScope.launch {
                    val currentMessages = _messages.value
                    val existing = currentMessages.firstOrNull { it.messageIdValue == message.messageIdValue }
                    val normalizedMessage = mergeIncomingMessage(message, existing)
                    val decryptedMessage =
                        decryptIncomingMessage(normalizedMessage, chatId, existing)
                    if (!currentMessages.any { it.messageIdValue == message.messageIdValue }) {
                        _messages.value = currentMessages + decryptedMessage
                        Log.d("ChatRepository", "Added new message, total: ${_messages.value.size}")
                        if (!isOwnMessage(decryptedMessage)) {
                            acknowledgeIncomingDelivery(decryptedMessage, chatId)
                        }
                        scheduleMarkChatAsReadDebounced(chatId)
                        persistChatMessagesDebounced(chatId)
                    } else if (
                        existing != null &&
                        existing.createdAtValue.isBlank() &&
                        decryptedMessage.createdAtValue.isNotBlank()
                    ) {
                        _messages.value =
                            currentMessages.map {
                                if (it.messageIdValue == decryptedMessage.messageIdValue) {
                                    decryptedMessage
                                } else {
                                    it
                                }
                            }
                        persistChatMessagesDebounced(chatId)
                    }
                }
            }

            chatHub.setOnMessageStatusChanged { messageId, status ->
                updateMessageStatus(messageId, status)
            }
            
            chatHub.setOnMessageEdited { messageId, newContent ->
                Log.d("ChatRepository", "SignalR: Message edited - $messageId")
                hubSidecarScope.launch {
                    val currentMessages = _messages.value
                    val index = currentMessages.indexOfFirst {
                        it.messageIdValue == messageId
                    }
                    if (index >= 0) {
                        val existingMessage = currentMessages[index]
                        if (existingMessage.contentValue != newContent || !existingMessage.isEditedValue) {
                            val editedIncoming = existingMessage.copy(content = newContent, isEdited = true)
                            val decryptedEdited =
                                decryptIncomingMessage(
                                    editedIncoming,
                                    chatId,
                                    existing = existingMessage,
                                ).copy(isEdited = true)
                            val updatedMessages = currentMessages.toMutableList()
                            updatedMessages[index] = decryptedEdited
                            _messages.value = updatedMessages
                            persistChatMessagesDebounced(chatId)
                        }
                    }
                }
            }
            
            chatHub.setOnMessageDeleted { messageId ->
                val normalizedId = messageId.trim().trim('"')
                Log.d("ChatRepository", "SignalR: Message deleted - $normalizedId")
                hubSidecarScope.launch {
                    chatMessagesLocalStore.removeMessage(normalizedId)
                    val currentMessages = _messages.value
                    val filtered =
                        currentMessages.filter {
                            !it.messageIdValue.equals(normalizedId, ignoreCase = true)
                        }
                    if (filtered.size != currentMessages.size) {
                        _messages.value = filtered
                        persistChatMessagesDebounced(chatId)
                    }
                }
            }

            chatHub.setOnChatInfoReceived { dto ->
                val activeChatId = _activeChatHubChatId?.trim().orEmpty()
                if (
                    activeChatId.isNotBlank() &&
                        dto.chatIdValue.equals(activeChatId, ignoreCase = true)
                ) {
                    _chatDetailInfo.value = dto
                }
            }

            chatHub.setOnChatParticipantsReceived { parts ->
                val chatDecorations =
                    _chats.value.associate { chat ->
                        chat.userIdValue to chat.avatarDecorationValue
                    }
                _chatParticipants.value =
                    parts.map { participant ->
                        if (!participant.avatarDecorationValue.isNullOrBlank()) {
                            participant
                        } else {
                            val decoration = chatDecorations[participant.userIdValue]
                            if (decoration.isNullOrBlank()) {
                                participant
                            } else {
                                participant.copy(avatarDecoration = decoration)
                            }
                        }
                    }
            }

            chatHub.setOnAvailableUsersReceived { users ->
                _groupAvailableUsers.value = users
                _groupAvailableUsersLoading.value = false
            }

            chatHub.setOnUserAddedToGroup {
                refreshChatDetailFromHub(chatId)
                _groupAvailableUsers.value =
                    _groupAvailableUsers.value.filterNot { user ->
                        user.userIdValue.equals(it, ignoreCase = true)
                    }
            }

            chatHub.setOnGroupUpdated { action, _ ->
                if (action == "user_added" || action == "user_left") {
                    refreshChatDetailFromHub(chatId)
                }
            }

            chatHub.setOnChatDeletedSignal { deleted ->
                val normalized = deleted.trim()
                if (normalized.isNotBlank()) {
                    chatHub.leaveBackgroundGroup(normalized)
                    _chats.value =
                        _chats.value.filterNot { it.chatIdValue.equals(normalized, ignoreCase = true) }
                    hubSidecarScope.launch {
                        chatMessagesLocalStore.clearChat(normalized)
                    }
                }
                if (deleted.equals(chatId, ignoreCase = true)) {
                    _chatDeleted.tryEmit(deleted)
                }
            }

            chatHub.setOnReconnected {
                hubSidecarScope.launch {
                    try {
                        refreshChatDetailFromHub(chatId)
                        fetchChatInfoRest(chatId)
                    } catch (e: Exception) {
                        Log.w("ChatRepository", "refresh after hub reconnect failed", e)
                    }
                }
            }

            chatHub.setOnUserTyping { eventChatId, userId, username ->
                if (!eventChatId.equals(chatId, ignoreCase = true)) return@setOnUserTyping
                addTypingUser(chatId, TypingUser(userId, username))
            }

            chatHub.setOnUserStoppedTyping { eventChatId, userId ->
                if (!eventChatId.equals(chatId, ignoreCase = true)) return@setOnUserStoppedTyping
                removeTypingUser(chatId, userId)
            }

            chatHub.setOnPinnedMessagesReceived { pinned ->
                val activeChatId = _activeChatHubChatId?.trim().orEmpty()
                val relevant =
                    pinned.filter { message ->
                        activeChatId.isBlank() ||
                            message.chatIdValue.isBlank() ||
                            message.chatIdValue.equals(activeChatId, ignoreCase = true)
                    }
                Log.d("ChatRepository", "Received ${relevant.size} pinned messages for chat=$activeChatId")
                _pinnedMessages.value =
                    relevant.sortedByDescending { it.pinnedAtValue.orEmpty() }
                applyPinnedFlagsToMessages(relevant)
            }

            chatHub.setOnMessagePinned { messageId, pinnedAt ->
                patchMessage(messageId) { msg ->
                    msg.copy(isPinned = true, isPinnedAlt = null, pinnedAt = pinnedAt, pinnedAtAlt = null)
                }
                refreshPinnedListFromMessages()
                if (_pinnedMessages.value.none { it.messageIdValue.equals(messageId, ignoreCase = true) }) {
                    _activeChatHubChatId?.let { chatHub.requestPinnedMessages(it) }
                }
            }

            chatHub.setOnMessageUnpinned { messageId ->
                patchMessage(messageId) { msg ->
                    msg.copy(isPinned = false, isPinnedAlt = null, pinnedAt = null, pinnedAtAlt = null)
                }
                refreshPinnedListFromMessages()
            }

            chatHub.setOnPollUpdated { messageId, poll ->
                patchMessage(messageId) { msg ->
                    msg.copy(poll = poll, pollAlt = null, contentType = "poll", contentTypeAlt = null)
                }
            }

            val hubConnectStartedAt = android.os.SystemClock.elapsedRealtime()
            val result = chatHub.connect(chatId)
            val hubConnectMs = android.os.SystemClock.elapsedRealtime() - hubConnectStartedAt
            if (!isChatScreenSessionActive(sessionId)) {
                return Result.failure(kotlinx.coroutines.CancellationException("stale chat screen session"))
            }
            if (result.isSuccess) {
                Log.d("ChatRepository", "ChatHub connected successfully")
                ChatOpenPerfLog.mark(chatId, "chatHub_connect_ok", "hubConnectMs=$hubConnectMs")
                refreshChatDetailFromHub(chatId)
                hubSidecarScope.launch { fetchChatInfoRest(chatId) }
                scheduleHubMessagesFallback(chatId)
                chatHub.requestPinnedMessages(chatId)
                scheduleMarkChatAsReadDebounced(chatId)
            } else {
                Log.e("ChatRepository", "ChatHub connection failed", result.exceptionOrNull())
                ChatOpenPerfLog.mark(
                    chatId,
                    "chatHub_connect_fail",
                    "hubConnectMs=$hubConnectMs err=${result.exceptionOrNull()?.message}",
                )
            }
            result
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while connecting ChatHub", e)
            Result.failure(e)
        }
    }
    
    fun notifyTyping(chatId: String, username: String) {
        if (chatId.isBlank()) return
        chatHub.notifyTyping(chatId, username)
    }

    fun notifyStopTyping(chatId: String) {
        if (chatId.isBlank()) return
        chatHub.notifyStopTyping(chatId)
    }

    private fun addTypingUser(chatId: String, user: TypingUser) {
        if (user.userId.isBlank()) return
        val key = "$chatId:${user.userId}"
        typingExpiryJobs[key]?.cancel()
        val updated =
            _typingUsers.value[chatId].orEmpty()
                .filter { it.userId != user.userId } + user
        _typingUsers.value = _typingUsers.value + (chatId to updated)
        typingExpiryJobs[key] =
            hubSidecarScope.launch {
                delay(5_000)
                removeTypingUser(chatId, user.userId)
            }
    }

    private fun removeTypingUser(chatId: String, userId: String) {
        if (userId.isBlank()) return
        typingExpiryJobs.remove("$chatId:$userId")?.cancel()
        val updated = _typingUsers.value[chatId].orEmpty().filter { it.userId != userId }
        _typingUsers.value =
            if (updated.isEmpty()) {
                _typingUsers.value - chatId
            } else {
                _typingUsers.value + (chatId to updated)
            }
    }

    private fun clearTypingUsers(chatId: String? = null) {
        if (chatId != null) {
            typingExpiryJobs.keys
                .filter { it.startsWith("$chatId:") }
                .forEach { key ->
                    typingExpiryJobs.remove(key)?.cancel()
                }
            _typingUsers.value = _typingUsers.value - chatId
        } else {
            typingExpiryJobs.values.forEach { it.cancel() }
            typingExpiryJobs.clear()
            _typingUsers.value = emptyMap()
        }
    }

    /** Backing out of chat screen: leave group, keep hub warm, preserve cached transcript. */
    private fun scheduleHubMessagesFallback(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        hubMessagesFallbackJob?.cancel()
        hubMessagesFallbackJob =
            hubSidecarScope.launch {
                delay(HUB_MESSAGES_FALLBACK_MS)
                if (_activeChatHubChatId != normalized) return@launch
                if (_initialMessagesPageLoaded.value > 0L) return@launch
                ChatOpenPerfLog.mark(normalized, "rest_fallback_start")
                try {
                    val response =
                        chatApi.getMessagesPage(
                            chatId = normalized,
                            limit = ChatHub.DEFAULT_MESSAGE_PAGE_SIZE,
                        )
                    if (!response.isSuccessful) {
                        ChatOpenPerfLog.mark(
                            normalized,
                            "rest_fallback_fail",
                            "code=${response.code()}",
                        )
                        return@launch
                    }
                    if (_activeChatHubChatId != normalized) return@launch
                    if (_initialMessagesPageLoaded.value > 0L) return@launch
                    val page = response.body()?.messages.orEmpty()
                    if (page.isEmpty()) return@launch
                    ChatOpenPerfLog.mark(normalized, "rest_fallback_ok", "count=${page.size}")
                    mergeInitialMessagesFromNetwork(normalized, page, source = "rest")
                } catch (e: Exception) {
                    Log.w("ChatRepository", "REST messages fallback failed chatId=$normalized", e)
                    ChatOpenPerfLog.mark(normalized, "rest_fallback_error", e.message.orEmpty())
                }
            }
    }

    private fun mergeInitialMessagesFromNetwork(
        chatId: String,
        incoming: List<Message>,
        source: String,
    ) {
        if (_activeChatHubChatId != chatId.trim()) return
        hubSidecarScope.launch {
            val currentMessages = _messages.value
            val existingById = currentMessages.associateBy { it.messageIdValue }
            val normalizedMessages =
                incoming.map { msg ->
                    mergeIncomingMessage(msg, existingById[msg.messageIdValue])
                }
            val decryptedMessages = decryptIncomingMessages(normalizedMessages, chatId)
            if (_activeChatHubChatId != chatId.trim()) return@launch
            val merged =
                mergeInitialPageWithCachedMessages(
                    cached = currentMessages,
                    incoming = decryptedMessages,
                )
            if (merged != _messages.value) {
                _messages.value = merged
                if (merged.isNotEmpty()) {
                    persistChatMessagesDebounced(chatId)
                }
            }
            if (_initialMessagesPageLoaded.value == 0L) {
                _initialMessagesPageLoaded.value = 1L
            }
            ChatOpenPerfLog.mark(chatId, "network_messages_applied", "source=$source count=${incoming.size}")
        }
    }

    fun detachChatHub(sessionId: Long) {
        if (!isChatScreenSessionActive(sessionId)) {
            Log.d(
                "ChatRepository",
                "detachChatHub skipped stale session=$sessionId current=$chatScreenSessionId",
            )
            return
        }
        chatScreenSessionId = 0L
        val chatId = _activeChatHubChatId?.trim().orEmpty()
        val snapshot = _messages.value
        markChatReadDebouncedJob?.cancel()
        markChatReadDebouncedJob = null
        persistChatMessagesJob?.cancel()
        persistChatMessagesJob = null
        stopObservingCachedMessages()
        if (chatId.isNotBlank() && snapshot.isNotEmpty()) {
            hubSidecarScope.launch {
                chatMessagesLocalStore.saveMessages(chatId, snapshot)
            }
        }
        clearTypingUsers(chatId.takeIf { it.isNotBlank() })
        preparedScreenChatId = null
        _activeChatHubChatId = null
        _hasMoreOlder.value = false
        _isLoadingOlder.value = false
        _chatDetailInfo.value = null
        _chatParticipants.value = emptyList()
        _chatMediaFiles.value = emptyList()
        _chatMediaLoading.value = false
        _messages.value = emptyList()
        _pinnedMessages.value = emptyList()
        hubMessagesFallbackJob?.cancel()
        hubMessagesFallbackJob = null
        chatHub.leaveActiveChat(chatId.takeIf { it.isNotBlank() })
    }

    /** Logout / session end: tear down hub completely. */
    fun disconnectChatHub() {
        val chatId = _activeChatHubChatId?.trim().orEmpty()
        val snapshot = _messages.value
        markChatReadDebouncedJob?.cancel()
        markChatReadDebouncedJob = null
        persistChatMessagesJob?.cancel()
        persistChatMessagesJob = null
        stopObservingCachedMessages()
        if (chatId.isNotBlank() && snapshot.isNotEmpty()) {
            hubSidecarScope.launch {
                chatMessagesLocalStore.saveMessages(chatId, snapshot)
            }
        }
        _activeChatHubChatId = null
        acknowledgedDeliveries.clear()
        _hasMoreOlder.value = false
        _isLoadingOlder.value = false
        clearChatHubCallbacks()
        clearTypingUsers()
        _chatDetailInfo.value = null
        _chatParticipants.value = emptyList()
        _chatMediaFiles.value = emptyList()
        _chatMediaLoading.value = false
        _messages.value = emptyList()
        CoroutineScope(Dispatchers.IO).launch {
            chatHub.disconnect()
        }
    }

    private fun clearChatHubCallbacks() {
        chatHub.setOnMessagesMetaReceived(null)
        chatHub.setOnMessagesReceived(null)
        chatHub.setOnMessageReceived(null)
        chatHub.setOnMessageEdited(null)
        chatHub.setOnMessageDeleted(null)
        chatHub.setOnChatInfoReceived(null)
        chatHub.setOnChatParticipantsReceived(null)
        chatHub.setOnChatDeletedSignal(null)
        chatHub.setOnReconnected(null)
        chatHub.setOnUserTyping(null)
        chatHub.setOnUserStoppedTyping(null)
        chatHub.setOnMessageStatusChanged(null)
        chatHub.setOnMessagePinned(null)
        chatHub.setOnMessageUnpinned(null)
        chatHub.setOnPinnedMessagesReceived(null)
        chatHub.setOnPollUpdated(null)
    }

    private fun patchMessage(messageId: String, transform: (Message) -> Message) {
        val normalized = messageId.trim()
        if (normalized.isBlank()) return
        val current = _messages.value
        val updated =
            current.map { message ->
                if (message.messageIdValue.equals(normalized, ignoreCase = true)) {
                    transform(message)
                } else {
                    message
                }
            }
        if (updated != current) {
            _messages.value = updated
            _activeChatHubChatId?.let { persistChatMessagesDebounced(it) }
        }
    }

    private fun refreshPinnedListFromMessages() {
        _pinnedMessages.value =
            _messages.value
                .filter { it.isPinnedValue }
                .sortedByDescending { it.pinnedAtValue.orEmpty() }
    }

    private fun applyPinnedFlagsToMessages(pinned: List<Message>) {
        if (pinned.isEmpty()) return
        val pinnedById =
            pinned.associateBy { it.messageIdValue.trim().lowercase() }
        val updated =
            _messages.value.map { message ->
                val pin = pinnedById[message.messageIdValue.trim().lowercase()] ?: return@map message
                message.copy(
                    isPinned = true,
                    isPinnedAlt = true,
                    pinnedAt = pin.pinnedAt ?: pin.pinnedAtAlt,
                    pinnedAtAlt = pin.pinnedAtAlt ?: pin.pinnedAt,
                )
            }
        if (updated != _messages.value) {
            _messages.value = updated
        }
    }

    suspend fun pinMessage(messageId: String): Result<Unit> = chatHub.pinMessage(messageId)

    suspend fun unpinMessage(messageId: String): Result<Unit> = chatHub.unpinMessage(messageId)

    fun requestPinnedMessages(chatId: String) {
        chatHub.requestPinnedMessages(chatId)
    }

    suspend fun createPoll(
        chatId: String,
        question: String,
        options: List<String>,
        allowMultiple: Boolean,
        isAnonymous: Boolean,
    ): Result<Unit> = chatHub.createPoll(chatId, question, options, allowMultiple, isAnonymous)

    suspend fun votePoll(messageId: String, optionIds: List<String>): Result<Unit> =
        chatHub.votePoll(messageId, optionIds)

    suspend fun saveMessageToFavorites(messageId: String, username: String): Result<Unit> {
        val savedChatId = savedMessagesChatId?.trim().orEmpty()
        if (savedChatId.isBlank()) {
            return Result.failure(Exception("Чат «Избранное» не найден"))
        }
        return forwardMessage(
            sourceMessageId = messageId,
            targetChatId = savedChatId,
            comment = "",
            username = username,
            activeChatId = _activeChatHubChatId,
        )
    }

    /** Уведомить участников чата о исходящем звонке (как кнопка «со звонком» на вебе). */
    fun notifyOutgoingVoiceCall(chatId: String, callerDisplayName: String, callerUserId: String) {
        chatHub.sendOutgoingCallNotification(chatId, callerDisplayName, callerUserId)
    }

    fun acceptCall(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        markLocalCallAccept(normalized)
        hubSidecarScope.launch {
            val userId =
                currentUserId?.trim().orEmpty().ifBlank {
                    tokenManager.getUserFromToken()?.id.orEmpty()
                }
            if (userId.isNotBlank()) {
                chatHub.ensureUserSession(userId)
            }
            chatHub.acceptCall(normalized)
        }
    }

    fun declineCall(chatId: String) {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return
        hubSidecarScope.launch {
            val userId =
                currentUserId?.trim().orEmpty().ifBlank {
                    tokenManager.getUserFromToken()?.id.orEmpty()
                }
            if (userId.isNotBlank()) {
                chatHub.ensureUserSession(userId)
            }
            chatHub.declineCall(normalized)
        }
    }

    fun cancelOutgoingCall(chatId: String) {
        chatHub.cancelOutgoingCall(chatId)
    }

    fun reportMissedCall(chatId: String) {
        chatHub.reportMissedCall(chatId)
    }

    fun endCall(chatId: String, durationSeconds: Int) {
        chatHub.endCall(chatId, durationSeconds)
    }
    
    suspend fun uploadMedia(
        chatId: String,
        fileUri: Uri,
        context: android.content.Context,
        username: String? = null,
        caption: String? = null,
        isVideoNote: Boolean = false,
    ): Result<UploadMediaResponse> =
        mediaUploadHelper.uploadMedia(chatId, fileUri, context, username, caption, isVideoNote)

    suspend fun uploadMediaBatch(
        chatId: String,
        fileUris: List<Uri>,
        context: android.content.Context,
        username: String? = null,
        caption: String? = null,
    ): Result<UploadMediaBatchResponse> =
        mediaUploadHelper.uploadMediaBatch(chatId, fileUris, context, username, caption)

    private fun isOwnMessage(message: Message): Boolean {
        val senderId = message.senderIdValue.trim()
        val userId = currentUserId?.trim().orEmpty()
        return senderId.isNotBlank() && userId.isNotBlank() && senderId.equals(userId, ignoreCase = true)
    }

    private val messageTimelineComparator: Comparator<Message> =
        compareBy<Message> { it.createdAtValue }.thenBy { it.messageIdValue.lowercase() }

    /**
     * Keeps cached messages older/newer than the server page, but drops rows inside the page
     * window that the server no longer returns (hard-deleted messages).
     */
    private fun applyCachedDecryptedContent(
        incoming: Message,
        cachedById: Map<String, Message>,
    ): Message = e2eTranscript.applyCachedDecryptedContent(incoming, cachedById)

    private fun cachedMessagesToKeepOutsidePage(
        cached: List<Message>,
        incoming: List<Message>,
    ): List<Message> {
        if (incoming.isEmpty()) return cached

        val incomingIds = incoming.map { it.messageIdValue }.toSet()
        val oldestIncoming = incoming.minWithOrNull(messageTimelineComparator) ?: return emptyList()
        val newestIncoming = incoming.maxWithOrNull(messageTimelineComparator) ?: return emptyList()

        return cached.filter { message ->
            val id = message.messageIdValue
            if (id.isBlank() || id in incomingIds) return@filter false
            when {
                messageTimelineComparator.compare(message, oldestIncoming) < 0 -> true
                messageTimelineComparator.compare(message, newestIncoming) > 0 -> true
                else -> false
            }
        }
    }

    private fun mergeInitialPageWithCachedMessages(
        cached: List<Message>,
        incoming: List<Message>,
    ): List<Message> {
        if (incoming.isEmpty()) {
            return cached
                .distinctBy { it.messageIdValue }
                .sortedWith(messageTimelineComparator)
        }
        val cachedById = cached.associateBy { it.messageIdValue }
        val enrichedIncoming = incoming.map { applyCachedDecryptedContent(it, cachedById) }
        return (cachedMessagesToKeepOutsidePage(cached, enrichedIncoming) + enrichedIncoming)
            .distinctBy { it.messageIdValue }
            .sortedWith(messageTimelineComparator)
    }

    private fun mergeIncomingMessage(message: Message, existing: Message?): Message {
        var merged = normalizeIncomingMessage(message, existing)
        if (isOwnMessage(merged)) {
            val nextStatus = MessageStatus.pickHigher(existing?.statusValue, merged.statusValue)
            merged = merged.copy(status = nextStatus, statusAlt = null)
        }
        return merged
    }

    private suspend fun decryptIncomingMessage(
        message: Message,
        chatId: String,
        existing: Message? = null,
    ): Message =
        e2eTranscript.decryptIncomingMessage(
            message = message,
            chatId = chatId,
            existing = existing,
            userId = currentUserId,
            memberUserIds = e2eMemberUserIds,
            peerUserId = e2ePeerUserId,
        )

    private suspend fun decryptIncomingMessages(
        messages: List<Message>,
        chatId: String,
        existingMessages: List<Message>? = null,
    ): List<Message> =
        e2eTranscript.decryptIncomingMessages(
            messages = messages,
            chatId = chatId,
            existingMessages = existingMessages ?: _messages.value,
            userId = currentUserId,
            memberUserIds = e2eMemberUserIds,
            peerUserId = e2ePeerUserId,
        )

    private fun pendingE2eMessagePreview(incoming: Message, existing: Message?): Message =
        e2eTranscript.pendingE2eMessagePreview(incoming, existing)

    private fun messagesContentChanged(before: List<Message>, after: List<Message>): Boolean =
        e2eTranscript.messagesContentChanged(before, after)

    private fun normalizeIncomingMessage(message: Message, existing: Message?): Message {
        if (message.createdAtValue.isNotBlank()) return message
        if (existing != null && existing.createdAtValue.isNotBlank()) {
            return message.copy(
                createdAt = existing.createdAtValue,
                createdAtAlt = null
            )
        }
        return message.copy(
            createdAt = nowUtcIso(),
            createdAtAlt = null
        )
    }

    private fun acknowledgeIncomingDelivery(message: Message, chatId: String) {
        val messageId = message.messageIdValue.trim()
        if (messageId.isBlank() || isOwnMessage(message)) return
        if (acknowledgedDeliveries.contains(messageId)) return
        acknowledgedDeliveries.add(messageId)
        chatHub.acknowledgeDelivery(messageId, chatId)
    }

    private fun updateMessageStatus(messageId: String, status: String) {
        val id = messageId.trim()
        if (id.isBlank()) return
        val normalized = MessageStatus.normalize(status)
        val currentMessages = _messages.value
        val updated =
            currentMessages.map { message ->
                if (message.messageIdValue == id) {
                    message.copy(
                        status = MessageStatus.pickHigher(message.statusValue, normalized),
                        statusAlt = null,
                    )
                } else {
                    message
                }
            }
        if (updated != currentMessages) {
            _messages.value = updated
            _activeChatHubChatId?.let { persistChatMessagesDebounced(it) }
        }
    }

    private fun nowUtcIso(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
    }

    private fun dedupeChatList(chats: List<ChatInfo>): List<ChatInfo> {
        val uniqueById = LinkedHashMap<String, ChatInfo>()
        chats.forEach { chat ->
            val id = chat.chatIdValue.trim()
            if (id.isNotBlank()) {
                uniqueById[id.lowercase()] = chat
            }
        }

        val deduped = uniqueById.values.toList()
        val savedChats =
            deduped.filter { chat ->
                chat.isSavedMessages == true || chat.isSavedMessagesAlt == true
            }
        if (savedChats.size <= 1) {
            return deduped
        }

        val keepSaved =
            savedChats.maxByOrNull { chat -> chat.lastMessageTimeValue.ifEmpty { "" } }
                ?: savedChats.first()
        return deduped.filter { chat ->
            val isSaved = chat.isSavedMessages == true || chat.isSavedMessagesAlt == true
            !isSaved || chat.chatIdValue.equals(keepSaved.chatIdValue, ignoreCase = true)
        }
    }

    private fun sortChatsByLastMessage(chats: List<ChatInfo>): List<ChatInfo> {
        return sortChatList(dedupeChatList(chats))
    }

    private fun mergeIncomingChats(
        current: List<ChatInfo>,
        incoming: List<ChatInfo>,
    ): List<ChatInfo> {
        if (current.isEmpty()) return incoming
        val incomingById =
            incoming.associateBy { it.chatIdValue.trim().lowercase() }
        val merged =
            current.map { existing ->
                val patch = incomingById[existing.chatIdValue.trim().lowercase()]
                if (patch != null) mergeChatListPreview(existing, patch) else existing
            }.toMutableList()
        val mergedIds = merged.map { it.chatIdValue.trim().lowercase() }.toSet()
        incoming
            .filter { it.chatIdValue.trim().lowercase() !in mergedIds }
            .forEach { merged.add(it) }
        return merged
    }

    private fun mergeChatListPreview(existing: ChatInfo, incoming: ChatInfo): ChatInfo {
        val incomingPayload = incoming.lastMessageEncryptedPayloadValue?.trim()?.takeIf { it.isNotBlank() }
        val existingPayload = existing.lastMessageEncryptedPayloadValue?.trim()?.takeIf { it.isNotBlank() }
        val payload = incomingPayload ?: existingPayload

        val encVersion =
            incoming.lastMessageEncryptionVersionValue.takeIf { it > 0 }
                ?: existing.lastMessageEncryptionVersionValue

        val incomingMsg = incoming.lastMessageValue.orEmpty()
        val existingMsg = existing.lastMessageValue.orEmpty()
        val incomingIsEncryptedPlaceholder =
            encVersion > 0 &&
                (incomingMsg == "Зашифрованное сообщение" || E2eEnvelope.isE2eEnvelope(incomingMsg))

        if (existing.e2eLastMessageDecryptedValue && incomingIsEncryptedPlaceholder) {
            val samePayload = payload != null && payload == existingPayload
            if (samePayload || incomingPayload == null) {
                return incoming.copy(
                    lastMessage = existingMsg,
                    lastMessageAlt = existingMsg,
                    lastMessageEncryptionVersion = encVersion.takeIf { it > 0 },
                    lastMessageEncryptionVersionAlt = encVersion.takeIf { it > 0 },
                    lastMessageEncryptedPayload = payload,
                    lastMessageEncryptedPayloadAlt = payload,
                    lastMessageSenderId = incoming.lastMessageSenderIdValue ?: existing.lastMessageSenderIdValue,
                    lastMessageSenderIdAlt = incoming.lastMessageSenderIdValue ?: existing.lastMessageSenderIdValue,
                    e2eLastMessageDecrypted = true,
                    e2eLastMessageDecryptedAlt = true,
                )
            }
        }

        val merged =
            incoming.copy(
                lastMessageEncryptedPayload = payload,
                lastMessageEncryptedPayloadAlt = payload,
                lastMessageEncryptionVersion = encVersion.takeIf { it > 0 },
                lastMessageEncryptionVersionAlt = encVersion.takeIf { it > 0 },
                lastMessageSenderId = incoming.lastMessageSenderIdValue ?: existing.lastMessageSenderIdValue,
                lastMessageSenderIdAlt = incoming.lastMessageSenderIdValue ?: existing.lastMessageSenderIdValue,
            )

        if (encVersion > 0 && payload != null && payload != existingPayload) {
            return merged.copy(
                e2eLastMessageDecrypted = false,
                e2eLastMessageDecryptedAlt = false,
            )
        }
        if (encVersion > 0 && !existing.e2eLastMessageDecryptedValue) {
            return merged.copy(
                e2eLastMessageDecrypted = false,
                e2eLastMessageDecryptedAlt = false,
            )
        }
        return merged
    }

    private fun chatListPreviewsChanged(before: List<ChatInfo>, after: List<ChatInfo>): Boolean {
        if (before.size != after.size) return true
        val afterById = after.associateBy { it.chatIdValue.trim().lowercase() }
        return before.any { prev ->
            val next = afterById[prev.chatIdValue.trim().lowercase()] ?: return@any true
            prev.lastMessageValue != next.lastMessageValue ||
                prev.e2eLastMessageDecryptedValue != next.e2eLastMessageDecryptedValue
        }
    }

    private fun upsertAndSortChat(updatedChat: ChatInfo) {
        val chatId = updatedChat.chatIdValue.trim()
        if (chatId.isBlank()) return
        val current = _chats.value.toMutableList()
        val index = current.indexOfFirst { it.chatIdValue.equals(chatId, ignoreCase = true) }
        if (index >= 0) {
            current[index] = mergeChatListPreview(current[index], updatedChat)
        } else {
            current.add(updatedChat)
        }
        val sorted = sortChatsByLastMessage(current)
        publishChatsWithE2eDecrypt(sorted)
        hubSidecarScope.launch {
            syncBackgroundChatGroups()
        }
    }

    private fun applyStatusUpdate(event: UserStatusChangedEvent) {
        val targetUserId = event.userIdValue
        if (targetUserId.isBlank()) return

        _chats.value = _chats.value.map { chat ->
            if (!chat.isGroupChatValue && chat.userIdValue == targetUserId) {
                chat.copy(
                    userStatus = event.statusValue,
                    userStatusAlt = null,
                    lastSeen = event.lastSeenValue,
                    lastSeenAlt = null
                )
            } else {
                chat
            }
        }
    }

    companion object {
        private const val PREFETCH_CHAT_COUNT = 8
        private const val PREFETCH_CONCURRENCY = 3
        private const val PREFETCH_START_DELAY_MS = 8_000L
        private const val HUB_MESSAGES_FALLBACK_MS = 1_200L
        private const val CHATS_FETCH_COOLDOWN_MS = 30_000L
    }
}
