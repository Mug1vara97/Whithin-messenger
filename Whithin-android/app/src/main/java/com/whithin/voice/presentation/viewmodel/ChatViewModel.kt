package com.whithin.voice.presentation.viewmodel

import android.content.Context
import android.net.Uri
import android.util.Log
import java.io.File
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.local.MediaDownloadHelper
import com.whithin.voice.data.local.MediaSaveTarget
import com.whithin.voice.data.model.ChatDetailInfo
import com.whithin.voice.data.model.ChatInfo
import com.whithin.voice.data.model.ChatParticipant
import com.whithin.voice.data.model.ForwardChannelTarget
import com.whithin.voice.data.model.Server
import com.whithin.voice.data.model.ServerDetail
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.data.model.Message
import com.whithin.voice.data.model.MessageStatus
import com.whithin.voice.data.model.RepliedMessage
import com.whithin.voice.presentation.ui.media.MediaViewerItem
import com.whithin.voice.data.model.TypingUser
import com.whithin.voice.data.model.VoiceChannelParticipant
import com.whithin.voice.data.e2e.E2eEncryptionException
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.repository.ServerDetailRepository
import com.whithin.voice.data.repository.ServerRepository
import com.whithin.voice.data.repository.StickerRepository
import com.whithin.voice.data.repository.VoiceChannelPresenceService
import com.whithin.voice.presentation.notifications.ChatNotificationManager
import com.whithin.voice.presentation.ui.media.ChatImagePrefetcher
import com.whithin.voice.util.ChatOpenPerfLog
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.*
import kotlin.math.abs
import javax.inject.Inject

data class ChatUiState(
    val messages: List<Message> = emptyList(),
    val isLoading: Boolean = false,
    val isLoadingOlder: Boolean = false,
    val hasMoreOlder: Boolean = false,
    val error: String? = null,
    val isConnected: Boolean = false,
    val replyToMessage: Message? = null,
    val editingMessage: Message? = null,
    val forwardMessage: Message? = null,
    val forwardMessages: List<Message> = emptyList(),
    val pinnedMessages: List<Message> = emptyList(),
    val pinnedBarIndex: Int = 0,
    val selectionMode: Boolean = false,
    val selectedMessageIds: Set<String> = emptySet(),
    val showCreatePoll: Boolean = false,
)

