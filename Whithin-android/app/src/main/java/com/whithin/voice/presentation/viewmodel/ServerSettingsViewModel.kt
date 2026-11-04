package com.whithin.voice.presentation.viewmodel

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.AuditLogEntry
import com.whithin.voice.data.model.ServerDetail
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.data.repository.ServerSettingsRepository
import com.whithin.voice.domain.permissions.ServerPermissions
import com.whithin.voice.util.UserDisplayNames
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

enum class ServerSettingsTab(val title: String) {
    PROFILE("Профиль"),
    MEMBERS("Участники"),
    ROLES("Роли"),
    AUDIT("Аудит"),
}

data class ServerSettingsUiState(
    val server: ServerDetail? = null,
    val serverName: String = "",
    val bannerColor: String = "#3f3f3f",
    val isDefaultBannerColor: Boolean = true,
    val activeTab: ServerSettingsTab = ServerSettingsTab.PROFILE,
    val members: List<ServerMemberInfo> = emptyList(),
    val roles: List<ServerRoleInfo> = emptyList(),
    val isLoading: Boolean = true,
    val isMembersLoading: Boolean = false,
    val isRolesLoading: Boolean = false,
    val isSavingName: Boolean = false,
    val isBannerLoading: Boolean = false,
    val isAvatarLoading: Boolean = false,
    val isMemberActionLoading: Boolean = false,
    val showAddMemberPicker: Boolean = false,
    val addingMemberIds: Set<String> = emptySet(),
    val newRoleName: String = "",
    val newRoleColor: String = "#5865F2",
    val showCreateRoleForm: Boolean = false,
    val roleEditorVisible: Boolean = false,
    val editingRoleId: String? = null,
    val roleDraftName: String = "",
    val roleDraftColor: String = "#5865F2",
    val roleDraftPermissions: Map<String, Boolean> = emptyMap(),
    val roleSearchQuery: String = "",
    val isRoleSaving: Boolean = false,
    val auditEntries: List<AuditLogEntry> = emptyList(),
    val auditTotalCount: Int = 0,
    val auditPage: Int = 0,
    val isAuditLoading: Boolean = false,
    val auditActionFilter: String = "all",
    val roleMemberTarget: ServerMemberInfo? = null,
    val kickMemberTarget: ServerMemberInfo? = null,
    val nicknameMemberTarget: ServerMemberInfo? = null,
    val nicknameDraft: String = "",
    val isNicknameSaving: Boolean = false,
    val error: String? = null,
    val successHint: String? = null,
)

