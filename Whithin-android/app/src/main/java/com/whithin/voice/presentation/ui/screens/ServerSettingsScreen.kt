package com.whithin.voice.presentation.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.presentation.ui.components.AddServerMemberBottomSheet
import com.whithin.voice.presentation.ui.components.AvatarWithPresenceIndicator
import com.whithin.voice.presentation.ui.components.UserNameplate
import com.whithin.voice.presentation.ui.components.FloatingPillTabBar
import com.whithin.voice.presentation.ui.components.RoleEditorBottomSheet
import com.whithin.voice.presentation.ui.components.ServerAuditLogPanel
import com.whithin.voice.presentation.ui.components.ServerRoleManagementPanel
import com.whithin.voice.presentation.ui.components.TelegramMessageUi
import com.whithin.voice.presentation.ui.media.ProfileMediaLogger
import com.whithin.voice.presentation.ui.media.ProfileMediaSpecs
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordModalBackground
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.presentation.viewmodel.FriendViewModel
import com.whithin.voice.presentation.viewmodel.ServerSettingsTab
import com.whithin.voice.presentation.viewmodel.ServerSettingsViewModel
import androidx.compose.material3.rememberModalBottomSheetState
import com.whithin.voice.presentation.ui.components.AppText as Text

private val BannerPalette = listOf(
    "#000000", "#ff73b3", "#ff6b35", "#ffa500", "#ffff00",
    "#9c27b0", "#4caf50", "#2196f3", "#f44336", "#5865F2",
)

