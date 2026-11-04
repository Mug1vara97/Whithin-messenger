package com.whithin.voice.data.repository

import com.whithin.voice.data.api.FriendApi
import com.whithin.voice.data.model.FriendInfo
import com.whithin.voice.data.model.FriendRequestInfo
import com.whithin.voice.data.model.UserStatusChangedEvent
import com.whithin.voice.data.model.UserSearchInfo
import com.whithin.voice.data.signalr.FriendHub
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FriendRepository @Inject constructor(
    private val friendApi: FriendApi,
    private val friendHub: FriendHub,
    private val presenceRepository: PresenceRepository,
) {
    private val _friends = MutableStateFlow<List<FriendInfo>>(emptyList())
    val friends: StateFlow<List<FriendInfo>> = _friends.asStateFlow()

    private val _pendingRequests = MutableStateFlow<List<FriendRequestInfo>>(emptyList())
    val pendingRequests: StateFlow<List<FriendRequestInfo>> = _pendingRequests.asStateFlow()

    private val _sentRequests = MutableStateFlow<List<FriendRequestInfo>>(emptyList())
    val sentRequests: StateFlow<List<FriendRequestInfo>> = _sentRequests.asStateFlow()

    private val _searchResults = MutableStateFlow<List<UserSearchInfo>>(emptyList())
    val searchResults: StateFlow<List<UserSearchInfo>> = _searchResults.asStateFlow()

    val isConnected: StateFlow<Boolean> = friendHub.isConnected

    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val hubConnectMutex = Mutex()
    @Volatile
    private var hubConnectJob: Deferred<Result<Unit>>? = null
    @Volatile
    private var hubConnectUserId: String? = null
    @Volatile
    private var currentUserId: String? = null

    init {
        ioScope.launch {
            presenceRepository.statusChangedEvents.collect { event ->
                applyStatusUpdate(event)
            }
        }
    }

    fun isHubSessionWarm(userId: String): Boolean {
        val id = userId.trim()
        if (id.isBlank()) return false
        if (friendHub.isConnected.value && currentUserId == id) return true
        return hubConnectJob?.isActive == true && hubConnectUserId == id
    }

    /** FriendHub only — presence is connected separately by [SessionNetworkCoordinator]. */
    suspend fun connectHubOnly(userId: String): Result<Unit> {
        val job =
            hubConnectMutex.withLock {
                hubConnectJob?.takeIf { it.isActive }
                    ?: ioScope.async { connectHubOnlyInternal(userId) }.also {
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

    suspend fun connectSignalR(userId: String): Result<Unit> {
        val result = connectHubOnly(userId)
        if (result.isFailure) {
            return result
        }
        loadFriends()
        loadFriendRequests()
        return Result.success(Unit)
    }

    private suspend fun connectHubOnlyInternal(userId: String): Result<Unit> {
        currentUserId = userId.trim()
        val result = friendHub.connect(userId)
        if (result.isFailure) {
            return result
        }

        friendHub.setOnDataChanged {
            ioScope.launch {
                loadFriends()
                loadFriendRequests()
            }
        }
        return Result.success(Unit)
    }

    private fun applyStatusUpdate(event: UserStatusChangedEvent) {
        val targetUserId = event.userIdValue
        if (targetUserId.isBlank()) return

        _friends.value = _friends.value.map { friend ->
            if (friend.userIdValue == targetUserId) {
                friend.copy(
                    status = event.statusValue,
                    statusAlt = null,
                    lastSeen = event.lastSeenValue,
                    lastSeenAlt = null,
                )
            } else {
                friend
            }
        }
    }

    suspend fun loadFriends(): Result<List<FriendInfo>> {
        return try {
            val response = friendApi.getFriends()
            if (response.isSuccessful && response.body() != null) {
                val data = response.body() ?: emptyList()
                _friends.value = data
                Result.success(data)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to load friends"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun loadFriendRequests(): Result<Unit> {
        return try {
            val response = friendApi.getFriendRequests()
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!
                _pendingRequests.value = data.pendingRequests ?: emptyList()
                _sentRequests.value = data.sentRequests ?: emptyList()
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to load friend requests"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchUsers(query: String): Result<List<UserSearchInfo>> {
        if (query.isBlank()) {
            _searchResults.value = emptyList()
            return Result.success(emptyList())
        }

        return try {
            val response = friendApi.searchUsers(query.trim())
            if (response.isSuccessful && response.body() != null) {
                val data = response.body() ?: emptyList()
                _searchResults.value = data
                Result.success(data)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to search users"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendFriendRequest(targetUserId: String): Result<Unit> {
        val result = friendHub.sendFriendRequest(targetUserId)
        if (result.isSuccess) {
            loadFriendRequests()
        }
        return result
    }

    suspend fun acceptFriendRequest(friendshipId: String): Result<Unit> {
        val result = friendHub.acceptFriendRequest(friendshipId)
        if (result.isSuccess) {
            _pendingRequests.value = _pendingRequests.value.filterNot { it.idValue == friendshipId }
        }
        return result
    }

    suspend fun declineFriendRequest(friendshipId: String): Result<Unit> {
        val result = friendHub.declineFriendRequest(friendshipId)
        if (result.isSuccess) {
            _pendingRequests.value = _pendingRequests.value.filterNot { it.idValue == friendshipId }
        }
        return result
    }

    suspend fun removeFriend(friendId: String): Result<Unit> {
        val result = friendHub.removeFriend(friendId)
        if (result.isSuccess) {
            _friends.value = _friends.value.filterNot { it.userIdValue == friendId }
        }
        return result
    }

    fun onUserSessionEnded() {
        hubConnectJob?.cancel()
        hubConnectJob = null
        hubConnectUserId = null
        currentUserId = null
        friendHub.disconnect()
        _friends.value = emptyList()
        _pendingRequests.value = emptyList()
        _sentRequests.value = emptyList()
        _searchResults.value = emptyList()
    }
}
