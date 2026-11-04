package com.whithin.voice.presentation.viewmodel

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.PresenceStatus
import com.whithin.voice.data.local.ColdStartBootstrap
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.repository.LoginResult
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.data.repository.FriendRepository
import com.whithin.voice.data.repository.PresenceRepository
import com.whithin.voice.data.repository.ProfileRepository
import com.whithin.voice.data.repository.PushTokenRepository
import com.whithin.voice.data.repository.ServerRepository
import com.whithin.voice.presentation.ui.components.TextScrambleRegistry
import com.whithin.voice.data.local.UserTokenData
import com.whithin.voice.domain.model.User
import com.whithin.voice.util.UserDisplayNames
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class AuthUiState(
    /** True until the first local session / token check completes (avoids flashing Login). */
    val isSessionCheckPending: Boolean = true,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isAuthenticated: Boolean = false,
    val user: User? = null,
    val currentStatus: String = PresenceStatus.ONLINE.wireValue,
    /** Загрузка аватара / баннера в настройках профиля */
    val profileVisualLoading: Boolean = false,
    val profileSuccessHint: String? = null,
    val profileErrorHint: String? = null,
    val registrationCompletedEmail: String? = null,
    val loginPendingConfirmationEmail: String? = null,
    val accountActionLoading: Boolean = false,
    val accountActionMessage: String? = null,
    val accountActionError: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val tokenManager: TokenManager,
    private val coldStartBootstrap: ColdStartBootstrap,
    private val authRepository: AuthRepository,
    private val profileRepository: ProfileRepository,
    private val pushTokenRepository: PushTokenRepository,
    private val presenceRepository: PresenceRepository,
    private val chatRepository: ChatRepository,
    private val friendRepository: FriendRepository,
    private val serverRepository: ServerRepository,
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(buildInitialAuthState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private fun buildInitialAuthState(): AuthUiState {
        if (!tokenManager.peekHasValidSession()) return AuthUiState()
        val tokenUser = tokenManager.peekUserFromToken()?.takeIf { it.id.isNotBlank() } ?: return AuthUiState()
        return AuthUiState(
            isSessionCheckPending = false,
            isAuthenticated = true,
            user = userFromToken(tokenUser),
        )
    }

    private fun userFromToken(tokenUser: UserTokenData): User {
        val cached = authRepository.peekCachedUserVisuals(tokenUser.id)
        return User(
            id = tokenUser.id,
            username = tokenUser.username,
            email = tokenUser.email,
            displayName = cached?.displayName,
            avatarUrl = cached?.avatarUrl,
            avatarColor = cached?.avatarColor,
            bannerUrl = cached?.bannerUrl,
            nameplate = cached?.nameplate,
            avatarDecoration = cached?.avatarDecoration,
        )
    }
    
    init {
        viewModelScope.launch {
            presenceRepository.currentStatus.collect { status ->
                _uiState.update { it.copy(currentStatus = status) }
            }
        }

        viewModelScope.launch {
            presenceRepository.statusChangedEvents.collect { event ->
                val currentUserId = _uiState.value.user?.id ?: return@collect
                if (event.userIdValue == currentUserId) {
                    presenceRepository.setCurrentStatus(event.statusValue)
                }
            }
        }

        viewModelScope.launch {
            hydrateSessionFast()
        }
    }

    fun hasCachedSession(): Boolean {
        return tokenManager.peekHasValidSession() &&
            tokenManager.peekUserFromToken()?.id?.isNotBlank() == true
    }

    fun peekCachedUserId(): String? = tokenManager.peekUserFromToken()?.id?.takeIf { it.isNotBlank() }
    
    fun checkAuthStatus() {
        viewModelScope.launch {
            if (_uiState.value.isSessionCheckPending) {
                hydrateSessionFast()
            } else {
                refreshSessionInBackground()
            }
        }
    }

    private suspend fun hydrateSessionFast() {
        coldStartBootstrap.awaitEssentials()

        if (_uiState.value.isAuthenticated && !_uiState.value.isSessionCheckPending) {
            refreshSessionInBackground()
            return
        }

        if (!tokenManager.peekHasValidSession()) {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isAuthenticated = false,
                    user = null,
                    isSessionCheckPending = false,
                )
            }
            return
        }

        val tokenUser = tokenManager.peekUserFromToken()
        if (tokenUser == null || tokenUser.id.isBlank()) {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isAuthenticated = false,
                    user = null,
                    isSessionCheckPending = false,
                )
            }
            return
        }

        _uiState.update {
            it.copy(
                isLoading = false,
                isAuthenticated = true,
                isSessionCheckPending = false,
                user = userFromToken(tokenUser),
            )
        }
        refreshSessionInBackground()
    }

    private fun refreshSessionInBackground() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val user = authRepository.refreshCurrentUserFromNetwork()
                if (user != null) {
                    authRepository.cacheUserVisuals(user)
                    _uiState.update { it.copy(user = user) }
                    connectPresence(user.id)
                    syncPushTokenIfNeeded()
                } else if (!authRepository.isAuthenticated()) {
                    _uiState.update {
                        it.copy(
                            isAuthenticated = false,
                            user = null,
                        )
                    }
                }
            } catch (e: Exception) {
                Log.w("AuthViewModel", "Background session refresh failed", e)
            }
        }
    }

    fun refreshProfileVisuals() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val user = authRepository.refreshCurrentUserFromNetwork()
                if (user != null) {
                    _uiState.update { it.copy(user = user) }
                }
            } catch (e: Exception) {
                Log.w("AuthViewModel", "Profile visuals refresh failed", e)
            }
        }
    }

    fun syncPushTokenIfNeeded() {
        viewModelScope.launch {
            var result = pushTokenRepository.syncPendingIfNeeded()
            if (result.isFailure) {
                delay(2_000)
                result = pushTokenRepository.syncPendingIfNeeded()
            }
            if (result.isFailure) {
                Log.w(
                    TAG,
                    "Push token sync failed after retry",
                    result.exceptionOrNull()
                )
            }
        }
    }
    
    fun login(username: String, password: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    error = null,
                    loginPendingConfirmationEmail = null,
                )
            }

            when (val result = authRepository.login(username, password)) {
                is LoginResult.Success -> {
                    syncPushTokenIfNeeded()
                    connectPresence(result.user.id)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            user = result.user,
                            error = null,
                            loginPendingConfirmationEmail = null,
                        )
                    }
                }
                is LoginResult.EmailNotConfirmed -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = false,
                            error = result.message,
                            loginPendingConfirmationEmail = result.email ?: username,
                        )
                    }
                }
                is LoginResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = false,
                            error = result.message,
                            loginPendingConfirmationEmail = null,
                        )
                    }
                }
            }
        }
    }

    fun register(username: String, password: String, email: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    error = null,
                    registrationCompletedEmail = null,
                )
            }

            authRepository.register(username, password, email)
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = null,
                            registrationCompletedEmail = result.email,
                        )
                    }
                }
                .onFailure { exception ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = exception.message ?: "Ошибка регистрации",
                        )
                    }
                }
        }
    }

    fun resendConfirmation(email: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.resendConfirmation(email)
                .onSuccess { message -> onResult(true, message) }
                .onFailure { exception ->
                    onResult(false, exception.message ?: "Не удалось отправить письмо")
                }
        }
    }

    fun forgotPassword(email: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            authRepository.forgotPassword(email)
                .onSuccess { message ->
                    _uiState.update { it.copy(isLoading = false) }
                    onResult(true, message)
                }
                .onFailure { exception ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = exception.message ?: "Не удалось отправить письмо",
                        )
                    }
                    onResult(false, exception.message ?: "Не удалось отправить письмо")
                }
        }
    }

    fun clearRegistrationCompleted() {
        _uiState.update { it.copy(registrationCompletedEmail = null) }
    }

    fun clearLoginPendingConfirmation() {
        _uiState.update { it.copy(loginPendingConfirmationEmail = null, error = null) }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    accountActionLoading = true,
                    accountActionMessage = null,
                    accountActionError = null,
                )
            }
            authRepository.changePassword(currentPassword, newPassword)
                .onSuccess { message ->
                    _uiState.update {
                        it.copy(accountActionLoading = false, accountActionMessage = message)
                    }
                }
                .onFailure { exception ->
                    _uiState.update {
                        it.copy(
                            accountActionLoading = false,
                            accountActionError = exception.message ?: "Не удалось сменить пароль",
                        )
                    }
                }
        }
    }

    fun changeEmail(newEmail: String, currentPassword: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    accountActionLoading = true,
                    accountActionMessage = null,
                    accountActionError = null,
                )
            }
            authRepository.changeEmail(newEmail, currentPassword)
                .onSuccess { message ->
                    _uiState.update {
                        it.copy(accountActionLoading = false, accountActionMessage = message)
                    }
                }
                .onFailure { exception ->
                    _uiState.update {
                        it.copy(
                            accountActionLoading = false,
                            accountActionError = exception.message ?: "Не удалось сменить email",
                        )
                    }
                }
        }
    }

    fun updateDisplayName(displayName: String) {
        val userId = _uiState.value.user?.id?.takeIf { it.isNotBlank() } ?: return
        val normalized = displayName.trim().takeIf { it.isNotEmpty() }
        if ((normalized?.length ?: 0) > UserDisplayNames.MAX_LENGTH) {
            _uiState.update {
                it.copy(accountActionError = "Ник не может быть длиннее ${UserDisplayNames.MAX_LENGTH} символов")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    accountActionLoading = true,
                    accountActionMessage = null,
                    accountActionError = null,
                )
            }
            profileRepository.updateDisplayName(userId, normalized)
                .onSuccess { response ->
                    val current = _uiState.value.user ?: return@onSuccess
                    val updated = current.copy(
                        username = response.username?.takeIf { it.isNotBlank() } ?: current.username,
                        displayName = response.displayName?.takeIf { it.isNotBlank() },
                    )
                    authRepository.cacheUserVisuals(updated)
                    _uiState.update {
                        it.copy(
                            user = updated,
                            accountActionLoading = false,
                            accountActionMessage = "Ник обновлён",
                        )
                    }
                }
                .onFailure { exception ->
                    _uiState.update {
                        it.copy(
                            accountActionLoading = false,
                            accountActionError = exception.message ?: "Не удалось обновить ник",
                        )
                    }
                }
        }
    }

    fun consumeAccountActionHints() {
        _uiState.update { it.copy(accountActionMessage = null, accountActionError = null) }
    }

    fun confirmEmail(userId: String, token: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.confirmEmail(userId, token)
                .onSuccess { message -> onResult(true, message) }
                .onFailure { exception ->
                    onResult(false, exception.message ?: "Не удалось подтвердить email")
                }
        }
    }

    fun confirmEmailChange(
        userId: String,
        newEmail: String,
        token: String,
        onResult: (Boolean, String) -> Unit,
    ) {
        viewModelScope.launch {
            authRepository.confirmEmailChange(userId, newEmail, token)
                .onSuccess { message -> onResult(true, message) }
                .onFailure { exception ->
                    onResult(false, exception.message ?: "Не удалось подтвердить смену email")
                }
        }
    }

    fun confirmPasswordChange(userId: String, token: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.confirmPasswordChange(userId, token)
                .onSuccess { message -> onResult(true, message) }
                .onFailure { exception ->
                    onResult(false, exception.message ?: "Не удалось подтвердить смену пароля")
                }
        }
    }
    
    fun logout() {
        viewModelScope.launch {
            TextScrambleRegistry.clear()
            _uiState.update { it.copy(isLoading = true) }
            pushTokenRepository.removeCurrentDeviceToken()
            presenceRepository.disconnect()
            chatRepository.onUserSessionEnded()
            friendRepository.onUserSessionEnded()
            serverRepository.onUserSessionEnded()

            authRepository.logout()
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = false,
                            user = null,
                            error = null
                        )
                    }
                }
                .onFailure { exception ->
                    // Even if logout fails, clear local state
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = false,
                            user = null,
                            error = exception.message
                        )
                    }
                }
        }
    }
    
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun consumeProfileHints() {
        _uiState.update { it.copy(profileSuccessHint = null, profileErrorHint = null) }
    }

    /**
     * Выбор изображения из галереи (Photo Picker): загрузка на сервер и обновление профиля.
     */
    fun uploadAvatarFromUri(uri: Uri) {
        val userId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    profileVisualLoading = true,
                    profileSuccessHint = null,
                    profileErrorHint = null
                )
            }
            runCatching {
                withContext(Dispatchers.IO) {
                    readPickedImage(uri, maxBytes = 5 * 1024 * 1024)
                }
            }.onSuccess { (bytes, mime, name) ->
                profileRepository.uploadAndSaveAvatar(userId, bytes, mime, name)
                    .onSuccess {
                        refreshUserAfterProfileChange()
                        _uiState.update {
                            it.copy(profileSuccessHint = "Аватар обновлён")
                        }
                    }
                    .onFailure { e ->
                        _uiState.update {
                            it.copy(profileErrorHint = e.message ?: "Не удалось обновить аватар")
                        }
                    }
            }.onFailure { e ->
                _uiState.update {
                    it.copy(profileErrorHint = e.message ?: "Не удалось прочитать файл")
                }
            }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    fun uploadBannerFromUri(uri: Uri) {
        val userId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    profileVisualLoading = true,
                    profileSuccessHint = null,
                    profileErrorHint = null
                )
            }
            runCatching {
                withContext(Dispatchers.IO) {
                    readPickedImage(uri, maxBytes = 10 * 1024 * 1024)
                }
            }.onSuccess { (bytes, mime, name) ->
                profileRepository.uploadAndSaveBanner(userId, bytes, mime, name)
                    .onSuccess {
                        refreshUserAfterProfileChange()
                        _uiState.update {
                            it.copy(profileSuccessHint = "Баннер обновлён")
                        }
                    }
                    .onFailure { e ->
                        _uiState.update {
                            it.copy(profileErrorHint = e.message ?: "Не удалось обновить баннер")
                        }
                    }
            }.onFailure { e ->
                _uiState.update {
                    it.copy(profileErrorHint = e.message ?: "Не удалось прочитать файл")
                }
            }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    fun updateAvatarColor(color: String) {
        val userId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(profileVisualLoading = true, profileSuccessHint = null, profileErrorHint = null)
            }
            profileRepository.updateAvatarColor(userId, color)
                .onSuccess {
                    refreshUserAfterProfileChange()
                    _uiState.update { it.copy(profileSuccessHint = "Цвет акцента обновлён") }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(profileErrorHint = e.message ?: "Не удалось обновить цвет")
                    }
                }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    fun updateBannerColor(color: String) {
        val userId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(profileVisualLoading = true, profileSuccessHint = null, profileErrorHint = null)
            }
            profileRepository.updateBannerColor(userId, color)
                .onSuccess {
                    refreshUserAfterProfileChange()
                    _uiState.update { it.copy(profileSuccessHint = "Баннер обновлён") }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(profileErrorHint = e.message ?: "Не удалось обновить баннер")
                    }
                }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    fun removeAvatar() {
        val userId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(profileVisualLoading = true, profileSuccessHint = null, profileErrorHint = null)
            }
            profileRepository.removeAvatar(userId)
                .onSuccess {
                    refreshUserAfterProfileChange()
                    _uiState.update { it.copy(profileSuccessHint = "Аватар удалён") }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(profileErrorHint = e.message ?: "Не удалось удалить аватар")
                    }
                }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    fun removeBanner() {
        val userId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(profileVisualLoading = true, profileSuccessHint = null, profileErrorHint = null)
            }
            profileRepository.removeBanner(userId)
                .onSuccess {
                    refreshUserAfterProfileChange()
                    _uiState.update { it.copy(profileSuccessHint = "Баннер удалён") }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(profileErrorHint = e.message ?: "Не удалось удалить баннер")
                    }
                }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    fun applyAvatarDecoration(decorationPath: String) {
        val userId = _uiState.value.user?.id ?: return
        val normalized = decorationPath.trim()
        if (normalized.isEmpty()) return
        viewModelScope.launch {
            _uiState.update {
                it.copy(profileVisualLoading = true, profileSuccessHint = null, profileErrorHint = null)
            }
            profileRepository.updateAvatarDecoration(userId, normalized)
                .onSuccess {
                    refreshUserAfterProfileChange()
                    _uiState.update { it.copy(profileSuccessHint = "Рамка аватара обновлена") }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(profileErrorHint = e.message ?: "Не удалось обновить рамку аватара")
                    }
                }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    fun removeAvatarDecoration() {
        val userId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(profileVisualLoading = true, profileSuccessHint = null, profileErrorHint = null)
            }
            profileRepository.removeAvatarDecoration(userId)
                .onSuccess {
                    refreshUserAfterProfileChange()
                    _uiState.update { it.copy(profileSuccessHint = "Рамка аватара удалена") }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(profileErrorHint = e.message ?: "Не удалось удалить рамку аватара")
                    }
                }
            _uiState.update { it.copy(profileVisualLoading = false) }
        }
    }

    private suspend fun refreshUserAfterProfileChange() {
        val user = authRepository.getCurrentUser()
        if (user != null) {
            _uiState.update { it.copy(user = user) }
        }
    }

    private fun readPickedImage(uri: Uri, maxBytes: Int): Triple<ByteArray, String, String> {
        val cr = appContext.contentResolver
        val mime = cr.getType(uri)?.takeIf { it.startsWith("image/") }
            ?: throw IllegalArgumentException("Нужно изображение (JPEG, PNG, WebP или GIF)")
        var displayName: String? = null
        cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) displayName = c.getString(idx)
            }
        }
        val ext = extensionForMime(mime)
        val fileName = displayName?.trim()?.takeIf { it.isNotEmpty() }
            ?: ("profile" + ext)
        val bytes = cr.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalArgumentException("Не удалось открыть файл")
        if (bytes.isEmpty()) throw IllegalArgumentException("Пустой файл")
        if (bytes.size > maxBytes) {
            val mb = maxBytes / (1024 * 1024)
            throw IllegalArgumentException("Файл слишком большой (максимум ${mb} МБ)")
        }
        return Triple(bytes, mime, fileName)
    }

    private fun extensionForMime(mime: String): String = when (mime.lowercase()) {
        "image/png" -> ".png"
        "image/webp" -> ".webp"
        "image/gif" -> ".gif"
        else -> ".jpg"
    }

    fun updateStatus(status: PresenceStatus) {
        val currentUserId = _uiState.value.user?.id ?: return
        viewModelScope.launch {
            presenceRepository.updateStatus(currentUserId, status.wireValue)
                .onFailure { exception ->
                    _uiState.update { it.copy(error = exception.message ?: "Не удалось изменить статус") }
                }
        }
    }

    fun approveWebLogin(sessionId: String, onCompleted: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.approveWebLogin(sessionId)
                .onSuccess {
                    onCompleted(true, "Вход в веб-клиент подтвержден")
                }
                .onFailure { exception ->
                    onCompleted(false, exception.message ?: "Не удалось подтвердить вход в веб-клиент")
                }
        }
    }

    private fun connectPresence(userId: String) {
        viewModelScope.launch {
            presenceRepository.connect(userId)
                .onFailure {
                    // Keep app usable even if presence websocket failed.
                }
        }
    }

    companion object {
        private const val TAG = "AuthViewModel"
    }
}