private data class MemberSearchEntry(
    val member: ServerMemberInfo,
    val usernameLower: String,
    val loginLower: String,
    val nicknameLower: String,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ServerSettingsPanel(
    serverId: String,
    userId: String,
    onClose: () -> Unit,
    viewModel: ServerSettingsViewModel = hiltViewModel(key = "server-settings-$serverId"),
    friendViewModel: FriendViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsUiState()
    val friendState by friendViewModel.uiState.collectAsUiState()
    val snackbarHostState = remember { SnackbarHostState() }
    val availableTabs = viewModel.availableTabs()
    val canManageServer = viewModel.canManageServer()
    val canManageRoles = viewModel.canManageRoles()
    val canKickMembers = viewModel.canKickMembers()
    val canManageMemberRoles = viewModel.canManageMemberRoles()
    val canAddMembers = viewModel.canAddMembers()
    val canChangeOwnNickname = viewModel.canChangeOwnNickname()
    val canManageNicknames = viewModel.canManageNicknames()

    val pickBanner = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { viewModel.uploadBannerFromUri(it) }
    }
    val pickAvatar = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { viewModel.uploadAvatarFromUri(it) }
    }

    LaunchedEffect(serverId, userId) {
        if (serverId.isNotBlank() && userId.isNotBlank()) {
            viewModel.initialize(userId, serverId)
        }
    }

    LaunchedEffect(state.showAddMemberPicker) {
        if (state.showAddMemberPicker) {
            friendViewModel.load(userId)
            viewModel.loadMembers()
        }
    }

    LaunchedEffect(state.successHint, state.error) {
        state.error?.let { snackbarHostState.showSnackbar(it); viewModel.consumeHints() }
        state.successHint?.let { snackbarHostState.showSnackbar(it); viewModel.consumeHints() }
    }

    LaunchedEffect(availableTabs, state.activeTab) {
        if (state.activeTab !in availableTabs) {
            viewModel.selectTab(availableTabs.firstOrNull() ?: ServerSettingsTab.MEMBERS)
        }
    }

    var memberSearchQuery by rememberSaveable(serverId) { mutableStateOf("") }
    val memberSearchEntries =
        remember(state.members) {
            state.members.map { member ->
                MemberSearchEntry(
                    member = member,
                    usernameLower = member.usernameValue.lowercase(),
                    loginLower = member.loginValue.orEmpty().lowercase(),
                    nicknameLower = member.nicknameValue.orEmpty().lowercase(),
                )
            }
        }
    val filteredMembers = remember(memberSearchEntries, memberSearchQuery) {
        val query = memberSearchQuery.trim().lowercase()
        if (query.isBlank()) {
            memberSearchEntries.map { it.member }
        } else {
            memberSearchEntries
                .asSequence()
                .filter { entry ->
                    entry.usernameLower.contains(query) ||
                        entry.loginLower.contains(query) ||
                        entry.nicknameLower.contains(query)
                }
                .map { it.member }
                .toList()
        }
    }

    state.kickMemberTarget?.let { member ->
        AlertDialog(
            onDismissRequest = { viewModel.showKickDialog(null) },
            title = { Text("Удалить с сервера") },
            text = { Text("Удалить ${member.usernameValue} с сервера?") },
            confirmButton = {
                TextButton(onClick = viewModel::confirmKickMember) {
                    Text("Удалить", color = DiscordError)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.showKickDialog(null) }) { Text("Отмена") }
            },
        )
    }

    state.nicknameMemberTarget?.let { member ->
        val isSelf = member.userIdValue.equals(userId, ignoreCase = true)
        AlertDialog(
            onDismissRequest = { viewModel.showNicknameDialog(null) },
            title = {
                Text(
                    if (isSelf) {
                        "Мой серверный ник"
                    } else {
                        "Серверный ник — ${member.usernameValue}"
                    },
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        buildString {
                            append("Переопределяет глобальный ник только на этом сервере. Пустое значение — сброс.")
                            member.loginValue?.let { append(" Логин: @$it") }
                        },
                        color = DiscordTextSecondary,
                        fontSize = 13.sp,
                    )
                    OutlinedTextField(
                        value = state.nicknameDraft,
                        onValueChange = viewModel::onNicknameDraftChange,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !state.isNicknameSaving,
                        placeholder = { Text(member.usernameValue) },
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = viewModel::confirmNicknameUpdate,
                    enabled = !state.isNicknameSaving,
                ) {
                    Text(if (state.isNicknameSaving) "Сохранение…" else "Сохранить")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { viewModel.showNicknameDialog(null) },
                    enabled = !state.isNicknameSaving,
                ) {
                    Text("Отмена")
                }
            },
        )
    }

    state.roleMemberTarget?.let { member ->
        MemberRolesDialog(
            member = member,
            roles = state.roles,
            isLoading = state.isMemberActionLoading,
            onDismiss = { viewModel.showRolePicker(null) },
            onToggle = viewModel::toggleMemberRole,
        )
    }

    AddServerMemberBottomSheet(
        visible = state.showAddMemberPicker,
        friends = friendState.friends,
        existingMemberIds = state.members.map { it.userIdValue }.toSet(),
        isLoading = friendState.isLoading || state.isMembersLoading,
        addingUserIds = state.addingMemberIds,
        error = state.error,
        onDismiss = {
            viewModel.showAddMemberPicker(false)
            viewModel.consumeHints()
        },
        onRefresh = {
            friendViewModel.load(userId)
            viewModel.loadMembers()
        },
        onAddMember = { friend -> viewModel.addMember(friend.userIdValue) },
    )

    RoleEditorBottomSheet(
        visible = state.roleEditorVisible,
        isEditing = state.editingRoleId != null,
        draftName = state.roleDraftName,
        draftColor = state.roleDraftColor,
        draftPermissions = state.roleDraftPermissions,
        isSaving = state.isRoleSaving,
        onDismiss = viewModel::closeRoleEditor,
        onDraftNameChange = viewModel::onRoleDraftNameChange,
        onDraftColorChange = viewModel::onRoleDraftColorChange,
        onTogglePermission = viewModel::toggleRoleDraftPermission,
        onSave = viewModel::saveRole,
    )

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = DiscordModalBackground,
    ) {
        Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                ServerSettingsTopBar(onBack = onClose)

                when {
                    state.isLoading && state.server == null -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = TelegramMessageUi.AccentBlue, strokeWidth = 2.dp)
                        }
                    }

                    else -> {
                        val selectedTabIndex =
                            availableTabs.indexOf(state.activeTab).coerceAtLeast(0)
                        val listState = rememberLazyListState()
                        val showFloatingTabs by remember {
                            derivedStateOf {
                                listState.firstVisibleItemIndex > 1 ||
                                    (listState.firstVisibleItemIndex == 1 && listState.firstVisibleItemScrollOffset > 8)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .navigationBarsPadding(),
                        ) {
                            LazyColumn(
                                state = listState,
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(bottom = 48.dp),
                            ) {
                                item(key = "profile-header") {
                                    ServerProfileHeader(
                                        serverName = state.serverName,
                                        memberCount = state.members.size,
                                        bannerPath = state.server?.bannerPathValue,
                                        bannerColor = state.bannerColor,
                                        avatarUrl = resolveServerIconUrl(state.server?.avatarPathValue),
                                    )
                                }

                                item(key = "settings-tabs-inline") {
                                    FloatingPillTabBar(
                                        tabs = availableTabs.map { it.title },
                                        selectedIndex = selectedTabIndex,
                                        onSelect = { index ->
                                            availableTabs.getOrNull(index)?.let(viewModel::selectTab)
                                        },
                                    )
                                }

                                if (state.activeTab == ServerSettingsTab.MEMBERS) {
                                    embeddedMembersTabItems(
                                        members = state.members,
                                        filteredMembers = filteredMembers,
                                        searchQuery = memberSearchQuery,
                                        onSearchQueryChange = { memberSearchQuery = it },
                                        onClearSearch = { memberSearchQuery = "" },
                                        isLoading = state.isMembersLoading,
                                        canManageMemberRoles = canManageMemberRoles,
                                        canKickMembers = canKickMembers,
                                        canChangeOwnNickname = canChangeOwnNickname,
                                        canManageNicknames = canManageNicknames,
                                        canAddMembers = canAddMembers,
                                        currentUserId = userId,
                                        onAddMember = { viewModel.showAddMemberPicker(true) },
                                        onManageRoles = viewModel::showRolePicker,
                                        onKick = viewModel::showKickDialog,
                                        onEditNickname = viewModel::showNicknameDialog,
                                    )
                                } else {
                                    item(key = "settings-tab-${state.activeTab.name}") {
                                        SettingsTabContent(
                                            activeTab = state.activeTab,
                                            canManageServer = canManageServer,
                                            canManageRoles = canManageRoles,
                                            canKickMembers = canKickMembers,
                                            canManageMemberRoles = canManageMemberRoles,
                                            canAddMembers = canAddMembers,
                                            state = state,
                                            userId = userId,
                                            pickAvatar = pickAvatar,
                                            pickBanner = pickBanner,
                                            viewModel = viewModel,
                                            embeddedInParentScroll = true,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(bottom = 16.dp),
                                        )
                                    }
                                }
                            }

                            if (showFloatingTabs) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopCenter)
                                        .fillMaxWidth()
                                        .background(DiscordModalBackground.copy(alpha = 0.96f)),
                                ) {
                                    FloatingPillTabBar(
                                        tabs = availableTabs.map { it.title },
                                        selectedIndex = selectedTabIndex,
                                        onSelect = { index ->
                                            availableTabs.getOrNull(index)?.let(viewModel::selectTab)
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }

            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding(),
            )
        }
    }
}

