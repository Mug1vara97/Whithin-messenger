package com.whithin.voice.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class JoinRoomUiState(
    val roomName: String = "",
    val userName: String = "",
    val canJoin: Boolean = false
)

class JoinRoomViewModel : ViewModel() {
    
    private val _uiState = MutableStateFlow(JoinRoomUiState())
    val uiState: StateFlow<JoinRoomUiState> = _uiState.asStateFlow()
    
    fun updateRoomName(roomName: String) {
        _uiState.update { 
            it.copy(
                roomName = roomName,
                canJoin = roomName.isNotBlank() && it.userName.isNotBlank()
            )
        }
    }
    
    fun updateUserName(userName: String) {
        _uiState.update { 
            it.copy(
                userName = userName,
                canJoin = userName.isNotBlank() && it.roomName.isNotBlank()
            )
        }
    }
}