private data class OptimisticSenderVisuals(
    val senderId: String?,
    val avatarUrl: String?,
    val avatarColor: String?,
    val avatarDecoration: String?,
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val chatRepository: ChatRepository,
    private val authRepository: AuthRepository,
    private val mediaDownloadHelper: MediaDownloadHelper,
    private val stickerRepository: StickerRepository,
    private val chatNotificationManager: ChatNotificationManager,
    private val serverRepository: ServerRepository,
    private val serverDetailRepository: ServerDetailRepository,
    private val voiceChannelPresenceService: VoiceChannelPresenceService,
    private val chatImagePrefetcher: ChatImagePrefetcher,
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    /** Narrow collection for message list — avoids recomposing list on reply/edit/connection changes. */
    val messages: StateFlow<List<Message>> =
        _uiState
            .map { it.messages }
            .distinctUntilChanged()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val selectionState: StateFlow<Pair<Boolean, Set<String>>> =
        _uiState
            .map { it.selectionMode to it.selectedMessageIds }
            .distinctUntilChanged()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false to emptySet())

    private val _forwardChannels = MutableStateFlow<List<ForwardChannelTarget>>(emptyList())
    val forwardChannels: StateFlow<List<ForwardChannelTarget>> = _forwardChannels.asStateFlow()

    private val _forwardTargetsLoading = MutableStateFlow(false)
    val forwardTargetsLoading: StateFlow<Boolean> = _forwardTargetsLoading.asStateFlow()

    private var forwardTargetsJob: Job? = null
    private var watchedVoiceChatId: String? = null
    private var typingNotifyJob: Job? = null
    private var typingHeartbeatJob: Job? = null
    private var lastTypingSent = false
    private var typingChatId: String? = null

    companion object {
        /** Повторный пинг, чтобы у получателя сбрасывался 5‑секундный таймер. */
        private const val TYPING_HEARTBEAT_MS = 2_000L
        private const val TYPING_IDLE_MS = 3_000L
        private const val TEMP_MESSAGE_PREFIX = "temp_"
        private const val OPTIMISTIC_MATCH_WINDOW_MS = 12_000L
    }

    private fun isOptimisticMessage(message: Message): Boolean =
        message.messageIdValue.startsWith(TEMP_MESSAGE_PREFIX)

    private fun parseIsoMillis(value: String): Long? =
        runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()

    private fun isMatchingOptimisticMessage(
        optimistic: Message,
        repository: Message,
    ): Boolean {
        if (!isOptimisticMessage(optimistic) || isOptimisticMessage(repository)) return false
        if (!repository.chatIdValue.equals(optimistic.chatIdValue, ignoreCase = true)) return false

        val optimisticSender = optimistic.senderIdValue.trim()
        val repositorySender = repository.senderIdValue.trim()
        if (
            optimisticSender.isNotBlank() &&
                repositorySender.isNotBlank() &&
                !repositorySender.equals(optimisticSender, ignoreCase = true)
        ) {
            return false
        }

        val optimisticAt = parseIsoMillis(optimistic.createdAtValue) ?: return false
        val repositoryAt = parseIsoMillis(repository.createdAtValue) ?: return false
        if (abs(repositoryAt - optimisticAt) > OPTIMISTIC_MATCH_WINDOW_MS) return false

        val optimisticMedia = optimistic.mediaFilesValue
        val repositoryMedia = repository.mediaFilesValue
        if (optimisticMedia.isEmpty() && repositoryMedia.isEmpty()) {
            return optimistic.contentValue.trim() == repository.contentValue.trim()
        }

        if (optimisticMedia.isNotEmpty() && repositoryMedia.isNotEmpty()) {
            if (optimisticMedia.size != repositoryMedia.size) return false
            return optimistic.contentValue.trim() == repository.contentValue.trim() ||
                optimistic.contentValue.isBlank() ||
                repository.contentValue.isBlank()
        }

        return false
    }

    private fun isRecentMessage(createdAtIso: String, windowMs: Long): Boolean {
        val createdAt = parseIsoMillis(createdAtIso) ?: return false
        return abs(System.currentTimeMillis() - createdAt) <= windowMs
    }

    private fun mergeRepositoryMessages(
        repositoryMessages: List<Message>,
        currentMessages: List<Message>,
    ): List<Message> {
        val pendingLocal =
            currentMessages.filter { message ->
                isOptimisticMessage(message) &&
                    repositoryMessages.none { repo ->
                        repo.messageIdValue == message.messageIdValue ||
                            isMatchingOptimisticMessage(message, repo)
                    }
            }
        val merged =
            if (pendingLocal.isEmpty()) {
                repositoryMessages
            } else {
                (repositoryMessages + pendingLocal).sortedBy { it.createdAtValue }
            }
        return merged.distinctBy { message ->
            message.messageIdValue.trim().ifBlank {
                "${message.createdAtValue}|${message.senderIdValue}|${message.contentValue}"
            }
        }
    }

    private fun utcNowIso(): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

    private fun resolveOptimisticSenderVisuals(): OptimisticSenderVisuals {
        val senderId = currentUserId.trim().ifBlank { null }
        val cached = senderId?.let { authRepository.peekCachedUserVisuals(it) }
        return OptimisticSenderVisuals(
            senderId = senderId,
            avatarUrl = cached?.avatarUrl,
            avatarColor = cached?.avatarColor ?: "#5865F2",
            avatarDecoration = cached?.avatarDecoration,
        )
    }

    val voiceChannelParticipantsByChat: StateFlow<Map<String, List<VoiceChannelParticipant>>> =
        voiceChannelPresenceService.participantsByChannel

    val chatDetailInfo: StateFlow<ChatDetailInfo?> get() = chatRepository.chatDetailInfo

    val chatParticipants: StateFlow<List<ChatParticipant>> get() = chatRepository.chatParticipants

    private val _userAvatarDecorations = MutableStateFlow<Map<String, String>>(emptyMap())
    val userAvatarDecorations: StateFlow<Map<String, String>> = _userAvatarDecorations.asStateFlow()

    private val _userNameplates = MutableStateFlow<Map<String, String>>(emptyMap())
    val userNameplates: StateFlow<Map<String, String>> = _userNameplates.asStateFlow()

    fun prefetchAvatarDecorations(userIds: Collection<String>) {
        viewModelScope.launch(Dispatchers.IO) {
            userIds
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()
                .forEach { userId ->
                    val cached = authRepository.peekCachedUserVisuals(userId)
                    if (!_userAvatarDecorations.value.containsKey(userId)) {
                        val cachedDecoration = cached?.avatarDecoration
                        if (!cachedDecoration.isNullOrBlank()) {
                            _userAvatarDecorations.value += (userId to cachedDecoration)
                        }
                    }
                    if (!_userNameplates.value.containsKey(userId)) {
                        val cachedNameplate = cached?.nameplate
                        if (!cachedNameplate.isNullOrBlank()) {
                            _userNameplates.value += (userId to cachedNameplate)
                        }
                    }
                    val needsDecoration = !_userAvatarDecorations.value.containsKey(userId)
                    val needsNameplate = !_userNameplates.value.containsKey(userId)
                    if (!needsDecoration && !needsNameplate) return@forEach

                    val profile = authRepository.getUserProfileVisuals(userId) ?: return@forEach
                    val decoration = profile.avatarDecoration?.trim()?.takeIf { it.isNotEmpty() }
                    val nameplate = profile.nameplate?.trim()?.takeIf { it.isNotEmpty() }
                    if (!decoration.isNullOrBlank()) {
                        _userAvatarDecorations.value += (userId to decoration)
                    }
                    if (!nameplate.isNullOrBlank()) {
                        _userNameplates.value += (userId to nameplate)
                    }
                }
        }
    }

    val chatMediaFiles: StateFlow<List<MediaFile>> get() = chatRepository.chatMediaFiles

    val chatMediaLoading: StateFlow<Boolean> get() = chatRepository.chatMediaLoading

    val chatLinks get() = chatRepository.chatLinks

    val chatLinksLoading get() = chatRepository.chatLinksLoading

    val groupAvailableUsers get() = chatRepository.groupAvailableUsers

    val groupAvailableUsersLoading get() = chatRepository.groupAvailableUsersLoading

    val chatDeletedEvent: SharedFlow<String> get() = chatRepository.chatDeleted

    val chats: StateFlow<List<ChatInfo>> get() = chatRepository.chats

    val savedMessagesChatId: String? get() = chatRepository.savedMessagesChatId

    val typingUsersByChat: StateFlow<Map<String, List<TypingUser>>> get() = chatRepository.typingUsers
    
    private var currentUsername: String = ""
    private var currentUserId: String = ""
    /** Cancels superseded loads when switching chats quickly. VoiceRoom stays on stack — VM survives. */
    private var hubLoadJob: Job? = null
    private var openChatId: String? = null
    private var chatScreenSessionId = 0L

    private fun shouldSkipChatReload(chatId: String): Boolean {
        val normalized = chatId.trim()
        if (normalized.isBlank()) return false
        if (!openChatId.equals(normalized, ignoreCase = true)) return false
        if (_uiState.value.messages.isEmpty()) return false
        val activeHub = chatRepository.activeChatHubChatId?.trim().orEmpty()
        if (!activeHub.equals(normalized, ignoreCase = true)) return false
        if (!chatRepository.chatHubConnected.value) return false
        return true
    }

    fun onChatScreenClosed(chatId: String) {
        val normalized = chatId.trim()
        hubLoadJob?.cancel()
        hubLoadJob = null
        if (normalized.isNotBlank()) {
            stopTyping(normalized)
            if (watchedVoiceChatId.equals(normalized, ignoreCase = true)) {
                voiceChannelPresenceService.unwatchChannel(normalized)
                watchedVoiceChatId = null
            }
        }
        if (openChatId?.equals(normalized, ignoreCase = true) == true) {
            openChatId = null
        }
        val sessionId = chatScreenSessionId
        if (sessionId > 0L) {
            chatRepository.detachChatHub(sessionId)
            chatScreenSessionId = 0L
        }
    }

    private fun refreshE2eContext() {
        val userId = currentUserId.trim()
        val chatId = openChatId?.trim().orEmpty()
        if (userId.isBlank() || chatId.isBlank()) return

        val detail = chatRepository.chatDetailInfo.value
            ?.takeIf { it.chatIdValue.equals(chatId, ignoreCase = true) }
        val participants = chatRepository.chatParticipants.value
        val chatFromList =
            chatRepository.chats.value.find {
                it.chatIdValue.equals(chatId, ignoreCase = true)
            }
        val isSaved =
            detail?.isSavedMessagesValue == true ||
                chatFromList?.isSavedMessagesValue == true ||
                savedMessagesChatId.equals(chatId, ignoreCase = true)
        val isGroup =
            detail?.isGroupValue == true ||
                isServerChannelType(detail?.type) ||
                chatFromList?.isGroupChatValue == true ||
                participants.size > 1
        val peerUserId = detail?.otherUserId?.trim()?.takeIf { it.isNotBlank() }
        val isDirect = !isGroup && !isSaved && !peerUserId.isNullOrBlank()

        val memberIds = linkedSetOf<String>()
        memberIds.add(userId)
        when {
            isSaved -> Unit
            isGroup -> participants.map { it.userIdValue }.filter { it.isNotBlank() }.forEach { memberIds.add(it) }
            isDirect -> memberIds.add(peerUserId!!)
            else -> participants.map { it.userIdValue }.filter { it.isNotBlank() }.forEach { memberIds.add(it) }
        }

        chatRepository.setE2eContext(
            memberUserIds = memberIds.toList(),
            peerUserId = if (isDirect) peerUserId else null,
            strictAllMembers = false,
        )
    }

    private fun messagesBelongToChat(messages: List<Message>, chatId: String): Boolean {
        if (messages.isEmpty()) return true
        val expected = chatId.trim()
        if (expected.isBlank()) return false
        return messages.all { message ->
            val messageChatId = message.chatIdValue.trim()
            messageChatId.isBlank() || messageChatId.equals(expected, ignoreCase = true)
        }
    }

    init {
        // Observe messages from repository (SignalR) — merge off main thread.
        viewModelScope.launch(Dispatchers.Default) {
            chatRepository.messages
                .collect { messages ->
                    val expectedChatId = openChatId?.trim().orEmpty()
                    if (expectedChatId.isBlank()) return@collect
                    if (!messagesBelongToChat(messages, expectedChatId)) return@collect
                    val activeHubChatId = chatRepository.activeChatHubChatId?.trim().orEmpty()
                    if (
                        activeHubChatId.isNotBlank() &&
                            !activeHubChatId.equals(expectedChatId, ignoreCase = true)
                    ) {
                        return@collect
                    }
                    val currentMessages = _uiState.value.messages
                    val mergedMessages = mergeRepositoryMessages(messages, currentMessages)
                    if (currentMessages != mergedMessages) {
                        Log.d("ChatViewModel", "Messages updated: ${mergedMessages.size} messages")
                        val wasLoading = _uiState.value.isLoading
                        withContext(Dispatchers.Main.immediate) {
                            _uiState.value =
                                _uiState.value.copy(
                                    messages = mergedMessages,
                                    isLoading = false,
                                )
                        }
                        chatImagePrefetcher.prefetchRecentMessages(mergedMessages)
                        if (wasLoading) {
                            ChatOpenPerfLog.mark(
                                expectedChatId,
                                "vm_messages_observed",
                                "count=${mergedMessages.size}",
                            )
                            ChatOpenPerfLog.end(
                                expectedChatId,
                                "messages_visible",
                                "count=${mergedMessages.size}",
                            )
                        }
                    }
                }
        }
        
        // Observe connection state
        viewModelScope.launch {
            chatRepository.chatHubConnected
                .collect { isConnected ->
                    // Only update if connection state actually changed
                    if (_uiState.value.isConnected != isConnected) {
                        Log.d("ChatViewModel", "Connection state changed: $isConnected")
                        _uiState.value = _uiState.value.copy(isConnected = isConnected)
                    }
                }
        }

        viewModelScope.launch {
            chatRepository.hasMoreOlder.collect { hasMore ->
                if (_uiState.value.hasMoreOlder != hasMore) {
                    _uiState.value = _uiState.value.copy(hasMoreOlder = hasMore)
                }
            }
        }

        viewModelScope.launch {
            chatRepository.isLoadingOlder.collect { loading ->
                if (_uiState.value.isLoadingOlder != loading) {
                    _uiState.value = _uiState.value.copy(isLoadingOlder = loading)
                }
            }
        }

        viewModelScope.launch {
            chatRepository.initialMessagesPageLoaded.collect { loadedVersion ->
                if (loadedVersion <= 0L || openChatId.isNullOrBlank()) return@collect
                openChatId?.let { chatId ->
                    ChatOpenPerfLog.mark(chatId, "initial_page_meta", "version=$loadedVersion")
                }
                if (_uiState.value.isLoading) {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
            }
        }

        viewModelScope.launch {
            chatRepository.pinnedMessages.collect { pinned ->
                if (_uiState.value.pinnedMessages != pinned) {
                    val nextIndex =
                        if (pinned.isEmpty()) {
                            0
                        } else {
                            _uiState.value.pinnedBarIndex.coerceIn(0, pinned.lastIndex)
                        }
                    _uiState.value =
                        _uiState.value.copy(
                            pinnedMessages = pinned,
                            pinnedBarIndex = nextIndex,
                        )
                }
            }
        }

        viewModelScope.launch {
            combine(chatRepository.chatDetailInfo, chatRepository.chatParticipants) { detail, participants ->
                detail to participants
            }.collect {
                refreshE2eContext()
            }
        }
    }

    fun loadOlderMessages(chatId: String) {
        chatRepository.loadOlderMessages(chatId)
    }
    
    fun onComposerTextChanged(chatId: String, text: String) {
        if (chatId.isBlank()) return
        if (typingChatId != null && typingChatId != chatId) {
            stopTyping(typingChatId!!)
        }
        typingChatId = chatId
        typingNotifyJob?.cancel()
        if (text.isBlank()) {
            stopTyping(chatId)
            return
        }
        if (!lastTypingSent) {
            chatRepository.notifyTyping(chatId, currentUsername)
            lastTypingSent = true
            startTypingHeartbeat(chatId)
        }
        typingNotifyJob =
            viewModelScope.launch {
                kotlinx.coroutines.delay(TYPING_IDLE_MS)
                stopTyping(chatId)
            }
    }

    private fun startTypingHeartbeat(chatId: String) {
        typingHeartbeatJob?.cancel()
        typingHeartbeatJob =
            viewModelScope.launch {
                while (lastTypingSent && typingChatId == chatId) {
                    kotlinx.coroutines.delay(TYPING_HEARTBEAT_MS)
                    if (lastTypingSent && typingChatId == chatId) {
                        chatRepository.notifyTyping(chatId, currentUsername)
                    }
                }
            }
    }

    fun stopTyping(chatId: String) {
        typingHeartbeatJob?.cancel()
        typingHeartbeatJob = null
        typingNotifyJob?.cancel()
        typingNotifyJob = null
        if (lastTypingSent && chatId.isNotBlank()) {
            chatRepository.notifyStopTyping(chatId)
            lastTypingSent = false
        }
        if (typingChatId == chatId) {
            typingChatId = null
        }
    }

    fun loadMessages(chatId: String, username: String, userId: String = "") {
        currentUsername = username
        currentUserId = userId
        typingChatId?.let { prev ->
            if (prev != chatId) stopTyping(prev)
        }
        if (shouldSkipChatReload(chatId)) {
            watchVoicePresence(chatId)
            chatRepository.requestPinnedMessages(chatId)
            return
        }
        Log.d("ChatViewModel", "loadMessages called for chatId: $chatId, username: $username")
        openChatId?.let { prev ->
            if (prev != chatId) ChatOpenPerfLog.cancel(prev, "switched_to_other_chat")
        }
        openChatId = chatId
        hubLoadJob?.cancel()
        watchVoicePresence(chatId)
        val sessionId = chatRepository.beginChatScreenSession()
        chatScreenSessionId = sessionId
        val hubAlreadyWarm = chatRepository.chatHubConnected.value
        ChatOpenPerfLog.begin(chatId)
        ChatOpenPerfLog.mark(chatId, "vm_enter", "hubWarm=$hubAlreadyWarm")
        _uiState.value =
            _uiState.value.copy(
                messages = emptyList(),
                pinnedMessages = emptyList(),
                selectedMessageIds = emptySet(),
                selectionMode = false,
                replyToMessage = null,
                editingMessage = null,
                isLoadingOlder = false,
                hasMoreOlder = false,
                isLoading = true,
                error = null,
            )
        hubLoadJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                chatNotificationManager.cancelNotificationsForChat(chatId)
                ChatOpenPerfLog.mark(chatId, "notifications_cancelled")
                chatRepository.prepareChatScreenMessages(chatId)
                val cachedMessages = chatRepository.messages.value
                ChatOpenPerfLog.mark(
                    chatId,
                    "cache_applied",
                    "cachedCount=${cachedMessages.size}",
                )
                _uiState.value =
                    _uiState.value.copy(
                        messages = cachedMessages,
                        isConnected = hubAlreadyWarm || chatRepository.chatHubConnected.value,
                        isLoading = cachedMessages.isEmpty(),
                        error = null,
                    )
                chatImagePrefetcher.prefetchRecentMessages(cachedMessages)
                ChatOpenPerfLog.mark(
                    chatId,
                    "ui_cache_painted",
                    "isLoading=${cachedMessages.isEmpty()}",
                )
                if (userId.isNotBlank() && !chatRepository.isConnected.value) {
                    launch {
                        ChatOpenPerfLog.mark(chatId, "connectSignalR_start")
                        chatRepository.connectSignalR(userId)
                        ChatOpenPerfLog.mark(chatId, "connectSignalR_done")
                    }
                }
                ChatOpenPerfLog.mark(chatId, "connectChatHub_start")
                chatRepository.connectChatHub(chatId, sessionId)
                    .onSuccess {
                        Log.d("ChatViewModel", "SignalR connected for chat")
                        ChatOpenPerfLog.mark(chatId, "connectChatHub_ok")
                        _uiState.value =
                            _uiState.value.copy(
                                isConnected = true,
                            )
                        launch {
                            try {
                                kotlinx.coroutines.delay(350)
                                chatRepository.markChatAsRead(chatId)
                            } catch (e: Exception) {
                                Log.w("ChatViewModel", "markChatAsRead failed", e)
                            }
                        }
                        launch {
                            kotlinx.coroutines.delay(8_000)
                            if (
                                openChatId.equals(chatId, ignoreCase = true) &&
                                _uiState.value.isLoading
                            ) {
                                _uiState.value = _uiState.value.copy(isLoading = false)
                            }
                        }
                    }
                    .onFailure { exception ->
                        if (exception is kotlinx.coroutines.CancellationException) {
                            ChatOpenPerfLog.cancel(chatId, "stale_chat_session")
                            return@onFailure
                        }
                        Log.e("ChatViewModel", "SignalR connection failed", exception)
                        ChatOpenPerfLog.end(
                            chatId,
                            "hub_connect_failed",
                            exception.message.orEmpty(),
                        )
                        chatRepository.loadOfflineCachedMessages(chatId)
                        _uiState.value =
                            _uiState.value.copy(
                                messages = chatRepository.messages.value,
                                isConnected = false,
                                isLoading = false,
                                error = exception.message ?: "Failed to connect to chat",
                            )
                    }
            } catch (e: CancellationException) {
                ChatOpenPerfLog.cancel(chatId, "job_cancelled")
                throw e
            } catch (e: Exception) {
                Log.e("ChatViewModel", "loadMessages failed", e)
                ChatOpenPerfLog.end(chatId, "load_failed", e.message.orEmpty())
                _uiState.value =
                    _uiState.value.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load messages",
                    )
            }
        }
    }
    
    fun sendMessage(chatId: String, content: String) {
        stopTyping(chatId)
        val trimmed = content.trim()
        if (trimmed.isEmpty()) return

        Log.d("ChatViewModel", "sendMessage called for chatId: $chatId, content: $trimmed")
        val hasSamePendingMessage =
            _uiState.value.messages.any { message ->
                isOptimisticMessage(message) &&
                    message.chatIdValue.equals(chatId, ignoreCase = true) &&
                    message.contentValue.trim() == trimmed &&
                    isRecentMessage(message.createdAtValue, windowMs = 4_000L)
            }
        if (hasSamePendingMessage) {
            Log.d("ChatViewModel", "sendMessage skipped: duplicate optimistic pending")
            return
        }
        val replyToMessage = _uiState.value.replyToMessage
        val replyToMessageId = replyToMessage?.messageIdValue?.takeIf { it.isNotBlank() }
        val tempMessageId = "${TEMP_MESSAGE_PREFIX}${System.currentTimeMillis()}"
        val senderVisuals = resolveOptimisticSenderVisuals()
        val optimisticMessage =
            Message(
                messageId = tempMessageId,
                chatId = chatId,
                senderId = senderVisuals.senderId,
                senderUsername = currentUsername,
                content = trimmed,
                createdAt = utcNowIso(),
                updatedAt = null,
                isEdited = false,
                avatarUrl = senderVisuals.avatarUrl,
                avatarColor = senderVisuals.avatarColor,
                avatarDecoration = senderVisuals.avatarDecoration,
                repliedMessage = replyToMessage?.let {
                    RepliedMessage(
                        messageId = it.messageIdValue,
                        senderUsername = it.senderUsernameValue,
                        content = it.contentValue,
                    )
                },
                forwardedMessage = null,
                mediaFiles = emptyList(),
                status = MessageStatus.SENDING,
            )

        _uiState.value =
            _uiState.value.copy(
                messages = _uiState.value.messages + optimisticMessage,
                replyToMessage = null,
            )

        viewModelScope.launch {
            val result =
                withContext(Dispatchers.IO) {
                    chatRepository.sendMessage(
                        chatId = chatId,
                        content = trimmed,
                        username = currentUsername,
                        repliedToMessageId = replyToMessageId,
                    )
                }
            result
                .onSuccess {
                    Log.d("ChatViewModel", "Message sent successfully via SignalR")
                    _uiState.value =
                        _uiState.value.copy(
                            messages =
                                _uiState.value.messages.filter {
                                    it.messageIdValue != tempMessageId
                                },
                        )
                }
                .onFailure { exception ->
                    Log.e("ChatViewModel", "Failed to send message", exception)
                    val errorMessage =
                        when (exception) {
                            is E2eEncryptionException -> exception.message
                            else -> exception.message ?: "Failed to send message"
                        }
                    _uiState.value =
                        _uiState.value.copy(
                            messages =
                                _uiState.value.messages.map { message ->
                                    if (message.messageIdValue == tempMessageId) {
                                        message.copy(
                                            status = MessageStatus.FAILED,
                                            statusAlt = null,
                                        )
                                    } else {
                                        message
                                    }
                                },
                            error = errorMessage,
                        )
                }
        }
    }

    fun sendSticker(chatId: String, stickerId: String) {
        stopTyping(chatId)
        val replyToMessageId = _uiState.value.replyToMessage?.messageIdValue?.takeIf { it.isNotBlank() }
        viewModelScope.launch {
            stickerRepository.sendSticker(chatId, stickerId, replyToMessageId)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(replyToMessage = null)
                }
                .onFailure { exception ->
                    Log.e("ChatViewModel", "Failed to send sticker", exception)
                    _uiState.value =
                        _uiState.value.copy(
                            error = exception.message ?: "Не удалось отправить стикер",
                        )
                }
        }
    }

    fun setReplyMessage(message: Message) {
        _uiState.value =
            _uiState.value.copy(
                replyToMessage = message,
                editingMessage = null,
                forwardMessage = null,
            )
    }

    fun clearReplyMessage() {
        _uiState.value = _uiState.value.copy(replyToMessage = null)
    }

    fun setEditingMessage(message: Message) {
        _uiState.value =
            _uiState.value.copy(
                editingMessage = message,
                replyToMessage = null,
                forwardMessage = null,
            )
    }

    fun clearEditingMessage() {
        _uiState.value = _uiState.value.copy(editingMessage = null)
    }

    fun startForwardMessage(message: Message) {
        _uiState.value =
            _uiState.value.copy(
                forwardMessage = message,
                forwardMessages = listOf(message),
                replyToMessage = null,
                editingMessage = null,
            )
    }

    fun startForwardSelectedMessages() {
        val selected = selectedMessages()
        if (selected.isEmpty()) return
        _uiState.value =
            _uiState.value.copy(
                forwardMessage = selected.first(),
                forwardMessages = selected,
                selectionMode = false,
                selectedMessageIds = emptySet(),
                replyToMessage = null,
                editingMessage = null,
            )
    }

    fun cancelForwardMessage() {
        _uiState.value =
            _uiState.value.copy(
                forwardMessage = null,
                forwardMessages = emptyList(),
            )
    }

    fun ensureForwardTargets(userId: String) {
        if (userId.isBlank()) return
        forwardTargetsJob?.cancel()
        forwardTargetsJob =
            viewModelScope.launch(Dispatchers.IO) {
                _forwardTargetsLoading.value = true
                try {
                    if (chatRepository.chats.value.isEmpty()) {
                        chatRepository.getUserChats()
                    }
                    _forwardChannels.value = loadForwardChannelTargets(userId)
                } finally {
                    _forwardTargetsLoading.value = false
                }
            }
    }

    private suspend fun loadForwardChannelTargets(userId: String): List<ForwardChannelTarget> {
        val servers = serverRepository.awaitServers(userId)
        if (servers.isEmpty()) return emptyList()

        return coroutineScope {
            servers
                .map { server ->
                    async {
                        val serverId = server.serverIdValue.trim()
                        if (serverId.isBlank()) return@async emptyList()
                        val detail =
                            serverDetailRepository.getServer(serverId).getOrNull()
                                ?: return@async emptyList()
                        val serverName = resolveForwardServerName(server, detail)
                        detail.categoriesValue
                            .sortedBy { it.categoryOrderValue }
                            .flatMap { category ->
                                val categoryName =
                                    category.categoryNameValue?.trim().orEmpty().ifBlank { "Каналы" }
                                category.chatsValue
                                    .filter { it.isTextChannel }
                                    .sortedBy { it.chatOrderValue }
                                    .mapNotNull { channel ->
                                        val chatId = channel.chatIdValue.trim()
                                        if (chatId.isBlank()) {
                                            null
                                        } else {
                                            ForwardChannelTarget(
                                                chatId = chatId,
                                                channelName = channel.nameValue,
                                                serverId = serverId,
                                                serverName = serverName,
                                                serverIconUrl = server.iconUrlValue,
                                                categoryName = categoryName,
                                                categoryOrder = category.categoryOrderValue,
                                                channelOrder = channel.chatOrderValue,
                                            )
                                        }
                                    }
                            }
                    }
                }
                .awaitAll()
                .flatten()
                .sortedWith(
                    compareBy(
                        { it.serverName.lowercase() },
                        { it.categoryOrder },
                        { it.channelOrder },
                        { it.channelName.lowercase() },
                    ),
                )
        }
    }

    private fun resolveForwardServerName(server: Server, detail: ServerDetail): String {
        val fromList = server.nameValue.trim()
        val fromDetail = detail.nameValue.trim()
        return when {
            fromDetail.isNotBlank() &&
                !fromDetail.equals("Unknown Server", ignoreCase = true) -> fromDetail
            fromList.isNotBlank() &&
                !fromList.equals("Unknown Server", ignoreCase = true) -> fromList
            else -> fromList.ifBlank { fromDetail }.ifBlank { "Сервер" }
        }
    }

    fun forwardMessagesToTargets(
        targetChatIds: List<String>,
        comment: String,
        activeChatId: String?,
        onResult: (Result<Int>) -> Unit,
    ) {
        val ids = targetChatIds.map { it.trim() }.filter { it.isNotBlank() }.distinct()
        if (ids.isEmpty()) {
            onResult(Result.failure(IllegalArgumentException("Выберите хотя бы один чат")))
            return
        }
        val sources =
            _uiState.value.forwardMessages.ifEmpty {
                _uiState.value.forwardMessage?.let { listOf(it) }.orEmpty()
            }
        if (sources.isEmpty()) {
            onResult(Result.failure(IllegalStateException("Нет сообщения для пересылки")))
            return
        }
        val user = currentUsername.trim()
        if (user.isBlank()) {
            onResult(Result.failure(IllegalStateException("Пользователь не загружен")))
            return
        }
        viewModelScope.launch {
            var successCount = 0
            var lastError: Throwable? = null
            withContext(Dispatchers.IO) {
                for (targetChatId in ids) {
                    for (source in sources) {
                        val messageId = source.messageIdValue.trim()
                        if (messageId.isBlank() || messageId.startsWith("temp_")) continue
                        val result =
                            chatRepository.forwardMessage(
                                sourceMessageId = messageId,
                                targetChatId = targetChatId,
                                comment = comment.trim(),
                                username = user,
                                activeChatId = activeChatId?.trim()?.takeIf { it.isNotBlank() },
                            )
                        if (result.isSuccess) {
                            successCount++
                        } else {
                            lastError = result.exceptionOrNull()
                        }
                    }
                }
            }
            when {
                successCount > 0 -> {
                    _uiState.value =
                        _uiState.value.copy(
                            forwardMessage = null,
                            forwardMessages = emptyList(),
                        )
                    onResult(Result.success(successCount))
                }
                lastError != null -> onResult(Result.failure(lastError!!))
                else -> onResult(Result.failure(IllegalStateException("Не удалось переслать сообщение")))
            }
        }
    }

    fun forwardMessage(
        targetChatId: String,
        comment: String,
        activeChatId: String?,
        onResult: (Result<Unit>) -> Unit,
    ) {
        val source = _uiState.value.forwardMessage
        if (source == null) {
            onResult(Result.failure(IllegalStateException("Нет сообщения для пересылки")))
            return
        }
        val id = source.messageIdValue.trim()
        if (id.isBlank() || id.startsWith("temp_")) {
            onResult(Result.failure(IllegalArgumentException("Нельзя переслать это сообщение")))
            return
        }
        val user = currentUsername.trim()
        if (user.isBlank()) {
            onResult(Result.failure(IllegalStateException("Пользователь не загружен")))
            return
        }
        viewModelScope.launch {
            val result =
                withContext(Dispatchers.IO) {
                    chatRepository.forwardMessage(
                        sourceMessageId = id,
                        targetChatId = targetChatId.trim(),
                        comment = comment.trim(),
                        username = user,
                        activeChatId = activeChatId?.trim()?.takeIf { it.isNotBlank() },
                    )
                }
            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(forwardMessage = null)
            }
            onResult(result)
        }
    }

    fun editMessage(message: Message, newContent: String, onResult: (Result<Unit>) -> Unit) {
        val id = message.messageIdValue.trim()
        if (id.isBlank() || id.startsWith("temp_")) {
            onResult(Result.failure(IllegalArgumentException("Нельзя изменить это сообщение")))
            return
        }
        val trimmed = newContent.trim()
        if (trimmed.isEmpty()) {
            onResult(Result.failure(IllegalArgumentException("Введите текст")))
            return
        }
        val user = currentUsername.trim()
        if (user.isBlank()) {
            onResult(Result.failure(IllegalStateException("Пользователь не загружен")))
            return
        }
        viewModelScope.launch {
            val result =
                withContext(Dispatchers.IO) {
                    chatRepository.editMessageViaHub(id, trimmed, user)
                }
            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(editingMessage = null)
            }
            onResult(result)
        }
    }

    fun refreshChatDetail(chatId: String) {
        if (chatId.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            chatRepository.beginChatDetailRefresh(chatId)
            chatRepository.fetchChatInfoRest(chatId)
            chatRepository.refreshChatDetailFromHub(chatId)
            chatRepository.loadChatMediaFiles(chatId)
            chatRepository.loadChatLinks(chatId)
        }
    }

    fun refreshChatDetailLight(chatId: String) {
        if (chatId.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            chatRepository.beginChatDetailRefresh(chatId)
            chatRepository.fetchChatInfoRest(chatId)
            chatRepository.refreshChatDetailFromHub(chatId)
        }
    }

    fun refreshSavedChatMedia(chatId: String) {
        if (chatId.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            chatRepository.beginChatDetailRefresh(chatId)
            chatRepository.loadChatMediaFiles(chatId)
            chatRepository.loadChatLinks(chatId)
        }
    }

    fun saveMediaToGallery(context: Context, item: MediaViewerItem) {
        viewModelScope.launch(Dispatchers.IO) {
            val result =
                mediaDownloadHelper.saveMedia(
                    context = context,
                    filePath = item.filePath,
                    contentType = item.contentType,
                    displayName = item.fileName,
                    target = MediaSaveTarget.GALLERY,
                )
            withContext(Dispatchers.Main) {
                mediaDownloadHelper.showResultToast(context, result, MediaSaveTarget.GALLERY)
            }
        }
    }

    fun downloadMediaFile(context: Context, mediaFile: MediaFile) {
        viewModelScope.launch(Dispatchers.IO) {
            val result =
                mediaDownloadHelper.saveMedia(
                    context = context,
                    filePath = mediaFile.filePathValue,
                    contentType = mediaFile.contentTypeValue,
                    displayName = mediaFile.displayNameValue,
                    target = MediaSaveTarget.DOWNLOADS,
                )
            withContext(Dispatchers.Main) {
                mediaDownloadHelper.showResultToast(context, result, MediaSaveTarget.DOWNLOADS)
            }
        }
    }

    fun downloadViewerItem(context: Context, item: MediaViewerItem) {
        viewModelScope.launch(Dispatchers.IO) {
            val target =
                if (item.contentType.startsWith("image/") || item.contentType.startsWith("video/")) {
                    MediaSaveTarget.GALLERY
                } else {
                    MediaSaveTarget.DOWNLOADS
                }
            val result =
                mediaDownloadHelper.saveMedia(
                    context = context,
                    filePath = item.filePath,
                    contentType = item.contentType,
                    displayName = item.fileName,
                    target = target,
                )
            withContext(Dispatchers.Main) {
                mediaDownloadHelper.showResultToast(context, result, target)
            }
        }
    }

    fun uploadChatAvatar(chatId: String, uri: Uri, context: Context) {
        viewModelScope.launch(Dispatchers.IO) {
            chatRepository.uploadChatAvatar(chatId, uri, context).onFailure { e ->
                Log.w("ChatViewModel", "uploadChatAvatar failed", e)
                _uiState.value = _uiState.value.copy(
                    error = e.message ?: "Не удалось загрузить аватар"
                )
            }
        }
    }

    fun deleteChatViaHub(chatId: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                chatRepository.deleteChatViaHub(chatId)
            }
            onResult(result)
        }
    }

    fun requestGroupAvailableUsers(chatId: String) {
        chatRepository.requestGroupAvailableUsers(chatId)
    }

    fun addUserToGroup(chatId: String, targetUserId: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                chatRepository.addUserToGroup(chatId, targetUserId)
            }
            if (result.isSuccess) {
                refreshChatDetail(chatId)
            }
            onResult(result)
        }
    }

    fun leaveGroupChat(chatId: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                chatRepository.leaveGroupChat(chatId)
            }
            onResult(result)
        }
    }

    fun deleteGroupChat(chatId: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                chatRepository.deleteGroupChat(chatId)
            }
            onResult(result)
        }
    }

    fun deleteMessage(message: Message, onResult: (Result<Unit>) -> Unit) {
        val id = message.messageIdValue.trim()
        if (id.isBlank()) {
            onResult(Result.failure(IllegalArgumentException("Нет id сообщения")))
            return
        }
        val user = currentUsername.trim()
        if (user.isBlank()) {
            onResult(Result.failure(IllegalStateException("Пользователь не загружен")))
            return
        }
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                chatRepository.deleteMessageViaHub(id, user)
            }
            if (result.isSuccess && _uiState.value.editingMessage?.messageIdValue == id) {
                _uiState.value = _uiState.value.copy(editingMessage = null)
            }
            onResult(result)
        }
    }

    fun notifyOutgoingVoiceCall(chatId: String, chatTitle: String, callerUserId: String) {
        if (chatId.isBlank() || callerUserId.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            chatRepository.notifyOutgoingVoiceCall(chatId, chatTitle, callerUserId)
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun uploadMedia(
        chatId: String,
        fileUri: Uri,
        context: Context,
        caption: String? = null,
        isVideoNote: Boolean = false,
    ) {
        Log.d("ChatViewModel", "uploadMedia called for chatId: $chatId, isVideoNote=$isVideoNote")
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            // Get file info for optimistic update
            val mimeType = context.contentResolver.getType(fileUri) ?: "application/octet-stream"
            var fileName = "file"
            context.contentResolver.query(fileUri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (cursor.moveToFirst() && nameIndex >= 0) {
                    fileName = cursor.getString(nameIndex) ?: "file"
                }
            }
            
            // Create temporary message ID for optimistic update
            val tempMessageId = "temp_${System.currentTimeMillis()}"
            val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date())
            
            // Create temporary media file
            val tempMediaFile = MediaFile(
                id = null,
                fileName = fileName,
                filePath = fileUri.toString(), // Temporary URI
                contentType = mimeType,
                fileSize = null,
                thumbnailPath = if (mimeType.startsWith("image/")) fileUri.toString() else null,
                isVideoNote = isVideoNote,
            )
            
            // Create optimistic message
            val senderVisuals = resolveOptimisticSenderVisuals()
            val optimisticMessage = Message(
                messageId = tempMessageId,
                chatId = chatId,
                senderId = senderVisuals.senderId,
                senderUsername = currentUsername,
                content = caption ?: "",
                createdAt = now,
                updatedAt = null,
                isEdited = false,
                avatarUrl = senderVisuals.avatarUrl,
                avatarColor = senderVisuals.avatarColor,
                avatarDecoration = senderVisuals.avatarDecoration,
                repliedMessage = null,
                forwardedMessage = null,
                mediaFiles = listOf(tempMediaFile)
            )
            
            // Add optimistic message immediately
            val currentMessages = _uiState.value.messages.toMutableList()
            currentMessages.add(optimisticMessage)
            _uiState.value = _uiState.value.copy(messages = currentMessages)
            
            // Upload media
            chatRepository.uploadMedia(
                chatId,
                fileUri,
                context,
                currentUsername,
                caption,
                isVideoNote = isVideoNote,
            )
                .onSuccess { result ->
                    Log.d("ChatViewModel", "Media uploaded successfully, messageId: ${result.messageId}")
                    // Remove optimistic message - real one will come via SignalR
                    val updatedMessages = _uiState.value.messages.filter { 
                        it.messageIdValue != tempMessageId 
                    }
                    _uiState.value = _uiState.value.copy(
                        messages = updatedMessages,
                        isLoading = false
                    )
                    // Real message will be received through SignalR event
                }
                .onFailure { exception ->
                    Log.e("ChatViewModel", "Failed to upload media", exception)
                    // Remove optimistic message on failure
                    val updatedMessages = _uiState.value.messages.filter { 
                        it.messageIdValue != tempMessageId 
                    }
                    _uiState.value = _uiState.value.copy(
                        messages = updatedMessages,
                        isLoading = false,
                        error = exception.message ?: "Failed to upload media"
                    )
                }
        }
    }

    fun uploadMediaBatch(
        chatId: String,
        fileUris: List<Uri>,
        context: Context,
        caption: String? = null,
    ) {
        if (fileUris.isEmpty()) return
        if (fileUris.size == 1) {
            uploadMedia(chatId, fileUris.first(), context, caption = caption, isVideoNote = false)
            return
        }
        Log.d("ChatViewModel", "uploadMediaBatch called for chatId: $chatId, count=${fileUris.size}")
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            val tempMessageId = "temp_batch_${System.currentTimeMillis()}"
            val now =
                SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.format(Date())

            val tempMediaFiles =
                fileUris.map { uri ->
                    val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"
                    var fileName = "file"
                    context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                        val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                        if (cursor.moveToFirst() && nameIndex >= 0) {
                            fileName = cursor.getString(nameIndex) ?: fileName
                        }
                    }
                    MediaFile(
                        id = null,
                        fileName = fileName,
                        filePath = uri.toString(),
                        contentType = mimeType,
                        fileSize = null,
                        thumbnailPath = if (mimeType.startsWith("image/")) uri.toString() else null,
                        isVideoNote = false,
                    )
                }

            val senderVisuals = resolveOptimisticSenderVisuals()
            val optimisticMessage =
                Message(
                    messageId = tempMessageId,
                    chatId = chatId,
                    senderId = senderVisuals.senderId,
                    senderUsername = currentUsername,
                    content = caption.orEmpty(),
                    createdAt = now,
                    updatedAt = null,
                    isEdited = false,
                    avatarUrl = senderVisuals.avatarUrl,
                    avatarColor = senderVisuals.avatarColor,
                    avatarDecoration = senderVisuals.avatarDecoration,
                    repliedMessage = null,
                    forwardedMessage = null,
                    mediaFiles = tempMediaFiles,
                )

            val currentMessages = _uiState.value.messages.toMutableList()
            currentMessages.add(optimisticMessage)
            _uiState.value = _uiState.value.copy(messages = currentMessages)

            chatRepository.uploadMediaBatch(
                chatId = chatId,
                fileUris = fileUris,
                context = context,
                username = currentUsername,
                caption = caption,
            )
                .onSuccess { result ->
                    Log.d("ChatViewModel", "Media batch uploaded successfully, messageId: ${result.messageId}")
                    val updatedMessages =
                        _uiState.value.messages.filter {
                            it.messageIdValue != tempMessageId
                        }
                    _uiState.value =
                        _uiState.value.copy(
                            messages = updatedMessages,
                            isLoading = false,
                        )
                }
                .onFailure { exception ->
                    Log.e("ChatViewModel", "Failed to upload media batch", exception)
                    val updatedMessages =
                        _uiState.value.messages.filter {
                            it.messageIdValue != tempMessageId
                        }
                    _uiState.value =
                        _uiState.value.copy(
                            messages = updatedMessages,
                            isLoading = false,
                            error = exception.message ?: "Failed to upload media batch",
                        )
                }
        }
    }
    
    fun uploadVoiceMessage(chatId: String, audioFile: File, context: Context) {
        Log.d("ChatViewModel", "uploadVoiceMessage called for chatId: $chatId")
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            // Convert File to Uri
            val fileUri = Uri.fromFile(audioFile)
            
            // Create temporary message ID for optimistic update
            val tempMessageId = "temp_${System.currentTimeMillis()}"
            val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date())
            
            // Create temporary media file
            val tempMediaFile = MediaFile(
                id = null,
                fileName = audioFile.name,
                filePath = fileUri.toString(), // Temporary URI
                contentType = "audio/mp4", // M4A files use audio/mp4
                fileSize = audioFile.length(),
                thumbnailPath = null
            )
            
            // Create optimistic message
            val senderVisuals = resolveOptimisticSenderVisuals()
            val optimisticMessage = Message(
                messageId = tempMessageId,
                chatId = chatId,
                senderId = senderVisuals.senderId,
                senderUsername = currentUsername,
                content = "",
                createdAt = now,
                updatedAt = null,
                isEdited = false,
                avatarUrl = senderVisuals.avatarUrl,
                avatarColor = senderVisuals.avatarColor,
                avatarDecoration = senderVisuals.avatarDecoration,
                repliedMessage = null,
                forwardedMessage = null,
                mediaFiles = listOf(tempMediaFile)
            )
            
            // Add optimistic message immediately
            val currentMessages = _uiState.value.messages.toMutableList()
            currentMessages.add(optimisticMessage)
            _uiState.value = _uiState.value.copy(messages = currentMessages)
            
            // Upload media
            chatRepository.uploadMedia(chatId, fileUri, context, currentUsername, null)
                .onSuccess { result ->
                    Log.d("ChatViewModel", "Voice message uploaded successfully, messageId: ${result.messageId}")
                    // Remove optimistic message - real one will come via SignalR
                    val updatedMessages = _uiState.value.messages.filter { 
                        it.messageIdValue != tempMessageId 
                    }
                    _uiState.value = _uiState.value.copy(
                        messages = updatedMessages,
                        isLoading = false
                    )
                    // Real message will be received through SignalR event
                }
                .onFailure { exception ->
                    Log.e("ChatViewModel", "Failed to upload voice message", exception)
                    // Remove optimistic message on failure
                    val updatedMessages = _uiState.value.messages.filter { 
                        it.messageIdValue != tempMessageId 
                    }
                    _uiState.value = _uiState.value.copy(
                        messages = updatedMessages,
                        isLoading = false,
                        error = exception.message ?: "Failed to upload voice message"
                    )
                }
        }
    }
    
    fun watchVoicePresence(chatId: String) {
        if (chatId.isBlank()) return
        if (watchedVoiceChatId == chatId) return
        watchedVoiceChatId?.let { voiceChannelPresenceService.unwatchChannel(it) }
        watchedVoiceChatId = chatId
        voiceChannelPresenceService.watchChannel(chatId)
    }

    fun unwatchVoicePresence(chatId: String) {
        if (watchedVoiceChatId != chatId) return
        voiceChannelPresenceService.unwatchChannel(chatId)
        watchedVoiceChatId = null
    }

    fun setShowCreatePoll(show: Boolean) {
        _uiState.value = _uiState.value.copy(showCreatePoll = show)
    }

    fun createPoll(
        chatId: String,
        question: String,
        options: List<String>,
        allowMultiple: Boolean,
        isAnonymous: Boolean,
        onResult: (Result<Unit>) -> Unit = {},
    ) {
        viewModelScope.launch {
            val result =
                chatRepository.createPoll(
                    chatId = chatId,
                    question = question,
                    options = options,
                    allowMultiple = allowMultiple,
                    isAnonymous = isAnonymous,
                )
            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(showCreatePoll = false)
            }
            onResult(result)
        }
    }

    fun votePoll(messageId: String, optionIds: List<String>) {
        if (messageId.isBlank()) return
        viewModelScope.launch {
            chatRepository.votePoll(messageId, optionIds)
        }
    }

    fun pinMessage(messageId: String, onResult: (Result<Unit>) -> Unit = {}) {
        viewModelScope.launch {
            onResult(chatRepository.pinMessage(messageId))
        }
    }

    fun unpinMessage(messageId: String, onResult: (Result<Unit>) -> Unit = {}) {
        viewModelScope.launch {
            onResult(chatRepository.unpinMessage(messageId))
        }
    }

    fun saveMessageToFavorites(messageId: String, onResult: (Result<Unit>) -> Unit = {}) {
        viewModelScope.launch {
            onResult(chatRepository.saveMessageToFavorites(messageId, currentUsername))
        }
    }

    fun enterSelectionMode(messageId: String) {
        if (messageId.isBlank() || messageId.startsWith(TEMP_MESSAGE_PREFIX)) return
        _uiState.value =
            _uiState.value.copy(
                selectionMode = true,
                selectedMessageIds = setOf(messageId),
            )
    }

    fun toggleMessageSelection(messageId: String) {
        if (messageId.isBlank() || messageId.startsWith(TEMP_MESSAGE_PREFIX)) return
        val current = _uiState.value.selectedMessageIds.toMutableSet()
        if (current.contains(messageId)) current.remove(messageId) else current.add(messageId)
        _uiState.value =
            _uiState.value.copy(
                selectionMode = current.isNotEmpty(),
                selectedMessageIds = current,
            )
    }

    fun clearSelectionMode() {
        _uiState.value =
            _uiState.value.copy(
                selectionMode = false,
                selectedMessageIds = emptySet(),
            )
    }

    fun selectedMessages(): List<Message> {
        val ids = _uiState.value.selectedMessageIds
        return _uiState.value.messages.filter { it.messageIdValue in ids }
    }

    fun canDeleteMessage(message: Message, username: String): Boolean {
        if (message.messageIdValue.isBlank() || message.messageIdValue.startsWith(TEMP_MESSAGE_PREFIX)) {
            return false
        }
        return message.senderUsernameValue == username
    }

    fun deleteSelectedMessages(onResult: (Result<Int>) -> Unit) {
        val selected = selectedMessages().filter { canDeleteMessage(it, currentUsername) }
        if (selected.isEmpty()) {
            onResult(Result.failure(IllegalArgumentException("Нет сообщений для удаления")))
            return
        }
        viewModelScope.launch {
            var deleted = 0
            var lastError: Throwable? = null
            withContext(Dispatchers.IO) {
                for (message in selected) {
                    val id = message.messageIdValue.trim()
                    if (id.isBlank()) continue
                    val result = chatRepository.deleteMessageViaHub(id, currentUsername)
                    if (result.isSuccess) {
                        deleted++
                    } else {
                        lastError = result.exceptionOrNull()
                    }
                }
            }
            clearSelectionMode()
            if (_uiState.value.editingMessage?.messageIdValue in selected.map { it.messageIdValue }.toSet()) {
                _uiState.value = _uiState.value.copy(editingMessage = null)
            }
            when {
                deleted > 0 -> onResult(Result.success(deleted))
                lastError != null -> onResult(Result.failure(lastError!!))
                else -> onResult(Result.failure(IllegalStateException("Не удалось удалить сообщения")))
            }
        }
    }

    fun cyclePinnedBar() {
        val pinned = _uiState.value.pinnedMessages
        if (pinned.isEmpty()) return
        val next = (_uiState.value.pinnedBarIndex + 1) % pinned.size
        _uiState.value = _uiState.value.copy(pinnedBarIndex = next)
    }

    fun setPinnedBarIndex(index: Int) {
        _uiState.value = _uiState.value.copy(pinnedBarIndex = index.coerceAtLeast(0))
    }

    fun currentPinnedMessage(): Message? {
        val pinned = _uiState.value.pinnedMessages
        if (pinned.isEmpty()) return null
        val index = _uiState.value.pinnedBarIndex.coerceIn(0, pinned.lastIndex)
        return pinned.getOrNull(index)
    }

    override fun onCleared() {
        forwardTargetsJob?.cancel()
        forwardTargetsJob = null
        val closingChatId = openChatId?.trim().orEmpty()
        if (closingChatId.isNotBlank()) {
            onChatScreenClosed(closingChatId)
        } else {
            hubLoadJob?.cancel()
            hubLoadJob = null
        }
        watchedVoiceChatId?.let { voiceChannelPresenceService.unwatchChannel(it) }
        watchedVoiceChatId = null
        super.onCleared()
    }

    private fun isServerChannelType(type: String?): Boolean {
        val normalized = type?.trim().orEmpty()
        if (normalized.isBlank()) return false
        return normalized.equals("TextChannel", ignoreCase = true) ||
            normalized.equals("VoiceChannel", ignoreCase = true) ||
            normalized.equals("IdeasBoard", ignoreCase = true) ||
            normalized.equals("News", ignoreCase = true) ||
            normalized.equals("NewsChannel", ignoreCase = true)
    }
}