@Composable
private fun ServerSettingsTopBar(onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 4.dp, vertical = 4.dp),
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = DiscordText)
        }
    }
}

@Composable
private fun ServerProfileHeader(
    serverName: String,
    memberCount: Int,
    bannerPath: String?,
    bannerColor: String,
    avatarUrl: String?,
) {
    val accentColor = TelegramMessageUi.AccentBlue
    val bannerImageUrl =
        bannerPath
            ?.trim()
            ?.takeIf { it.isNotEmpty() && !it.startsWith("#") }
            ?.let { resolveServerIconUrl(it) }
    val bgColor =
        runCatching { Color(android.graphics.Color.parseColor(bannerColor)) }
            .getOrDefault(accentColor.copy(alpha = 0.4f))
    val subtitle =
        when (memberCount) {
            0 -> "Нет участников"
            1 -> "1 участник"
            in 2..4 -> "$memberCount участника"
            else -> "$memberCount участников"
        }
    val initial = serverName.firstOrNull()?.uppercaseChar()?.toString() ?: "С"
    val context = LocalContext.current
    val density = LocalDensity.current
    val bannerH = with(density) { 148.dp.roundToPx() }
    val avatarPx = with(density) { 108.dp.roundToPx() }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(148.dp),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(bgColor),
            ) {
                if (bannerImageUrl != null) {
                    val bannerRequest =
                        remember(bannerImageUrl, bannerH) {
                            sizedImageRequest(context, bannerImageUrl, 1080, bannerH)
                        }
                    AsyncImage(
                        model = bannerRequest,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }
            }

            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .offset(y = 54.dp)
                    .size(108.dp)
                    .clip(CircleShape)
                    .background(accentColor),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = initial,
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
                if (avatarUrl != null) {
                    val avatarRequest =
                        remember(avatarUrl, avatarPx) {
                            sizedImageRequest(context, avatarUrl, avatarPx)
                        }
                    AsyncImage(
                        model = avatarRequest,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }
            }
        }

        Spacer(Modifier.height(62.dp))

        Text(
            text = serverName.ifBlank { "Сервер" },
            color = DiscordText,
            fontSize = 26.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 20.dp),
        )

        Spacer(Modifier.height(6.dp))

        Text(
            text = subtitle,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .padding(bottom = 12.dp),
        )
    }
}