@HiltViewModel
class ServerSettingsViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val serverSettingsRepository: ServerSettingsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private companion object {
        const val MEMBERS_CACHE_TTL_MS = 20_000L
    }

    private var serverId: String = savedStateHandle.get<String>("serverId").orEmpty().trim()
    private var currentUserId: String = ""
    private var membersLoadedAtMs: Long = 0L

    private val _uiState = MutableStateFlow(ServerSettingsUiState())
    val uiState: StateFlow<ServerSettingsUiState> = _uiState.asStateFlow()

    val activeServerId: String
        get() = serverId

    val isOwner: Boolean
        get() {
            val server = _uiState.value.server ?: return false
            val ownerId = server.ownerIdValue.trim()
            return ownerId.isNotBlank() && ownerId.equals(currentUserId.trim(), ignoreCase = true)
        }

    fun permissions(): Map<String, Boolean> = _uiState.value.server?.permissionsValue ?: emptyMap()

    fun canManageServer(): Boolean = ServerPermissions.canManageServer(permissions(), isOwner)

    fun canManageRoles(): Boolean = ServerPermissions.canManageRoles(permissions(), isOwner)

    fun canKickMembers(): Boolean = ServerPermissions.canKickMembers(permissions(), isOwner)

    fun canChangeOwnNickname(): Boolean = ServerPermissions.canChangeOwnNickname(permissions(), isOwner)

    fun canManageNicknames(): Boolean = ServerPermissions.canManageNicknames(permissions(), isOwner)

    fun canManageMemberRoles(): Boolean = isOwner || canManageRoles()

    fun canEditMemberNickname(member: ServerMemberInfo): Boolean {
        val isSelf = member.userIdValue.equals(currentUserId, ignoreCase = true)
        return if (isSelf) canChangeOwnNickname() else canManageNicknames()
    }

    fun canAddMembers(): Boolean = isOwner || ServerPermissions.canCreateInvites(permissions(), isOwner)

    fun availableTabs(): List<ServerSettingsTab> =
        buildList {
            if (canManageServer()) add(ServerSettingsTab.PROFILE)
            add(ServerSettingsTab.MEMBERS)
            if (canManageRoles()) add(ServerSettingsTab.ROLES)
            if (canManageServer()) add(ServerSettingsTab.AUDIT)
        }

    fun initialize(userId: String, serverId: String? = null) {
        val trimmedUserId = userId.trim()
        val trimmedServerId = serverId?.trim().orEmpty()
        if (trimmedServerId.isNotBlank()) {
            if (!this.serverId.equals(trimmedServerId, ignoreCase = true)) {
                invalidateMembersCache()
            }
            this.serverId = trimmedServerId
        }
        if (trimmedUserId.isBlank() || this.serverId.isBlank()) return
        if (currentUserId == trimmedUserId && _uiState.value.server != null) return
        currentUserId = trimmedUserId
        load()
    }

    fun selectTab(tab: ServerSettingsTab) {
        _uiState.update { it.copy(activeTab = tab) }
        when (tab) {
            ServerSettingsTab.MEMBERS -> loadMembers(force = false)
            ServerSettingsTab.ROLES -> loadRoles()
            ServerSettingsTab.AUDIT -> loadAuditLog(reset = true)
            else -> Unit
        }
    }

    init {
        serverSettingsRepository.setOnRolesChanged {
            if (_uiState.value.activeTab == ServerSettingsTab.ROLES) {
                loadRoles()
            }
            if (_uiState.value.roleMemberTarget != null) {
                loadMembers(force = true)
            }
        }
        serverSettingsRepository.setOnUserPermissionsUpdated { updatedUserId ->
            if (updatedUserId.equals(currentUserId, ignoreCase = true)) {
                viewModelScope.launch { reloadServer() }
            }
        }
        serverSettingsRepository.setOnMemberNicknameUpdated { payload ->
            val updatedUserId = payload.userIdValue
            if (updatedUserId.isBlank()) return@setOnMemberNicknameUpdated
            _uiState.update { state ->
                state.copy(
                    members = state.members.map { member ->
                        if (!member.userIdValue.equals(updatedUserId, ignoreCase = true)) {
                            member
                        } else {
                            member.copy(
                                username = payload.usernameValue ?: member.username,
                                usernameAlt = payload.usernameValue ?: member.usernameAlt,
                                nickname = payload.nickname,
                                nicknameAlt = payload.nickname,
                                login = payload.loginValue ?: member.login,
                                loginAlt = payload.loginValue ?: member.loginAlt,
                            )
                        }
                    },
                )
            }
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            serverSettingsRepository.connectHub(currentUserId, serverId)
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isLoading = false, error = error.message ?: "Не удалось подключиться к серверу")
                    }
                    return@launch
                }
            serverSettingsRepository.getServer(serverId)
                .onSuccess { server -> applyServer(server, isLoading = false) }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isLoading = false, error = error.message ?: "Не удалось загрузить сервер")
                    }
                }
        }
    }

    fun loadMembers(force: Boolean = false) {
        val now = System.currentTimeMillis()
        val hasRecentCache =
            _uiState.value.members.isNotEmpty() &&
                now - membersLoadedAtMs < MEMBERS_CACHE_TTL_MS
        if (!force && (hasRecentCache || _uiState.value.isMembersLoading)) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMembersLoading = true) }
            serverSettingsRepository.getMembers(serverId)
                .onSuccess { members ->
                    membersLoadedAtMs = System.currentTimeMillis()
                    _uiState.update { it.copy(members = members, isMembersLoading = false) }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isMembersLoading = false, error = error.message ?: "Не удалось загрузить участников")
                    }
                }
        }
    }

    private fun invalidateMembersCache() {
        membersLoadedAtMs = 0L
    }

    fun loadAuditLog(reset: Boolean = false) {
        viewModelScope.launch {
            val nextPage = if (reset) 1 else _uiState.value.auditPage + 1
            _uiState.update { it.copy(isAuditLoading = true, error = null) }
            serverSettingsRepository.fetchAuditLog(serverId, nextPage)
                .onSuccess { response ->
                    val newEntries =
                        if (reset) {
                            response.entries.orEmpty()
                        } else {
                            _uiState.value.auditEntries + response.entries.orEmpty()
                        }
                    _uiState.update {
                        it.copy(
                            auditEntries = newEntries,
                            auditTotalCount = response.totalCount,
                            auditPage = response.page,
                            isAuditLoading = false,
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isAuditLoading = false,
                            error = error.message ?: "Не удалось загрузить журнал аудита",
                        )
                    }
                }
        }
    }

    fun onAuditActionFilterChange(value: String) {
        _uiState.update { it.copy(auditActionFilter = value) }
    }

    fun loadMoreAudit() {
        if (!_uiState.value.isAuditLoading && _uiState.value.auditEntries.size < _uiState.value.auditTotalCount) {
            loadAuditLog(reset = false)
        }
    }

    fun loadRoles() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRolesLoading = true) }
            serverSettingsRepository.fetchRoles(serverId)
                .onSuccess { roles ->
                    _uiState.update { it.copy(roles = roles, isRolesLoading = false) }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isRolesLoading = false, error = error.message ?: "Не удалось загрузить роли")
                    }
                }
        }
    }

    private fun applyServer(server: ServerDetail, isLoading: Boolean = false, successHint: String? = null) {
        val explicitColor = (server.bannerColor ?: server.bannerColorAlt)?.trim()?.takeIf { it.isNotEmpty() }
        _uiState.update {
            it.copy(
                server = server,
                serverName = server.nameValue,
                bannerColor = explicitColor ?: "#3f3f3f",
                isDefaultBannerColor = explicitColor == null,
                isLoading = isLoading,
                isSavingName = false,
                isBannerLoading = false,
                isAvatarLoading = false,
                successHint = successHint,
            )
        }
    }

    fun updateServerName() {
        val name = _uiState.value.serverName.trim()
        if (name.isBlank()) {
            _uiState.update { it.copy(error = "Название сервера не может быть пустым") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingName = true, error = null) }
            serverSettingsRepository.updateServerName(serverId, name)
                .onSuccess { reloadServer("Название сервера сохранено") }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isSavingName = false, error = error.message ?: "Не удалось сохранить название")
                    }
                }
        }
    }

    fun onServerNameChange(value: String) = _uiState.update { it.copy(serverName = value) }

    fun onBannerColorSelected(color: String) =
        _uiState.update { it.copy(bannerColor = color, isDefaultBannerColor = false) }

    fun resetBannerColorToDefault() =
        _uiState.update { it.copy(bannerColor = "#3f3f3f", isDefaultBannerColor = true) }

    fun saveBannerColor() {
        viewModelScope.launch {
            _uiState.update { it.copy(isBannerLoading = true, error = null) }
            val state = _uiState.value
            serverSettingsRepository.updateBannerColor(serverId, state.bannerColor, state.isDefaultBannerColor)
                .onSuccess { reloadServer("Цвет баннера сохранён") }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isBannerLoading = false, error = error.message ?: "Не удалось сохранить цвет")
                    }
                }
        }
    }

    fun uploadBannerFromUri(uri: Uri) = uploadImageFromUri(uri, "banner.jpg", isAvatar = false)
    fun uploadAvatarFromUri(uri: Uri) = uploadImageFromUri(uri, "avatar.jpg", isAvatar = true)

    private fun uploadImageFromUri(uri: Uri, defaultName: String, isAvatar: Boolean) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(isBannerLoading = !isAvatar, isAvatarLoading = isAvatar, error = null)
            }
            val bytesResult = readBytesFromUri(uri, defaultName)
            if (bytesResult.isFailure) {
                _uiState.update {
                    it.copy(
                        isBannerLoading = false,
                        isAvatarLoading = false,
                        error = bytesResult.exceptionOrNull()?.message,
                    )
                }
                return@launch
            }
            val (bytes, mime, name) = bytesResult.getOrThrow()
            val result = if (isAvatar) {
                serverSettingsRepository.uploadAvatar(serverId, bytes, mime, name)
            } else {
                serverSettingsRepository.uploadBanner(serverId, bytes, mime, name)
            }
            result
                .onSuccess { reloadServer(if (isAvatar) "Значок обновлён" else "Баннер обновлён") }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isBannerLoading = false,
                            isAvatarLoading = false,
                            error = error.message,
                        )
                    }
                }
        }
    }

    fun deleteBanner() = deleteVisual(isBanner = true)
    fun deleteAvatar() = deleteVisual(isBanner = false)

    private fun deleteVisual(isBanner: Boolean) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(isBannerLoading = isBanner, isAvatarLoading = !isBanner, error = null)
            }
            val result = if (isBanner) {
                serverSettingsRepository.deleteBanner(serverId)
            } else {
                serverSettingsRepository.deleteAvatar(serverId)
            }
            result
                .onSuccess { reloadServer(if (isBanner) "Баннер удалён" else "Значок удалён") }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isBannerLoading = false,
                            isAvatarLoading = false,
                            error = error.message,
                        )
                    }
                }
        }
    }

    fun showAddMemberPicker(show: Boolean) = _uiState.update { it.copy(showAddMemberPicker = show) }

    fun addMember(memberUserId: String) {
        if (memberUserId.isBlank() || memberUserId in _uiState.value.addingMemberIds) return
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    addingMemberIds = it.addingMemberIds + memberUserId,
                    error = null,
                )
            }
            serverSettingsRepository.addMember(serverId, memberUserId)
                .onSuccess {
                    _uiState.update {
                        it.copy(addingMemberIds = it.addingMemberIds - memberUserId)
                    }
                    loadMembers(force = true)
                    showSuccess("Участник добавлен")
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            addingMemberIds = it.addingMemberIds - memberUserId,
                            error = error.message,
                        )
                    }
                }
        }
    }

    fun showKickDialog(member: ServerMemberInfo?) = _uiState.update { it.copy(kickMemberTarget = member) }

    fun showNicknameDialog(member: ServerMemberInfo?) {
        if (member != null && !canEditMemberNickname(member)) return
        _uiState.update {
            it.copy(
                nicknameMemberTarget = member,
                nicknameDraft = member?.nicknameValue.orEmpty(),
            )
        }
    }

    fun onNicknameDraftChange(value: String) {
        if (value.length <= UserDisplayNames.MAX_LENGTH) {
            _uiState.update { it.copy(nicknameDraft = value) }
        }
    }

    fun confirmNicknameUpdate() {
        val member = _uiState.value.nicknameMemberTarget ?: return
        if (!canEditMemberNickname(member)) {
            _uiState.update {
                it.copy(
                    nicknameMemberTarget = null,
                    error = "Недостаточно прав для изменения ника",
                )
            }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isNicknameSaving = true, error = null) }
            val trimmed = _uiState.value.nicknameDraft.trim()
            serverSettingsRepository.updateMemberNickname(
                serverId,
                member.userIdValue,
                trimmed.takeIf { it.isNotEmpty() },
            )
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            isNicknameSaving = false,
                            nicknameMemberTarget = null,
                            nicknameDraft = "",
                        )
                    }
                    loadMembers(force = true)
                    showSuccess("Серверный ник сохранён")
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isNicknameSaving = false,
                            error = error.message ?: "Не удалось обновить серверный ник",
                        )
                    }
                }
        }
    }

    fun confirmKickMember() {
        val member = _uiState.value.kickMemberTarget ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isMemberActionLoading = true, kickMemberTarget = null, error = null) }
            serverSettingsRepository.kickMember(serverId, member.userIdValue)
                .onSuccess {
                    _uiState.update { it.copy(isMemberActionLoading = false) }
                    loadMembers(force = true)
                    showSuccess("Участник удалён с сервера")
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isMemberActionLoading = false, error = error.message) }
                }
        }
    }

    fun showRolePicker(member: ServerMemberInfo?) {
        if (member != null && _uiState.value.roles.isEmpty()) {
            loadRoles()
        }
        _uiState.update { it.copy(roleMemberTarget = member) }
    }

    fun toggleMemberRole(roleId: String, assign: Boolean) {
        val member = _uiState.value.roleMemberTarget ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isMemberActionLoading = true, error = null) }
            val result = if (assign) {
                serverSettingsRepository.assignRole(member.userIdValue, roleId)
            } else {
                serverSettingsRepository.removeRole(member.userIdValue, roleId)
            }
            result
                .onSuccess {
                    _uiState.update { it.copy(isMemberActionLoading = false) }
                    loadMembers(force = true)
                    showSuccess("Роли участника обновлены")
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isMemberActionLoading = false, error = error.message) }
                }
        }
    }

    fun showCreateRoleForm(show: Boolean) {
        if (show) {
            openRoleEditor(role = null)
        } else {
            closeRoleEditor()
        }
    }

    fun onRoleSearchChange(value: String) = _uiState.update { it.copy(roleSearchQuery = value) }

    fun openRoleEditor(role: ServerRoleInfo?) {
        if (role == null) {
            _uiState.update {
                it.copy(
                    roleEditorVisible = true,
                    editingRoleId = null,
                    roleDraftName = "",
                    roleDraftColor = "#5865F2",
                    roleDraftPermissions = emptyMap(),
                    showCreateRoleForm = false,
                )
            }
        } else {
            _uiState.update {
                it.copy(
                    roleEditorVisible = true,
                    editingRoleId = role.roleIdValue,
                    roleDraftName = role.roleNameValue,
                    roleDraftColor = role.colorValue,
                    roleDraftPermissions = ServerPermissions.parseJson(role.permissionsValue),
                    showCreateRoleForm = false,
                )
            }
        }
    }

    fun closeRoleEditor() {
        _uiState.update {
            it.copy(
                roleEditorVisible = false,
                editingRoleId = null,
                roleDraftName = "",
                roleDraftColor = "#5865F2",
                roleDraftPermissions = emptyMap(),
                showCreateRoleForm = false,
            )
        }
    }

    fun onRoleDraftNameChange(value: String) = _uiState.update { it.copy(roleDraftName = value) }
    fun onRoleDraftColorChange(value: String) = _uiState.update { it.copy(roleDraftColor = value) }

    fun toggleRoleDraftPermission(key: String, enabled: Boolean) {
        _uiState.update { state ->
            val updated = state.roleDraftPermissions.toMutableMap()
            if (enabled) updated[key] = true else updated.remove(key)
            state.copy(roleDraftPermissions = updated)
        }
    }

    fun saveRole() {
        val name = _uiState.value.roleDraftName.trim()
        if (name.isBlank()) {
            _uiState.update { it.copy(error = "Введите название роли") }
            return
        }
        val permissionsJson = ServerPermissions.toJson(_uiState.value.roleDraftPermissions)
        val editingId = _uiState.value.editingRoleId
        viewModelScope.launch {
            _uiState.update { it.copy(isRoleSaving = true, error = null) }
            val result =
                if (editingId.isNullOrBlank()) {
                    serverSettingsRepository.createRole(
                        serverId,
                        name,
                        _uiState.value.roleDraftColor,
                        permissionsJson,
                    )
                } else {
                    serverSettingsRepository.updateRole(
                        editingId,
                        name,
                        _uiState.value.roleDraftColor,
                        permissionsJson,
                    )
                }
            result
                .onSuccess {
                    _uiState.update { it.copy(isRoleSaving = false) }
                    closeRoleEditor()
                    loadRoles()
                    showSuccess(if (editingId == null) "Роль создана" else "Роль сохранена")
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isRoleSaving = false, error = error.message) }
                }
        }
    }

    fun onNewRoleNameChange(value: String) = onRoleDraftNameChange(value)
    fun onNewRoleColorChange(value: String) = onRoleDraftColorChange(value)

    fun createRole() = saveRole()

    fun deleteRole(roleId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isRolesLoading = true, error = null) }
            serverSettingsRepository.deleteRole(roleId)
                .onSuccess {
                    _uiState.update { it.copy(isRolesLoading = false) }
                    loadRoles()
                    showSuccess("Роль удалена")
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isRolesLoading = false, error = error.message) }
                }
        }
    }

    private fun showSuccess(message: String) {
        _uiState.update { it.copy(successHint = message) }
    }

    private suspend fun reloadServer(successHint: String? = null) {
        serverSettingsRepository.getServer(serverId)
            .onSuccess { server -> applyServer(server, successHint = successHint) }
            .onFailure { error ->
                _uiState.update {
                    it.copy(
                        isSavingName = false,
                        isBannerLoading = false,
                        isAvatarLoading = false,
                        error = error.message,
                    )
                }
            }
    }

    private suspend fun readBytesFromUri(uri: Uri, defaultName: String): Result<Triple<ByteArray, String, String>> {
        return withContext(Dispatchers.IO) {
            runCatching {
                val resolver = appContext.contentResolver
                val mime = resolver.getType(uri) ?: "image/jpeg"
                val name =
                    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                        ?.use { cursor ->
                            if (cursor.moveToFirst()) {
                                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                                if (index >= 0) cursor.getString(index) else null
                            } else null
                        } ?: defaultName
                val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: throw IllegalStateException("Не удалось открыть файл")
                Triple(bytes, mime, name)
            }
        }
    }

    fun consumeHints() = _uiState.update { it.copy(successHint = null, error = null) }
}
