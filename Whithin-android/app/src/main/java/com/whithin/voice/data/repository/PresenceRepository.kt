package com.whithin.voice.data.repository

import com.whithin.voice.data.api.UserApi
import com.whithin.voice.data.model.UpdateUserStatusRequest
import com.whithin.voice.data.model.UserStatusChangedEvent
import com.whithin.voice.data.signalr.NotificationHub
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PresenceRepository @Inject constructor(
    private val userApi: UserApi,
    private val notificationHub: NotificationHub
) {
    private val _currentStatus = MutableStateFlow("online")
    val currentStatus: StateFlow<String> = _currentStatus.asStateFlow()

    val statusChangedEvents: SharedFlow<UserStatusChangedEvent> = notificationHub.statusChangedEvents
    val isConnected: StateFlow<Boolean> = notificationHub.isConnected

    fun isHubSessionWarm(userId: String): Boolean = notificationHub.isSessionFor(userId)

    suspend fun connect(userId: String): Result<Unit> {
        return notificationHub.connect(userId)
    }

    fun disconnect() {
        notificationHub.disconnect()
    }

    suspend fun updateStatus(userId: String, status: String): Result<Unit> {
        return try {
            val response = userApi.updateStatus(userId, UpdateUserStatusRequest(status))
            if (response.isSuccessful) {
                _currentStatus.value = response.body()?.status ?: status
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to update status"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun setCurrentStatus(status: String) {
        _currentStatus.value = status
    }
}