@Composable
private fun SettingsTabContent(
    activeTab: ServerSettingsTab,
    canManageServer: Boolean,
    canManageRoles: Boolean,
    canKickMembers: Boolean,
    canManageMemberRoles: Boolean,
    canAddMembers: Boolean,
    state: com.whithin.voice.presentation.viewmodel.ServerSettingsUiState,
    userId: String,
    pickAvatar: ActivityResultLauncher<PickVisualMediaRequest>,
    pickBanner: ActivityResultLauncher<PickVisualMediaRequest>,
    viewModel: ServerSettingsViewModel,
    embeddedInParentScroll: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier) {
    when (activeTab) {
        ServerSettingsTab.PROFILE -> {
            if (!canManageServer) {
                NoPermissionBox("У вас нет прав для управления профилем сервера")
            } else {
                ProfileTabContent(
                    state = state,
                    pickAvatar = pickAvatar,
                    pickBanner = pickBanner,
                    viewModel = viewModel,
                    embeddedInParentScroll = embeddedInParentScroll,
                )
            }
        }

        ServerSettingsTab.MEMBERS -> MembersTabContent(
            members = state.members,
            isLoading = state.isMembersLoading,
            canManageMemberRoles = canManageMemberRoles,
            canKickMembers = canKickMembers,
            canChangeOwnNickname = viewModel.canChangeOwnNickname(),
            canManageNicknames = viewModel.canManageNicknames(),
            canAddMembers = canAddMembers,
            currentUserId = userId,
            onAddMember = { viewModel.showAddMemberPicker(true) },
            onManageRoles = { viewModel.showRolePicker(it) },
            onKick = { viewModel.showKickDialog(it) },
            onEditNickname = viewModel::showNicknameDialog,
            embeddedInParentScroll = embeddedInParentScroll,
        )

        ServerSettingsTab.ROLES -> {
            if (!canManageRoles) {
                NoPermissionBox("У вас нет прав для управления ролями")
            } else {
                ServerRoleManagementPanel(
                    roles = state.roles,
                    isLoading = state.isRolesLoading,
                    searchQuery = state.roleSearchQuery,
                    onSearchChange = viewModel::onRoleSearchChange,
                    onCreateNew = { viewModel.openRoleEditor(null) },
                    onEditRole = viewModel::openRoleEditor,
                    onDeleteRole = viewModel::deleteRole,
                    embeddedInParentScroll = embeddedInParentScroll,
                )
            }
        }

        ServerSettingsTab.AUDIT -> {
            if (!canManageServer) {
                NoPermissionBox("У вас нет прав для просмотра журнала аудита")
            } else {
                ServerAuditLogPanel(
                    entries = state.auditEntries,
                    totalCount = state.auditTotalCount,
                    isLoading = state.isAuditLoading,
                    actionFilter = state.auditActionFilter,
                    onActionFilterChange = viewModel::onAuditActionFilterChange,
                    onLoadMore = viewModel::loadMoreAudit,
                    embeddedInParentScroll = embeddedInParentScroll,
                )
            }
        }
    }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProfileTabContent(
    state: com.whithin.voice.presentation.viewmodel.ServerSettingsUiState,
    pickAvatar: ActivityResultLauncher<PickVisualMediaRequest>,
    pickBanner: ActivityResultLauncher<PickVisualMediaRequest>,
    viewModel: ServerSettingsViewModel,
    embeddedInParentScroll: Boolean = false,
) {
    val server = state.server
    val bannerUrl = resolveServerIconUrl(server?.bannerPathValue)
    val avatarUrl = resolveServerIconUrl(server?.avatarPathValue)
    val bannerTint = remember(state.bannerColor) {
        runCatching { Color(android.graphics.Color.parseColor(state.bannerColor)) }.getOrDefault(Color(0xFF3F3F3F))
    }
    val context = LocalContext.current
    val density = LocalDensity.current
    val profileAvatarPx = with(density) { 64.dp.roundToPx() }
    val profileBannerH = with(density) { 120.dp.roundToPx() }

    val scrollModifier =
        if (embeddedInParentScroll) {
            Modifier.fillMaxWidth()
        } else {
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        }

    Column(
        modifier = scrollModifier
            .padding(bottom = if (embeddedInParentScroll) 8.dp else 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ProfileSettingsCard(title = "Имя сервера") {
            OutlinedTextField(
                value = state.serverName,
                onValueChange = viewModel::onServerNameChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !state.isSavingName,
            )
            ProfileTextAction(
                label = if (state.isSavingName) "Сохранение…" else "Сохранить",
                enabled = !state.isSavingName,
                onClick = viewModel::updateServerName,
            )
        }

        ProfileSettingsCard(title = "Значок") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(TelegramMessageUi.AccentBlue),
                    contentAlignment = Alignment.Center,
                ) {
                    if (avatarUrl != null) {
                        val avatarRequest =
                            remember(avatarUrl, profileAvatarPx) {
                                sizedImageRequest(context, avatarUrl, profileAvatarPx)
                            }
                        AsyncImage(
                            model = avatarRequest,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Text(
                            state.serverName.firstOrNull()?.uppercaseChar()?.toString() ?: "С",
                            color = DiscordText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp,
                        )
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    ProfileTextAction(
                        label = "Изменить значок",
                        enabled = !state.isAvatarLoading,
                        onClick = {
                            pickAvatar.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                    )
                    if (avatarUrl != null) {
                        ProfileTextAction(
                            label = "Удалить значок",
                            enabled = !state.isAvatarLoading,
                            onClick = viewModel::deleteAvatar,
                            danger = true,
                        )
                    }
                }
            }
        }

        ProfileSettingsCard(title = "Баннер") {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(bannerTint)
                    .clickable {
                        pickBanner.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
            ) {
                if (bannerUrl != null) {
                    val bannerRequest =
                        remember(bannerUrl, profileBannerH) {
                            sizedImageRequest(context, bannerUrl, 1080, profileBannerH)
                        }
                    AsyncImage(
                        model = bannerRequest,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize().alpha(0.85f),
                        contentScale = ContentScale.Crop,
                    )
                }
                if (state.isBannerLoading) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.35f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary, strokeWidth = 2.dp)
                    }
                }
            }
            ProfileTextAction(
                label = "Изменить баннер",
                enabled = !state.isBannerLoading,
                onClick = {
                    pickBanner.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                },
            )
            if (bannerUrl != null) {
                ProfileTextAction(
                    label = "Удалить баннер",
                    enabled = !state.isBannerLoading,
                    onClick = viewModel::deleteBanner,
                    danger = true,
                )
            }
            Text("Цвет фона", color = DiscordText, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BannerPalette.forEach { hex ->
                    val color = remember(hex) {
                        runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color.Gray)
                    }
                    val selected = !state.isDefaultBannerColor && state.bannerColor.equals(hex, true)
                    Box(
                        Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(color)
                            .border(
                                if (selected) 2.dp else 1.dp,
                                if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.outline,
                                CircleShape,
                            )
                            .clickable { viewModel.onBannerColorSelected(hex) },
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                ProfileTextAction(label = "Дефолт", onClick = viewModel::resetBannerColorToDefault)
                ProfileTextAction(label = "Сохранить цвет", onClick = viewModel::saveBannerColor)
            }
        }
    }
}

