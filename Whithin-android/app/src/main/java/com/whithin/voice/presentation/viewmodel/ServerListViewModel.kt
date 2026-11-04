package com.whithin.voice.presentation.viewmodel

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.api.ServerApi
import com.whithin.voice.data.model.Server
import com.whithin.voice.data.repository.ServerRepository
import com.whithin.voice.data.repository.ServerSettingsRepository
import com.whithin.voice.util.ListLoadPerfLog
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class ServerListUiState(
    val servers: List<Server> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val isConnected: Boolean = false,
)

data class PublicServersUiState(
    val servers: List<Server> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val joiningServerId: String? = null,
)

data class CreateServerUiState(
    val isSubmitting: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ServerListViewModel @Inject constructor(
    private val serverRepository: ServerRepository,
    private val serverApi: ServerApi,
    private val serverSettingsRepository: ServerSettingsRepository,
    @ApplicationContext private val appContext: Context,
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(
        ServerListUiState(
            servers = serverRepository.servers.value,
            isLoading = serverRepository.servers.value.isEmpty(),
            isConnected = serverRepository.isConnected.value,
        ),
    )
    val uiState: StateFlow<ServerListUiState> = _uiState.asStateFlow()

    private val _publicServersState = MutableStateFlow(PublicServersUiState())
    val publicServersState: StateFlow<PublicServersUiState> = _publicServersState.asStateFlow()

    private val _createServerState = MutableStateFlow(CreateServerUiState())
    val createServerState: StateFlow<CreateServerUiState> = _createServerState.asStateFlow()
    private var listUiPaintLogged = false
    
    init {
        Log.d("ServerListViewModel", "ViewModel initialized")
        
        // Observe SignalR connection state
        viewModelScope.launch {
            serverRepository.isConnected.collect { isConnected ->
                Log.d("ServerListViewModel", "Connection state changed: $isConnected")
                _uiState.value = _uiState.value.copy(isConnected = isConnected)
            }
        }
        
        // Observe servers from repository
        viewModelScope.launch {
            serverRepository.servers.collect { servers ->
                Log.d("ServerListViewModel", "Servers updated: ${servers.size} servers")
                if (servers.isNotEmpty() && !listUiPaintLogged) {
                    listUiPaintLogged = true
                    ListLoadPerfLog.mark(
                        ListLoadPerfLog.SERVERS,
                        "vm_ui_paint",
                        "count=${servers.size}",
                    )
                }
                _uiState.value = _uiState.value.copy(
                    servers = servers,
                    isLoading = if (servers.isNotEmpty()) false else _uiState.value.isLoading,
                )
            }
        }
    }
    
    fun loadServers(userId: String) {
        Log.d("ServerListViewModel", "loadServers called for userId: $userId")
        ListLoadPerfLog.begin(ListLoadPerfLog.SERVERS)
        val cachedServers = serverRepository.servers.value
        val hubWarm = serverRepository.isHubSessionWarm(userId)
        ListLoadPerfLog.mark(
            ListLoadPerfLog.SERVERS,
            "vm_load_enter",
            "cached=${cachedServers.size} hubWarm=$hubWarm",
        )
        if (cachedServers.isNotEmpty()) {
            _uiState.value = _uiState.value.copy(
                servers = cachedServers,
                isLoading = false,
                isConnected = serverRepository.isConnected.value,
                error = null,
            )
        }
        if (hubWarm) {
            Log.d("ServerListViewModel", "Hub session already warm, skipping reconnect")
            if (cachedServers.isEmpty()) {
                viewModelScope.launch(Dispatchers.IO) {
                    serverRepository.fetchUserServers(force = false)
                }
            }
            return
        }
        viewModelScope.launch {
            if (cachedServers.isEmpty()) {
                _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            }
            connectSignalR(userId)
        }
    }
    
    private var isConnecting = false
    
    private fun connectSignalR(userId: String) {
        if (isConnecting) {
            Log.d("ServerListViewModel", "Connection already in progress, skipping")
            return
        }
        viewModelScope.launch {
            isConnecting = true
            try {
                serverRepository.connectSignalR(userId)
                    .onSuccess {
                        Log.d("ServerListViewModel", "SignalR connected successfully")
                        if (serverRepository.servers.value.isEmpty()) {
                            _uiState.value = _uiState.value.copy(isConnected = true)
                        } else {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                isConnected = true,
                            )
                        }
                    }
                    .onFailure { exception ->
                        Log.e("ServerListViewModel", "SignalR connection failed", exception)
                        val hasLocalList = serverRepository.servers.value.isNotEmpty()
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = if (hasLocalList) null
                            else exception.message ?: "Failed to connect to server",
                            isConnected = false,
                        )
                    }
            } finally {
                isConnecting = false
            }
        }
    }
    
    fun refreshServers() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            serverRepository.refreshServers()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun loadPublicServers() {
        viewModelScope.launch {
            _publicServersState.value =
                _publicServersState.value.copy(isLoading = true, error = null)
            val result =
                withContext(Dispatchers.IO) {
                    runCatching {
                        val response = serverApi.getPublicServers()
                        if (!response.isSuccessful) {
                            throw Exception(parseApiError(response.errorBody()?.string()))
                        }
                        response.body().orEmpty()
                    }
                }
            result
                .onSuccess { servers ->
                    _publicServersState.value =
                        _publicServersState.value.copy(
                            servers = servers,
                            isLoading = false,
                        )
                }
                .onFailure { error ->
                    _publicServersState.value =
                        _publicServersState.value.copy(
                            isLoading = false,
                            error = error.message ?: "Не удалось загрузить серверы",
                        )
                }
        }
    }

    fun joinPublicServer(
        serverId: String,
        onResult: (Result<Server?>) -> Unit,
    ) {
        val trimmedId = serverId.trim()
        if (trimmedId.isBlank()) {
            onResult(Result.failure(IllegalArgumentException("Некорректный сервер")))
            return
        }
        viewModelScope.launch {
            _publicServersState.value =
                _publicServersState.value.copy(joiningServerId = trimmedId, error = null)
            val result =
                withContext(Dispatchers.IO) {
                    runCatching {
                        val response = serverApi.joinServer(trimmedId)
                        if (!response.isSuccessful) {
                            throw Exception(parseApiError(response.errorBody()?.string()))
                        }
                        _publicServersState.value.servers
                            .firstOrNull { it.serverIdValue.equals(trimmedId, ignoreCase = true) }
                    }
                }
            _publicServersState.value =
                _publicServersState.value.copy(joiningServerId = null)
            if (result.isSuccess) {
                serverRepository.refreshServers()
            }
            onResult(result)
        }
    }

    fun clearPublicServersError() {
        _publicServersState.value = _publicServersState.value.copy(error = null)
    }

    fun clearCreateServerError() {
        _createServerState.value = _createServerState.value.copy(error = null)
    }

    fun createServer(
        serverName: String,
        isPublic: Boolean,
        description: String?,
        avatarUri: Uri? = null,
        onResult: (Result<Server?>) -> Unit,
    ) {
        viewModelScope.launch {
            _createServerState.value = CreateServerUiState(isSubmitting = true, error = null)
            val result =
                withContext(Dispatchers.IO) {
                    val createResult = serverRepository.createServer(serverName, isPublic, description)
                    if (createResult.isFailure) {
                        return@withContext Result.failure(
                            createResult.exceptionOrNull() ?: Exception("Не удалось создать сервер"),
                        )
                    }
                    val server = createResult.getOrThrow()
                    if (avatarUri != null) {
                        uploadAvatarForServer(server.serverIdValue, avatarUri)
                            .onFailure { uploadError ->
                                Log.w(
                                    "ServerListViewModel",
                                    "Server created but avatar upload failed",
                                    uploadError,
                                )
                            }
                    }
                    Result.success(server)
                }
            _createServerState.value =
                CreateServerUiState(
                    isSubmitting = false,
                    error = result.exceptionOrNull()?.message,
                )
            if (result.isSuccess) {
                serverRepository.refreshServers()
            }
            onResult(result)
        }
    }

    private suspend fun uploadAvatarForServer(serverId: String, uri: Uri): Result<Unit> {
        val bytesResult = readBytesFromUri(uri, "avatar.jpg")
        if (bytesResult.isFailure) {
            return Result.failure(bytesResult.exceptionOrNull() ?: Exception("Не удалось прочитать файл"))
        }
        val (bytes, mime, name) = bytesResult.getOrThrow()
        return serverSettingsRepository.uploadAvatar(serverId, bytes, mime, name)
    }

    private suspend fun readBytesFromUri(
        uri: Uri,
        defaultName: String,
    ): Result<Triple<ByteArray, String, String>> {
        return runCatching {
            val resolver = appContext.contentResolver
            val mime = resolver.getType(uri) ?: "image/jpeg"
            val name =
                resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                    ?.use { cursor ->
                        if (cursor.moveToFirst()) {
                            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                            if (index >= 0) cursor.getString(index) else null
                        } else {
                            null
                        }
                    } ?: defaultName
            val bytes =
                resolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: throw IllegalStateException("Не удалось открыть файл")
            Triple(bytes, mime, name)
        }
    }

    private fun parseApiError(body: String?): String {
        if (body.isNullOrBlank()) return "Ошибка сервера"
        val match = Regex("\"error\"\\s*:\\s*\"([^\"]+)\"").find(body)
        return match?.groupValues?.getOrNull(1) ?: body
    }

    override fun onCleared() {
        super.onCleared()
        serverRepository.disconnectSignalR()
    }
}
