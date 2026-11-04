package com.whithin.voice.presentation.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.ChatInfo
import com.whithin.voice.data.model.splitChatListSections
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.domain.model.User
import com.whithin.voice.util.ListLoadPerfLog
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class ChatListUiState(
    val chats: List<ChatInfo> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val isConnected: Boolean = false,
    val searchResults: List<com.whithin.voice.data.model.UserSearchInfo> = emptyList(),
    val isSearching: Boolean = false,
    val unreadCountByChat: Map<String, Int> = emptyMap()
)

data class ChatListShellState(
    val selectedServerId: String? = null,
    val highlightedChannelId: String? = null,
)

@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val chatRepository: ChatRepository
) : ViewModel() {
    
    private val _uiState = kotlinx.coroutines.flow.MutableStateFlow(
        ChatListUiState(
            chats = chatRepository.chats.value,
            isLoading = chatRepository.chats.value.isEmpty(),
            isConnected = chatRepository.isConnected.value,
        ),
    )
    val uiState: StateFlow<ChatListUiState> = _uiState.asStateFlow()

    private val _shellState = kotlinx.coroutines.flow.MutableStateFlow(ChatListShellState())
    val shellState: StateFlow<ChatListShellState> = _shellState.asStateFlow()

    fun updateShellState(selectedServerId: String?, highlightedChannelId: String?) {
        _shellState.value = ChatListShellState(selectedServerId, highlightedChannelId)
    }

    companion object {
        @Volatile
        var pendingPushShell: ChatListShellState? = null

        fun stagePushShell(serverId: String?) {
            val normalizedServerId = serverId?.trim()?.takeIf { it.isNotEmpty() } ?: return
            pendingPushShell = ChatListShellState(normalizedServerId, highlightedChannelId = null)
        }
    }

    fun applyPendingPushShellIfAny() {
        pendingPushShell?.let { pending ->
            _shellState.value = pending
            pendingPushShell = null
            Log.d("ChatListViewModel", "Applied push shell server=${pending.selectedServerId}")
        }
    }

    private var listUiPaintLogged = false

    init {
        pendingPushShell?.let { pending ->
            _shellState.value = pending
            pendingPushShell = null
            Log.d("ChatListViewModel", "Restored push shell server=${pending.selectedServerId}")
        }
        Log.d("ChatListViewModel", "ViewModel initialized")
        
        // Observe SignalR connection state
        viewModelScope.launch {
            chatRepository.isConnected.collect { isConnected ->
                Log.d("ChatListViewModel", "Connection state changed: $isConnected")
                _uiState.value = _uiState.value.copy(isConnected = isConnected)
            }
        }
        
        // Observe chats from repository — map unread off main.
        viewModelScope.launch(Dispatchers.Default) {
            chatRepository.chats.collect { chats ->
                val updatedUnread = chats.associate { it.chatIdValue to it.unreadCountValue }
                if (chats.isNotEmpty() && !listUiPaintLogged) {
                    listUiPaintLogged = true
                    ListLoadPerfLog.mark(
                        ListLoadPerfLog.CHATS,
                        "vm_ui_paint",
                        "count=${chats.size}",
                    )
                }
                withContext(Dispatchers.Main.immediate) {
                    _uiState.value = _uiState.value.copy(
                        chats = chats,
                        unreadCountByChat = updatedUnread,
                        isLoading = if (chats.isNotEmpty()) false else _uiState.value.isLoading,
                    )
                }
            }
        }
        
        // Observe search results from repository
        viewModelScope.launch {
            chatRepository.searchResults.collect { results ->
                Log.d("ChatListViewModel", "Search results updated: ${results.size} users")
                _uiState.value = _uiState.value.copy(
                    searchResults = results,
                    isSearching = results.isNotEmpty()
                )
            }
        }
    }
    
    fun loadChats(userId: String) {
        Log.d("ChatListViewModel", "loadChats called for userId: $userId")
        ListLoadPerfLog.begin(ListLoadPerfLog.CHATS)
        val cachedChats = chatRepository.chats.value
        val hubWarm = chatRepository.isHubSessionWarm(userId)
        ListLoadPerfLog.mark(
            ListLoadPerfLog.CHATS,
            "vm_load_enter",
            "cached=${cachedChats.size} hubWarm=$hubWarm",
        )
        if (cachedChats.isNotEmpty()) {
            _uiState.value = _uiState.value.copy(
                chats = cachedChats,
                isLoading = false,
                isConnected = chatRepository.isConnected.value,
                error = null,
            )
        }
        if (hubWarm) {
            Log.d("ChatListViewModel", "Hub session already warm, skipping reconnect")
            if (cachedChats.isEmpty()) {
                viewModelScope.launch(Dispatchers.IO) {
                    chatRepository.getUserChats(force = false)
                }
            }
            return
        }
        viewModelScope.launch {
            if (cachedChats.isEmpty()) {
                _uiState.value = _uiState.value.copy(isLoading = true, error = null)
                Log.d("ChatListViewModel", "No local chats — waiting for network")
            } else {
                Log.d("ChatListViewModel", "Showing ${cachedChats.size} cached chats, hub connect delegated to repository")
            }

            connectSignalR(userId)
        }
    }
    
    private var isConnecting = false
    
    private fun connectSignalR(userId: String) {
        // Prevent multiple simultaneous connection attempts
        if (isConnecting) {
            Log.d("ChatListViewModel", "Connection already in progress, skipping")
            return
        }
        
        viewModelScope.launch(Dispatchers.IO) {
            isConnecting = true
            try {
                val result = chatRepository.connectSignalR(userId)
                withContext(Dispatchers.Main.immediate) {
                    result
                        .onSuccess {
                            Log.d("ChatListViewModel", "SignalR connected successfully")
                            if (chatRepository.chats.value.isEmpty()) {
                                _uiState.value = _uiState.value.copy(isConnected = true)
                            } else {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isConnected = true,
                                )
                            }
                        }
                        .onFailure { exception ->
                            Log.e("ChatListViewModel", "SignalR connection failed", exception)
                            val hasLocalList = chatRepository.chats.value.isNotEmpty()
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                error = if (hasLocalList) null
                                else exception.message ?: "Failed to connect to server",
                                isConnected = false
                            )
                        }
                }
            } finally {
                isConnecting = false
            }
        }
    }
    
    fun refreshChats() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            chatRepository.getUserChats(force = true)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        chats = it
                    )
                    chatRepository.refreshChats()
                }
                .onFailure { exception ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = exception.message ?: "Failed to refresh chats"
                    )
                }
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun markChatAsRead(chatId: String) {
        if (chatId.isBlank()) return
        viewModelScope.launch {
            chatRepository.markChatAsRead(chatId)
            val updated = _uiState.value.unreadCountByChat.toMutableMap()
            if (updated.containsKey(chatId)) {
                updated[chatId] = 0
                _uiState.value = _uiState.value.copy(unreadCountByChat = updated)
            }
        }
    }
    
    fun searchUsers(query: String) {
        if (query.isBlank()) {
            _uiState.value = _uiState.value.copy(
                searchResults = emptyList(),
                isSearching = false
            )
        } else {
            _uiState.value = _uiState.value.copy(isSearching = true)
            viewModelScope.launch {
                chatRepository.searchUsers(query)
            }
        }
    }
    
    suspend fun createPrivateChat(targetUserId: String): Result<Unit> {
        return chatRepository.createPrivateChat(targetUserId)
    }

    suspend fun createGroupChat(chatName: String, memberIds: List<String>): Result<Unit> {
        return chatRepository.createGroupChat(chatName, memberIds)
    }

    fun setChatPinned(chatId: String, pinned: Boolean) {
        if (chatId.isBlank()) return
        viewModelScope.launch {
            chatRepository.setChatPinned(chatId, pinned)
        }
    }

    fun movePinnedChat(fromIndex: Int, toIndex: Int) {
        if (fromIndex == toIndex) return
        val sections = splitChatListSections(_uiState.value.chats)
        val pinned = sections.pinned.toMutableList()
        if (fromIndex !in pinned.indices || toIndex !in pinned.indices) return
        val moved = pinned.removeAt(fromIndex)
        pinned.add(toIndex, moved)
        viewModelScope.launch {
            chatRepository.reorderPinnedChats(pinned.map { it.chatIdValue })
        }
    }
    
    override fun onCleared() {
        super.onCleared()
        // Don't disconnect SignalR on ViewModel clear - keep connection alive
        // Connection should persist across navigation and screen changes
        // Only disconnect on app exit or explicit logout
        // chatRepository.disconnectSignalR()
    }
}