private val MemberListAvatarSize = ProfileMediaSpecs.MEMBER_LIST_AVATAR_DP
/** Max decorated avatar width (40dp × 1.28) — aligns action buttons with chat-list decoration. */
private val MemberListAvatarSlotSize = ProfileMediaSpecs.MEMBER_LIST_AVATAR_SLOT_DP
private val MemberNameplateTextColor = Color(0xFFF2F3F5)

private fun LazyListScope.embeddedMembersTabItems(
    members: List<ServerMemberInfo>,
    filteredMembers: List<ServerMemberInfo>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onClearSearch: () -> Unit,
    isLoading: Boolean,
    canManageMemberRoles: Boolean,
    canKickMembers: Boolean,
    canChangeOwnNickname: Boolean,
    canManageNicknames: Boolean,
    canAddMembers: Boolean,
    currentUserId: String,
    onAddMember: () -> Unit,
    onManageRoles: (ServerMemberInfo) -> Unit,
    onKick: (ServerMemberInfo) -> Unit,
    onEditNickname: (ServerMemberInfo) -> Unit,
) {
    when {
        isLoading && members.isEmpty() -> {
            item(key = "members-loading") {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    ServerLoadingState()
                }
            }
        }
        members.isEmpty() -> {
            item(key = "members-empty") {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    ServerEmptyState(
                        hint = "Нет участников",
                        sub = "Участники сервера появятся здесь",
                        icon = Icons.Default.People,
                    )
                }
            }
        }
        else -> {
            item(key = "members-card-header") {
                ProfileMediaLogger.d("members tab render count=${members.size}")
                MembersSectionCardHeader(
                    searchQuery = searchQuery,
                    onSearchQueryChange = onSearchQueryChange,
                    onClearSearch = onClearSearch,
                    canAddMembers = canAddMembers,
                    onAddMember = onAddMember,
                    shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
                )
            }
            if (filteredMembers.isEmpty()) {
                item(key = "members-search-empty") {
                    MembersSectionCardRow(showDivider = true) {
                        ServerEmptyState(
                            hint = "Никого не найдено",
                            sub = "Измените запрос или очистите поиск",
                            icon = Icons.Default.People,
                        )
                    }
                }
            } else {
            items(
                count = filteredMembers.size,
                key = { index ->
                    val memberId = filteredMembers[index].userIdValue
                    if (memberId.isNotBlank()) "member-$memberId" else "member-$index"
                },
            ) { index ->
                MembersSectionCardRow(showDivider = index > 0) {
                    val member = filteredMembers[index]
                    ServerMemberRow(
                        member = member,
                        canManageMemberRoles = canManageMemberRoles,
                        canKickMembers = canKickMembers,
                        canChangeOwnNickname = canChangeOwnNickname,
                        canManageNicknames = canManageNicknames,
                        isSelf = member.userIdValue.equals(currentUserId, ignoreCase = true),
                        onManageRoles = { onManageRoles(member) },
                        onKick = { onKick(member) },
                        onEditNickname = { onEditNickname(member) },
                    )
                }
            }
            }
            item(key = "members-card-footer") {
                MembersSectionCardFooter(
                    filteredCount = filteredMembers.size,
                    totalCount = members.size,
                )
            }
        }
    }
}

