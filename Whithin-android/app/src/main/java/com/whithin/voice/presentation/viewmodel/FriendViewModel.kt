package com.whithin.voice.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.FriendInfo
import com.whithin.voice.data.model.FriendRequestInfo
import com.whithin.voice.data.model.UserSearchInfo
import com.whithin.voice.data.repository.FriendRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FriendUiState(
    val friends: List<FriendInfo> = emptyList(),
    val pendingRequests: List<FriendRequestInfo> = emptyList(),
    val sentRequests: List<FriendRequestInfo> = emptyList(),
    val searchResults: List<UserSearchInfo> = emptyList(),
    val isLoading: Boolean = false,
    val isConnected: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class FriendViewModel @Inject constructor(
    private val friendRepository: FriendRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(FriendUiState())
    val uiState: StateFlow<FriendUiState> = _uiState.asStateFlow()

    /** Последний непустой запрос поиска — чтобы обновить список после отправки заявки. */
    private var lastSearchQuery: String = ""

    init {
        viewModelScope.launch {
            friendRepository.isConnected.collect { connected ->
                _uiState.value = _uiState.value.copy(isConnected = connected)
            }
        }

        viewModelScope.launch {
            friendRepository.friends.collect { friends ->
                _uiState.value = _uiState.value.copy(friends = friends)
            }
        }

        viewModelScope.launch {
            friendRepository.pendingRequests.collect { pending ->
                _uiState.value = _uiState.value.copy(pendingRequests = pending)
            }
        }

        viewModelScope.launch {
            friendRepository.sentRequests.collect { sent ->
                _uiState.value = _uiState.value.copy(sentRequests = sent)
            }
        }

        viewModelScope.launch {
            friendRepository.searchResults.collect { results ->
                _uiState.value = _uiState.value.copy(searchResults = results)
            }
        }
    }

    fun load(userId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            friendRepository.connectSignalR(userId)
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(error = e.message ?: "Failed to connect")
                }
            friendRepository.loadFriends()
            friendRepository.loadFriendRequests()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    fun searchUsers(query: String) {
        viewModelScope.launch {
            if (query.isNotBlank()) {
                lastSearchQuery = query.trim()
            }
            friendRepository.searchUsers(query)
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(error = e.message ?: "Failed to search users")
                }
        }
    }

    fun sendFriendRequest(targetUserId: String) {
        viewModelScope.launch {
            friendRepository.sendFriendRequest(targetUserId)
                .onSuccess {
                    if (lastSearchQuery.isNotBlank()) {
                        friendRepository.searchUsers(lastSearchQuery)
                    }
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(error = e.message ?: "Failed to send friend request")
                }
        }
    }

    fun acceptFriendRequest(friendshipId: String) {
        viewModelScope.launch {
            friendRepository.acceptFriendRequest(friendshipId)
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(error = e.message ?: "Failed to accept request")
                }
        }
    }

    fun declineFriendRequest(friendshipId: String) {
        viewModelScope.launch {
            friendRepository.declineFriendRequest(friendshipId)
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(error = e.message ?: "Failed to decline request")
                }
        }
    }

    fun removeFriend(friendId: String) {
        viewModelScope.launch {
            friendRepository.removeFriend(friendId)
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(error = e.message ?: "Failed to remove friend")
                }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
