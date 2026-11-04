package com.whithin.voice.presentation.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.Category
import com.whithin.voice.data.model.Channel
import com.whithin.voice.data.model.ServerDetail
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.data.model.VoiceChannelParticipant
import com.whithin.voice.data.model.patchProfileUpdate
import com.whithin.voice.data.signalr.NotificationHub
import com.whithin.voice.data.signalr.ServerHub
import com.whithin.voice.data.socketio.VoiceSocketService
import com.whithin.voice.domain.permissions.ServerPermissions
import com.whithin.voice.data.repository.ServerDetailRepository
import com.whithin.voice.data.repository.ServerSettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChannelSettingsTarget(
    val channel: Channel,
    val categoryId: String?,
)

data class CreateChannelSheetTarget(
    val categoryId: String? = null,
    val categoryName: String? = null,
)

enum class ServerSetupContinueAction {
    INVITE_MEMBERS,
    CREATE_CHANNEL,
    OPEN_SETTINGS,
}

data class ServerSetupProgress(
    val currentStep: Int,
    val totalSteps: Int,
    val stepLabel: String,
    val progress: Float,
)

fun buildServerSetupProgress(
    server: ServerDetail,
    memberCount: Int,
    channelCount: Int,
    canManageServer: Boolean,
): ServerSetupProgress? {
    if (!canManageServer) return null

    val hasCustomization =
        !server.avatarPathValue.isNullOrBlank() ||
            !server.bannerPathValue.isNullOrBlank() ||
            server.hasBannerSection
    val invitedFriends = memberCount >= 2
    val hasChannels = channelCount >= 1

    val completedSteps =
        listOf(invitedFriends, hasChannels, hasCustomization).count { it }
    if (completedSteps >= 3) return null

    val currentStep = when {
        !invitedFriends -> 1
        !hasChannels -> 2
        !hasCustomization -> 3
        else -> 3
    }
    val stepLabel = when (currentStep) {
        1 -> "Шаг 1 из 3: Пригласите друзей"
        2 -> "Шаг 2 из 3: Создайте каналы"
        else -> "Шаг 3 из 3: Настройте сервер"
    }

    return ServerSetupProgress(
        currentStep = currentStep,
        totalSteps = 3,
        stepLabel = stepLabel,
        progress = completedSteps / 3f,
    )
}