@Composable
private fun MembersSectionCardHeader(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onClearSearch: () -> Unit,
    canAddMembers: Boolean,
    onAddMember: () -> Unit,
    shape: RoundedCornerShape = RoundedCornerShape(16.dp),
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        color = DiscordModalCard,
        shape = shape,
    ) {
        Column {
            MembersSectionTitleRow(
                canAddMembers = canAddMembers,
                onAddMember = onAddMember,
            )
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp)
                    .padding(bottom = 10.dp),
                singleLine = true,
                placeholder = { Text("Поиск по имени пользователя") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = DiscordTextSecondary,
                    )
                },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        IconButton(onClick = onClearSearch) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = "Очистить поиск",
                                tint = DiscordTextSecondary,
                            )
                        }
                    }
                },
            )
        }
    }
}

@Composable
private fun MemberRolePill(roleName: String, roleColorHex: String) {
    val color =
        runCatching { Color(android.graphics.Color.parseColor(roleColorHex)) }
            .getOrDefault(Color(0xFF99AAB5))
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.16f))
            .border(1.dp, color.copy(alpha = 0.32f), RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(color),
        )
        Text(
            text = roleName,
            color = color,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun MembersSectionTitleRow(
    canAddMembers: Boolean,
    onAddMember: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Участники",
            color = DiscordText,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        if (canAddMembers) {
            IconButton(onClick = onAddMember) {
                Icon(
                    Icons.Default.GroupAdd,
                    contentDescription = "Добавить участника",
                    tint = TelegramMessageUi.AccentBlue,
                )
            }
        }
    }
}

@Composable
private fun MembersSectionCardRow(
    showDivider: Boolean,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp)
                .background(DiscordModalCard),
    ) {
        if (showDivider) {
            HorizontalDivider(
                color = MaterialTheme.colorScheme.outline,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
        content()
    }
}

@Composable
private fun MembersSectionCardFooter(
    filteredCount: Int,
    totalCount: Int,
) {
    Surface(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp)
                .padding(bottom = 16.dp),
        color = DiscordModalCard,
        shape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp),
    ) {
        Text(
            text =
                if (filteredCount == totalCount) {
                    "Показаны $filteredCount участников"
                } else {
                    "Показаны $filteredCount из $totalCount участников"
                },
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun MembersTabContent(
    members: List<ServerMemberInfo>,
    isLoading: Boolean,
    canManageMemberRoles: Boolean,
    canKickMembers: Boolean,
    canChangeOwnNickname: Boolean,
    canManageNicknames: Boolean,
    canAddMembers: Boolean,
    currentUserId: String,
    onAddMember: () -> Unit,
    onManageRoles: (ServerMemberInfo) -> Unit,
    onKick: (ServerMemberInfo) -> Unit,
    onEditNickname: (ServerMemberInfo) -> Unit,
    embeddedInParentScroll: Boolean = false,
) {
    when {
        isLoading && members.isEmpty() -> ServerLoadingState()
        members.isEmpty() -> ServerEmptyState(
            hint = "Нет участников",
            sub = "Участники сервера появятся здесь",
            icon = Icons.Default.People,
        )
        else -> {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                color = DiscordModalCard,
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                ) {
                    MembersSectionTitleRow(
                        canAddMembers = canAddMembers,
                        onAddMember = onAddMember,
                    )

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false),
                        contentPadding = PaddingValues(bottom = 12.dp),
                    ) {
                        items(
                            members.size,
                            key = { index ->
                                val memberId = members[index].userIdValue
                                if (memberId.isNotBlank()) "$memberId-$index" else "member-$index"
                            },
                        ) { index ->
                            if (index > 0) {
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                            val member = members[index]
                            ServerMemberRow(
                                member = member,
                                canManageMemberRoles = canManageMemberRoles,
                                canKickMembers = canKickMembers,
                                canChangeOwnNickname = canChangeOwnNickname,
                                canManageNicknames = canManageNicknames,
                                isSelf = member.userIdValue.equals(currentUserId, ignoreCase = true),
                                onManageRoles = { onManageRoles(member) },
                                onKick = { onKick(member) },
                                onEditNickname = { onEditNickname(member) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ServerMemberRow(
    member: ServerMemberInfo,
    canManageMemberRoles: Boolean,
    canKickMembers: Boolean,
    canChangeOwnNickname: Boolean,
    canManageNicknames: Boolean,
    isSelf: Boolean,
    onManageRoles: () -> Unit,
    onKick: () -> Unit,
    onEditNickname: () -> Unit,
) {
    val canEditNickname = if (isSelf) canChangeOwnNickname else canManageNicknames
    val showActions = canEditNickname || (!isSelf && (canManageMemberRoles || canKickMembers))
    val hasNameplate = !member.nameplateValue.isNullOrBlank()
    var showActionsSheet by remember(member.userIdValue) { mutableStateOf(false) }
    val avatarColor = member.avatarColorValue?.let {
        runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
    } ?: TelegramMessageUi.AccentBlue
    val memberNameStyle =
        if (hasNameplate) {
            TextStyle(
                shadow =
                    Shadow(
                        color = Color.Black.copy(alpha = 0.62f),
                        offset = Offset(0f, 2.5f),
                        blurRadius = 5f,
                    ),
            )
        } else {
            TextStyle.Default
        }

    DisposableEffect(member.userIdValue, member.avatarDecorationValue) {
        ProfileMediaLogger.d(
            "member row user=${member.usernameValue} id=${member.userIdValue} " +
                "decoration=${member.avatarDecorationValue}",
        )
        onDispose {
            ProfileMediaLogger.d("member row dispose id=${member.userIdValue}")
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.weight(1f)) {
                UserNameplate(
                    nameplate = member.nameplateValue,
                    modifier = Modifier.fillMaxWidth(),
                    playAnimation = false,
                    contentPadding =
                        if (hasNameplate) {
                            PaddingValues(start = MemberListAvatarSlotSize + 8.dp, end = 10.dp, top = 6.dp, bottom = 6.dp)
                        } else {
                            PaddingValues(start = MemberListAvatarSlotSize + 8.dp, end = 0.dp, top = 0.dp, bottom = 0.dp)
                        },
                ) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .then(
                                    if (hasNameplate) {
                                        Modifier
                                    } else {
                                        Modifier.padding(start = MemberListAvatarSlotSize + 8.dp)
                                    },
                                ),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = member.usernameValue,
                            color = if (hasNameplate) MemberNameplateTextColor else DiscordText,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            style = memberNameStyle,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        if (member.rolesValue.isNotEmpty()) {
                            Row(
                                modifier = Modifier
                                    .padding(start = 8.dp)
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                member.rolesValue.forEach { role ->
                                    MemberRolePill(
                                        roleName = role.roleNameValue,
                                        roleColorHex = role.colorValue,
                                    )
                                }
                            }
                        }
                        if (showActions) {
                            IconButton(onClick = { showActionsSheet = true }) {
                                Icon(
                                    imageVector = Icons.Default.MoreVert,
                                    contentDescription = "Действия",
                                    tint = DiscordTextSecondary,
                                )
                            }
                        }
                    }
                }
                Box(
                    modifier = Modifier.width(MemberListAvatarSlotSize),
                    contentAlignment = Alignment.Center,
                ) {
                    AvatarWithPresenceIndicator(
                        name = member.usernameValue,
                        avatarUrl = resolveServerIconUrl(member.avatarPathValue),
                        avatarColor = avatarColor,
                        status = member.userStatus ?: member.userStatusAlt,
                        size = MemberListAvatarSize,
                        avatarDecoration = member.avatarDecorationValue,
                        animateDecoration = false,
                    )
                }
            }
        }
        if (showActionsSheet && showActions) {
            MemberActionsBottomSheet(
                member = member,
                isSelf = isSelf,
                canEditNickname = canEditNickname,
                canManageMemberRoles = canManageMemberRoles,
                canKickMembers = canKickMembers,
                onDismiss = { showActionsSheet = false },
                onEditNickname = {
                    showActionsSheet = false
                    onEditNickname()
                },
                onManageRoles = {
                    showActionsSheet = false
                    onManageRoles()
                },
                onKick = {
                    showActionsSheet = false
                    onKick()
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MemberActionsBottomSheet(
    member: ServerMemberInfo,
    isSelf: Boolean,
    canEditNickname: Boolean,
    canManageMemberRoles: Boolean,
    canKickMembers: Boolean,
    onDismiss: () -> Unit,
    onEditNickname: () -> Unit,
    onManageRoles: () -> Unit,
    onKick: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordModalCard,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = member.usernameValue,
                color = DiscordText,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            if (canEditNickname) {
                Text(
                    text = if (isSelf) "Мой серверный ник" else "Серверный ник",
                    color = TelegramMessageUi.AccentBlue,
                    fontSize = 16.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onEditNickname)
                        .padding(vertical = 12.dp),
                )
            }
            if (!isSelf && canManageMemberRoles) {
                Text(
                    text = "Роли",
                    color = TelegramMessageUi.AccentBlue,
                    fontSize = 16.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onManageRoles)
                        .padding(vertical = 12.dp),
                )
            }
            if (!isSelf && canKickMembers) {
                Text(
                    text = "Удалить с сервера",
                    color = DiscordError,
                    fontSize = 16.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onKick)
                        .padding(vertical = 12.dp),
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

@Composable
private fun RolesTabContent(
    roles: List<ServerRoleInfo>,
    isLoading: Boolean,
    onCreateRole: () -> Unit,
    onDeleteRole: (String) -> Unit,
) {
    when {
        isLoading && roles.isEmpty() -> ServerLoadingState()
        roles.isEmpty() -> ServerEmptyState(
            hint = "Нет ролей",
            sub = "Создайте первую роль для сервера",
            icon = Icons.Default.Security,
            actionLabel = "Создать роль",
            onAction = onCreateRole,
        )
        else -> {
            Surface(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                color = DiscordModalCard,
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Роли",
                            color = DiscordText,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = "Создать",
                            color = TelegramMessageUi.AccentBlue,
                            fontSize = 15.sp,
                            modifier = Modifier.clickable(onClick = onCreateRole),
                        )
                    }

                    LazyColumn(Modifier.fillMaxWidth()) {
                        items(roles.size, key = { roles[it].roleIdValue }) { index ->
                            if (index > 0) {
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                            val role = roles[index]
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    Modifier
                                        .size(14.dp)
                                        .clip(CircleShape)
                                        .background(
                                            runCatching {
                                                Color(android.graphics.Color.parseColor(role.colorValue))
                                            }.getOrDefault(Color.Gray),
                                        ),
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    text = role.roleNameValue,
                                    color = DiscordText,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.weight(1f),
                                )
                                IconButton(onClick = { onDeleteRole(role.roleIdValue) }) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = "Удалить",
                                        tint = DiscordError,
                                        modifier = Modifier.size(20.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileSettingsCard(
    title: String,
    content: @Composable () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        color = DiscordModalCard,
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = title,
                color = DiscordText,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
            )
            content()
        }
    }
}

@Composable
private fun ProfileTextAction(
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    danger: Boolean = false,
) {
    val color = when {
        !enabled -> MaterialTheme.colorScheme.onSurfaceVariant
        danger -> DiscordError
        else -> TelegramMessageUi.AccentBlue
    }
    Text(
        text = label,
        color = color,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.clickable(enabled = enabled, onClick = onClick),
    )
}

@Composable
private fun ServerLoadingState() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            color = TelegramMessageUi.AccentBlue,
            strokeWidth = 2.dp,
        )
    }
}

@Composable
private fun ServerEmptyState(
    hint: String,
    sub: String,
    icon: ImageVector,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp, horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = DiscordTextSecondary, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(text = hint, color = DiscordText, fontSize = 16.sp, fontWeight = FontWeight.Medium)
        Text(
            text = sub,
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 6.dp),
            textAlign = TextAlign.Center,
        )
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(12.dp))
            Text(
                text = actionLabel,
                color = TelegramMessageUi.AccentBlue,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}

@Composable
private fun MemberRolesDialog(
    member: ServerMemberInfo,
    roles: List<ServerRoleInfo>,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onToggle: (roleId: String, assign: Boolean) -> Unit,
) {
    val assignedIds = member.rolesValue.map { it.roleIdValue }.toSet()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Роли — ${member.usernameValue}") },
        text = {
            if (isLoading) {
                Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(24.dp))
                }
            } else if (roles.isEmpty()) {
                Text("Сначала создайте роли во вкладке «Роли»")
            } else {
                Column {
                    roles.forEach { role ->
                        val checked = assignedIds.contains(role.roleIdValue)
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable { onToggle(role.roleIdValue, !checked) }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(checked = checked, onCheckedChange = { onToggle(role.roleIdValue, it) })
                            Box(
                                Modifier
                                    .size(12.dp)
                                    .clip(CircleShape)
                                    .background(
                                        runCatching {
                                            Color(android.graphics.Color.parseColor(role.colorValue))
                                        }.getOrDefault(Color.Gray),
                                    ),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(role.roleNameValue)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Готово") } },
    )
}

@Composable
private fun NoPermissionBox(message: String) {
    ServerEmptyState(
        hint = "Нет доступа",
        sub = message,
        icon = Icons.Default.Security,
    )
}

@Composable
fun ServerSettingsScreen(
    authViewModel: AuthViewModel,
    onBack: () -> Unit,
    viewModel: ServerSettingsViewModel = hiltViewModel(),
) {
    val authState by authViewModel.uiState.collectAsUiState()
    LaunchedEffect(authState.user?.id) {
        authState.user?.id?.let { viewModel.initialize(it) }
    }
    ServerSettingsPanel(
        serverId = viewModel.activeServerId,
        userId = authState.user?.id.orEmpty(),
        onClose = onBack,
        viewModel = viewModel,
    )
}