data class ServerUiState(
    val server: ServerDetail? = null,
    val voiceChannelParticipants: Map<String, List<VoiceChannelParticipant>> = emptyMap(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val actionInProgress: Boolean = false,
    val actionMessage: String? = null,
    val channelSettings: ChannelSettingsTarget? = null,
    val categorySettings: Category? = null,
    val channelSettingsRoles: List<ServerRoleInfo> = emptyList(),
    val channelSettingsMembers: List<ServerMemberInfo> = emptyList(),
    val isChannelSettingsLoading: Boolean = false,
    val showDeleteChannelConfirm: Boolean = false,
    val showDeleteCategoryConfirm: Boolean = false,
    val showPanelContextMenu: Boolean = false,
    val createCategorySheet: Boolean = false,
    val createChannelSheet: CreateChannelSheetTarget? = null,
    val serverMenuMembers: List<ServerMemberInfo> = emptyList(),
    val isServerMenuMembersLoading: Boolean = false,
    val addingMemberIds: Set<String> = emptySet(),
)

@HiltViewModel
class ServerViewModel @Inject constructor(
    private val serverDetailRepository: ServerDetailRepository,
    private val serverSettingsRepository: ServerSettingsRepository,
    private val voiceSocketService: VoiceSocketService,
    private val notificationHub: NotificationHub,
    private val serverHub: ServerHub,
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(ServerUiState())
    val uiState: StateFlow<ServerUiState> = _uiState.asStateFlow()
    private val subscribedVoiceChannelIds = mutableSetOf<String>()
    private var voiceChannelCallbacksRegistered = false
    private var currentUserId: String = ""

    init {
        viewModelScope.launch {
            merge(
                notificationHub.profileUpdatedEvents,
                serverHub.memberProfileUpdatedEvents,
            ).collect { update ->
                val patched = _uiState.value.voiceChannelParticipants.patchProfileUpdate(update)
                if (patched !== _uiState.value.voiceChannelParticipants) {
                    _uiState.value = _uiState.value.copy(voiceChannelParticipants = patched)
                }
            }
        }
        serverSettingsRepository.setOnUserPermissionsUpdated { updatedUserId ->
            if (updatedUserId.equals(currentUserId, ignoreCase = true)) {
                val serverId = _uiState.value.server?.serverIdValue.orEmpty()
                if (serverId.isNotBlank()) {
                    reloadServer(serverId)
                }
            }
        }
        serverSettingsRepository.setOnServerStructureChanged {
            val serverId = _uiState.value.server?.serverIdValue.orEmpty()
            if (serverId.isNotBlank()) {
                reloadServer(serverId)
            }
        }
    }

    private val voiceChannelParticipantsListener: (String, List<VoiceChannelParticipant>) -> Unit =
        { channelId, participants ->
            val newMap = _uiState.value.voiceChannelParticipants.toMutableMap()
            val previousByUserId = newMap[channelId].orEmpty().associateBy { it.userId }
            val participantIds = participants.map { it.userId }.toSet()
            if (participantIds.isNotEmpty()) {
                newMap.keys.toList().forEach { existingChannelId ->
                    if (existingChannelId != channelId) {
                        val filtered =
                            newMap[existingChannelId].orEmpty()
                                .filterNot { it.userId in participantIds }
                        newMap[existingChannelId] = filtered
                    }
                }
            }
            newMap[channelId] =
                participants.map { incoming ->
                    val previous = previousByUserId[incoming.userId]
                    if (previous == null) {
                        incoming
                    } else {
                        incoming.copy(isSpeaking = previous.isSpeaking)
                    }
                }
            _uiState.value = _uiState.value.copy(voiceChannelParticipants = newMap)
        }

    private val voiceChannelUserJoinedListener: (String, VoiceChannelParticipant) -> Unit =
        { channelId, participant ->
            val newMap = _uiState.value.voiceChannelParticipants.toMutableMap()
            newMap.keys.toList().forEach { existingChannelId ->
                val filtered =
                    newMap[existingChannelId].orEmpty()
                        .filterNot { it.userId == participant.userId }
                newMap[existingChannelId] = filtered
            }
            val current = newMap[channelId].orEmpty().toMutableList()
            if (current.none { it.userId == participant.userId }) {
                current.add(participant)
            }
            newMap[channelId] = current
            _uiState.value = _uiState.value.copy(voiceChannelParticipants = newMap)
        }

    private val voiceChannelUserLeftListener: (String, String) -> Unit = { channelId, userId ->
        val newMap = _uiState.value.voiceChannelParticipants.toMutableMap()
        val current = newMap[channelId].orEmpty().filterNot { it.userId == userId }
        newMap[channelId] = current
        _uiState.value = _uiState.value.copy(voiceChannelParticipants = newMap)
    }

    private val voiceChannelParticipantStateChangedListener:
        (String, String, Boolean?, Boolean?, Boolean?) -> Unit =
        { channelId, userId, isMuted, isSpeaking, isAudioDisabled ->
            val newMap = _uiState.value.voiceChannelParticipants.toMutableMap()
            val updated =
                newMap[channelId].orEmpty().map { participant ->
                    if (participant.userId == userId) {
                        participant.copy(
                            isMuted = isMuted ?: participant.isMuted,
                            isSpeaking = isSpeaking ?: participant.isSpeaking,
                            isAudioDisabled = isAudioDisabled ?: participant.isAudioDisabled,
                            isDeafened = isAudioDisabled ?: participant.isDeafened,
                        )
                    } else {
                        participant
                    }
                }
            newMap[channelId] = updated
            _uiState.value = _uiState.value.copy(voiceChannelParticipants = newMap)
        }

    private val speakingStateChangedListener: (String?, String?, Boolean) -> Unit =
        { _, userId, speaking ->
            if (!userId.isNullOrBlank()) {
                patchVoiceChannelSpeaking(userId, speaking)
            }
        }
    
    fun loadServer(serverId: String, userId: String = "") {
        if (userId.isNotBlank()) {
            currentUserId = userId.trim()
        }
        val trimmedServerId = serverId.trim()
        if (trimmedServerId.isBlank()) return

        val cachedServer = _uiState.value.server
        if (
            cachedServer?.serverIdValue.equals(trimmedServerId, ignoreCase = true) &&
                !_uiState.value.isLoading
        ) {
            return
        }

        viewModelScope.launch {
            val showLoading = !cachedServer?.serverIdValue.equals(trimmedServerId, ignoreCase = true)
            if (showLoading) {
                _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            }

            if (currentUserId.isNotBlank()) {
                serverSettingsRepository.connectHub(currentUserId, trimmedServerId)
            }

            serverDetailRepository.getServer(trimmedServerId)
                .onSuccess { server ->
                    Log.d("ServerViewModel", "Server loaded: ${server.nameValue}")
                    subscribeToVoiceChannels(server)
                    _uiState.value = _uiState.value.copy(
                        server = server,
                        isLoading = false
                    )
                }
                .onFailure { exception ->
                    Log.e("ServerViewModel", "Error loading server", exception)
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = exception.message ?: "Failed to load server"
                    )
                }
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun consumeActionMessage() {
        _uiState.value = _uiState.value.copy(actionMessage = null)
    }

    fun isCurrentUserOwner(): Boolean {
        val server = _uiState.value.server ?: return false
        val ownerId = server.ownerIdValue.trim()
        return ownerId.isNotBlank() && ownerId.equals(currentUserId.trim(), ignoreCase = true)
    }

    fun permissions(): Map<String, Boolean> = _uiState.value.server?.permissionsValue ?: emptyMap()

    fun canManageServer(): Boolean = ServerPermissions.canManageServer(permissions(), isCurrentUserOwner())

    fun canManageChannels(): Boolean = ServerPermissions.canManageChannels(permissions(), isCurrentUserOwner())

    fun canCreateInvites(): Boolean = ServerPermissions.canCreateInvites(permissions(), isCurrentUserOwner())

    fun loadServerMenuMembers() {
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isServerMenuMembersLoading = true)
            serverSettingsRepository.getMembers(serverId)
                .onSuccess { members ->
                    _uiState.value = _uiState.value.copy(
                        serverMenuMembers = members,
                        isServerMenuMembersLoading = false,
                    )
                }
                .onFailure {
                    _uiState.value = _uiState.value.copy(isServerMenuMembersLoading = false)
                }
        }
    }

    fun resolveSetupContinueAction(
        memberCount: Int,
        channelCount: Int,
    ): ServerSetupContinueAction {
        val server = _uiState.value.server ?: return ServerSetupContinueAction.OPEN_SETTINGS
        val setup = buildServerSetupProgress(
            server = server,
            memberCount = memberCount,
            channelCount = channelCount,
            canManageServer = canManageServer(),
        ) ?: return ServerSetupContinueAction.OPEN_SETTINGS
        return when (setup.currentStep) {
            1 -> ServerSetupContinueAction.INVITE_MEMBERS
            2 -> ServerSetupContinueAction.CREATE_CHANNEL
            else -> ServerSetupContinueAction.OPEN_SETTINGS
        }
    }

    fun openChannelSettings(channel: Channel, categoryId: String?) {
        if (!canManageChannels()) return
        _uiState.value = _uiState.value.copy(
            channelSettings = ChannelSettingsTarget(channel = channel, categoryId = categoryId),
            error = null,
        )
        loadEditorAccessData()
    }

    private fun loadEditorAccessData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isChannelSettingsLoading = true)
            val serverId = _uiState.value.server?.serverIdValue.orEmpty()
            val rolesResult = serverSettingsRepository.fetchRoles(serverId)
            val membersResult = serverSettingsRepository.getMembers(serverId)
            _uiState.value = _uiState.value.copy(
                channelSettingsRoles = rolesResult.getOrElse { emptyList() },
                channelSettingsMembers = membersResult.getOrElse { emptyList() },
                isChannelSettingsLoading = false,
            )
        }
    }

    fun openCategorySettings(category: Category) {
        if (!canManageChannels()) return
        val categoryId = category.categoryIdValue ?: return
        _uiState.value = _uiState.value.copy(categorySettings = category, error = null)
        loadEditorAccessData()
    }

    fun closeCategorySettings() {
        _uiState.value = _uiState.value.copy(
            categorySettings = null,
            showDeleteCategoryConfirm = false,
        )
    }

    fun showDeleteCategoryConfirm(show: Boolean) {
        _uiState.value = _uiState.value.copy(showDeleteCategoryConfirm = show)
    }

    fun saveCategorySettings(
        name: String,
        isPrivate: Boolean,
        allowedRoleIds: List<String>,
        allowedUserIds: List<String>,
    ) {
        val category = _uiState.value.categorySettings ?: return
        val categoryId = category.categoryIdValue ?: return
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return

        val trimmedName = name.trim()
        if (trimmedName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Название категории не может быть пустым")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionInProgress = true, error = null)
            serverSettingsRepository.updateCategory(
                serverId = serverId,
                categoryId = categoryId,
                categoryName = trimmedName,
                isPrivate = isPrivate,
                allowedRoleIds = if (isPrivate) allowedRoleIds else emptyList(),
                allowedUserIds = if (isPrivate) allowedUserIds else emptyList(),
            ).onSuccess {
                _uiState.value = _uiState.value.copy(actionInProgress = false, actionMessage = "Категория сохранена")
                closeCategorySettings()
                reloadServer(serverId)
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    actionInProgress = false,
                    error = error.message ?: "Не удалось сохранить категорию",
                )
            }
        }
    }

    fun deleteCategory() {
        val category = _uiState.value.categorySettings ?: return
        val categoryId = category.categoryIdValue ?: return
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                actionInProgress = true,
                showDeleteCategoryConfirm = false,
                error = null,
            )
            serverSettingsRepository.deleteCategory(serverId, categoryId)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(actionInProgress = false, actionMessage = "Категория удалена")
                    closeCategorySettings()
                    reloadServer(serverId)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        error = error.message ?: "Не удалось удалить категорию",
                    )
                }
        }
    }

    fun openPanelContextMenu() {
        if (!canManageChannels()) return
        _uiState.value = _uiState.value.copy(showPanelContextMenu = true)
    }

    fun closePanelContextMenu() {
        _uiState.value = _uiState.value.copy(showPanelContextMenu = false)
    }

    fun openCreateCategorySheet() {
        if (!canManageChannels()) return
        closePanelContextMenu()
        _uiState.value = _uiState.value.copy(createCategorySheet = true, error = null)
        loadEditorAccessData()
    }

    fun closeCreateCategorySheet() {
        _uiState.value = _uiState.value.copy(createCategorySheet = false)
    }

    fun createCategory(
        name: String,
        isPrivate: Boolean,
        allowedRoleIds: List<String>,
        allowedUserIds: List<String>,
    ) {
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return
        val trimmedName = name.trim()
        if (trimmedName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Введите название категории")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionInProgress = true, error = null)
            val result =
                if (isPrivate) {
                    serverSettingsRepository.createPrivateCategory(
                        serverId,
                        trimmedName,
                        allowedRoleIds,
                        allowedUserIds,
                    )
                } else {
                    serverSettingsRepository.createCategory(serverId, trimmedName)
                }
            result
                .onSuccess {
                    _uiState.value = _uiState.value.copy(actionInProgress = false, actionMessage = "Категория создана")
                    closeCreateCategorySheet()
                    reloadServer(serverId)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        error = error.message ?: "Не удалось создать категорию",
                    )
                }
        }
    }

    fun openCreateChannelSheet(categoryId: String? = null, categoryName: String? = null) {
        if (!canManageChannels()) return
        closePanelContextMenu()
        _uiState.value = _uiState.value.copy(
            createChannelSheet = CreateChannelSheetTarget(categoryId, categoryName),
            error = null,
        )
        loadEditorAccessData()
    }

    fun closeCreateChannelSheet() {
        _uiState.value = _uiState.value.copy(createChannelSheet = null)
    }

    fun createChannel(
        name: String,
        chatType: Int,
        categoryId: String?,
        isPrivate: Boolean,
        memberIds: List<String>,
    ) {
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return
        val trimmedName = name.trim()
        if (trimmedName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Введите название канала")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionInProgress = true, error = null)
            serverSettingsRepository.createChat(
                serverId,
                categoryId,
                trimmedName,
                chatType,
                isPrivate,
                if (isPrivate) memberIds else emptyList(),
            )
                .onSuccess {
                    _uiState.value = _uiState.value.copy(actionInProgress = false, actionMessage = "Канал создан")
                    closeCreateChannelSheet()
                    reloadServer(serverId)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        error = error.message ?: "Не удалось создать канал",
                    )
                }
        }
    }

    fun closeChannelSettings() {
        _uiState.value = _uiState.value.copy(
            channelSettings = null,
            channelSettingsRoles = emptyList(),
            channelSettingsMembers = emptyList(),
            showDeleteChannelConfirm = false,
        )
    }

    fun showDeleteChannelConfirm(show: Boolean) {
        _uiState.value = _uiState.value.copy(showDeleteChannelConfirm = show)
    }

    fun saveChannelSettings(
        name: String,
        isPrivate: Boolean,
        allowedRoleIds: List<String>,
        allowedMemberIds: List<String>,
    ) {
        val target = _uiState.value.channelSettings ?: return
        val channel = target.channel
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return

        val trimmedName = name.trim()
        if (trimmedName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Название канала не может быть пустым")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionInProgress = true, error = null)
            val initialIsPrivate = channel.isPrivateValue
            val nameChanged = !trimmedName.equals(channel.nameValue, ignoreCase = false)
            val privacyChanged = isPrivate != initialIsPrivate
            val rolesChanged =
                isPrivate &&
                    allowedRoleIds.sorted() != channel.allowedRoleIdsValue.sorted()
            val initialMemberIds = channel.membersValue.toSet()
            val membersChanged =
                isPrivate &&
                    allowedMemberIds.toSet() != initialMemberIds

            if (nameChanged) {
                serverSettingsRepository.updateChatName(serverId, channel.chatIdValue, trimmedName)
                    .onFailure { error ->
                        _uiState.value = _uiState.value.copy(
                            actionInProgress = false,
                            error = error.message ?: "Не удалось переименовать канал",
                        )
                        return@launch
                    }
            }

            if (privacyChanged || rolesChanged) {
                serverSettingsRepository.updateChatPrivacy(
                    serverId = serverId,
                    chatId = channel.chatIdValue,
                    isPrivate = isPrivate,
                    allowedRoleIds = if (isPrivate) allowedRoleIds else emptyList(),
                    memberIds = if (isPrivate && !initialIsPrivate) allowedMemberIds else emptyList(),
                ).onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        error = error.message ?: "Не удалось обновить канал",
                    )
                    return@launch
                }
            }

            if (isPrivate && initialIsPrivate && membersChanged) {
                val toAdd = allowedMemberIds.toSet() - initialMemberIds
                val toRemove = initialMemberIds - allowedMemberIds.toSet()
                for (memberId in toAdd) {
                    serverSettingsRepository.addMemberToChannel(serverId, channel.chatIdValue, memberId)
                        .onFailure { error ->
                            _uiState.value = _uiState.value.copy(
                                actionInProgress = false,
                                error = error.message ?: "Не удалось добавить участника",
                            )
                            return@launch
                        }
                }
                for (memberId in toRemove) {
                    serverSettingsRepository.removeMemberFromChannel(serverId, channel.chatIdValue, memberId)
                        .onFailure { error ->
                            _uiState.value = _uiState.value.copy(
                                actionInProgress = false,
                                error = error.message ?: "Не удалось удалить участника",
                            )
                            return@launch
                        }
                }
            }

            _uiState.value = _uiState.value.copy(actionInProgress = false, actionMessage = "Канал сохранён")
            closeChannelSettings()
            reloadServer(serverId)
        }
    }

    fun deleteChannel(onDeleted: (String) -> Unit) {
        val target = _uiState.value.channelSettings ?: return
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        val chatId = target.channel.chatIdValue
        if (serverId.isBlank() || chatId.isBlank()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                actionInProgress = true,
                showDeleteChannelConfirm = false,
                error = null,
            )
            serverSettingsRepository.deleteChat(serverId, chatId)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        actionMessage = "Канал удалён",
                    )
                    closeChannelSettings()
                    onDeleted(chatId)
                    reloadServer(serverId)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        error = error.message ?: "Не удалось удалить канал",
                    )
                }
        }
    }

    private fun reloadServer(serverId: String) {
        viewModelScope.launch {
            serverDetailRepository.getServer(serverId)
                .onSuccess { server ->
                    subscribeToVoiceChannels(server)
                    _uiState.value = _uiState.value.copy(server = server)
                }
        }
    }

    fun leaveServer(onSuccess: () -> Unit) {
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionInProgress = true, error = null)
            serverSettingsRepository.leaveServer(serverId)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(actionInProgress = false)
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        error = error.message ?: "Не удалось покинуть сервер",
                    )
                }
        }
    }

    fun deleteServer(onSuccess: () -> Unit) {
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionInProgress = true, error = null)
            serverSettingsRepository.deleteServer(serverId)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(actionInProgress = false)
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        actionInProgress = false,
                        error = error.message ?: "Не удалось удалить сервер",
                    )
                }
        }
    }

    fun addMember(memberUserId: String) {
        val serverId = _uiState.value.server?.serverIdValue.orEmpty()
        if (serverId.isBlank() || memberUserId.isBlank()) return
        if (memberUserId in _uiState.value.addingMemberIds) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                addingMemberIds = _uiState.value.addingMemberIds + memberUserId,
                error = null,
            )
            val result = serverSettingsRepository.addMember(serverId, memberUserId)
            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(
                    addingMemberIds = _uiState.value.addingMemberIds - memberUserId,
                    actionMessage = "Участник добавлен",
                )
                loadServerMenuMembers()
            } else {
                _uiState.value = _uiState.value.copy(
                    addingMemberIds = _uiState.value.addingMemberIds - memberUserId,
                    error = result.exceptionOrNull()?.message ?: "Не удалось добавить участника",
                )
            }
        }
    }

    private fun subscribeToVoiceChannels(server: ServerDetail) {
        val voiceChannelIds = server.categoriesValue
            .flatMap { it.chatsValue }
            .filter { it.isVoiceChannel }
            .map { it.chatIdValue }
            .filter { it.isNotBlank() }
            .toSet()

        val channelsToRemove = subscribedVoiceChannelIds - voiceChannelIds
        channelsToRemove.forEach { channelId ->
            voiceSocketService.unsubscribeFromChannel(channelId)
        }
        if (channelsToRemove.isNotEmpty()) {
            val trimmedMap = _uiState.value.voiceChannelParticipants
                .filterKeys { it in voiceChannelIds }
            _uiState.value = _uiState.value.copy(voiceChannelParticipants = trimmedMap)
        }

        val channelsToAdd = voiceChannelIds - subscribedVoiceChannelIds

        setupVoiceChannelCallbacks()
        viewModelScope.launch {
            voiceSocketService.connect()
            channelsToAdd.forEach { channelId ->
                voiceSocketService.subscribeToChannel(channelId)
            }
            // Force refresh for all currently tracked channels
            voiceChannelIds.forEach { channelId ->
                voiceSocketService.requestChannelParticipants(channelId)
            }
        }

        subscribedVoiceChannelIds.clear()
        subscribedVoiceChannelIds.addAll(voiceChannelIds)
    }

    private fun setupVoiceChannelCallbacks() {
        if (voiceChannelCallbacksRegistered) return
        voiceChannelCallbacksRegistered = true
        voiceSocketService.addVoiceChannelParticipantsListener(voiceChannelParticipantsListener)
        voiceSocketService.addVoiceChannelUserJoinedListener(voiceChannelUserJoinedListener)
        voiceSocketService.addVoiceChannelUserLeftListener(voiceChannelUserLeftListener)
        voiceSocketService.addVoiceChannelParticipantStateChangedListener(
            voiceChannelParticipantStateChangedListener,
        )
        voiceSocketService.addSpeakingStateChangedListener(speakingStateChangedListener)
    }

    private fun patchVoiceChannelSpeaking(userId: String, speaking: Boolean) {
        val currentMap = _uiState.value.voiceChannelParticipants
        var changed = false
        val newMap =
            currentMap.mapValues { (_, participants) ->
                participants.map { participant ->
                    if (participant.userId != userId) {
                        participant
                    } else {
                        val effectiveSpeaking = speaking && !participant.isMuted
                        if (participant.isSpeaking == effectiveSpeaking) {
                            participant
                        } else {
                            changed = true
                            participant.copy(isSpeaking = effectiveSpeaking)
                        }
                    }
                }
            }
        if (changed) {
            _uiState.value = _uiState.value.copy(voiceChannelParticipants = newMap)
        }
    }

    override fun onCleared() {
        subscribedVoiceChannelIds.forEach { channelId ->
            voiceSocketService.unsubscribeFromChannel(channelId)
        }
        subscribedVoiceChannelIds.clear()
        if (voiceChannelCallbacksRegistered) {
            voiceSocketService.removeVoiceChannelParticipantsListener(voiceChannelParticipantsListener)
            voiceSocketService.removeVoiceChannelUserJoinedListener(voiceChannelUserJoinedListener)
            voiceSocketService.removeVoiceChannelUserLeftListener(voiceChannelUserLeftListener)
            voiceSocketService.removeVoiceChannelParticipantStateChangedListener(
                voiceChannelParticipantStateChangedListener,
            )
            voiceSocketService.removeSpeakingStateChangedListener(speakingStateChangedListener)
            voiceChannelCallbacksRegistered = false
        }
        super.onCleared()
    }
}
