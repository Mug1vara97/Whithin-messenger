package com.whithin.voice.presentation.ui.screens

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.HeadsetOff
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.TextButton
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.zIndex
import com.whithin.voice.presentation.ui.components.AddServerMemberBottomSheet
import com.whithin.voice.presentation.ui.components.VoiceChannelParticipantRow
import com.whithin.voice.presentation.ui.components.ChannelSettingsBottomSheet
import com.whithin.voice.presentation.ui.components.CreateCategoryBottomSheet
import com.whithin.voice.presentation.ui.components.CreateChannelBottomSheet
import com.whithin.voice.presentation.ui.components.CategorySettingsBottomSheet
import com.whithin.voice.presentation.ui.components.ServerPanelContextMenuSheet
import com.whithin.voice.presentation.ui.components.ServerContextMenuBottomSheet
import com.whithin.voice.presentation.ui.components.countOnlineMembers
import com.whithin.voice.presentation.viewmodel.FriendViewModel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.data.model.Category
import com.whithin.voice.data.model.sortedForServerDisplay
import com.whithin.voice.data.model.Channel
import com.whithin.voice.data.model.ServerDetail
import com.whithin.voice.data.model.VoiceChannelParticipant
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.ui.theme.DiscordBackground
import com.whithin.voice.presentation.ui.theme.DiscordModalBackground
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordTabSelected
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import androidx.compose.material3.MaterialTheme
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import android.graphics.Color as AndroidColor

import com.whithin.voice.presentation.viewmodel.ServerSetupContinueAction
import com.whithin.voice.presentation.viewmodel.ServerViewModel

private val ChannelRowShape = RoundedCornerShape(6.dp)
private const val MEDIA_ORIGIN = "https://whithin.ru"

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ServerScreen(
    serverId: String,
    currentUserId: String = "",
    selectedChannelId: String? = null,
    onChannelSelected: (String, String) -> Unit,
    onVoiceChannelSelected: (String, String, String, String) -> Unit = { _, _, _, _ -> },
    onIdeasBoardSelected: (String, String) -> Unit = { _, _ -> },
    onNewsSelected: (String, String) -> Unit = { _, _ -> },
    onServerLeftOrDeleted: () -> Unit = {},
    onOpenServerSettings: () -> Unit = {},
    onChannelDeleted: (String) -> Unit = {},
    refreshToken: Int = 0,
    serverViewModel: ServerViewModel = hiltViewModel(),
    friendViewModel: FriendViewModel = hiltViewModel(),
) {
    val uiState by serverViewModel.uiState.collectAsUiState()
    val friendState by friendViewModel.uiState.collectAsUiState()
    val snackbarHostState = remember { SnackbarHostState() }

    var showServerMenu by remember { mutableStateOf(false) }
    var showLeaveConfirm by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showAddMemberSheet by remember { mutableStateOf(false) }

    LaunchedEffect(serverId, currentUserId, refreshToken) {
        serverViewModel.loadServer(serverId, currentUserId)
    }

    LaunchedEffect(showAddMemberSheet, currentUserId) {
        if (showAddMemberSheet && currentUserId.isNotBlank()) {
            friendViewModel.load(currentUserId)
            serverViewModel.loadServerMenuMembers()
        }
    }

    LaunchedEffect(uiState.actionMessage) {
        uiState.actionMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            serverViewModel.consumeActionMessage()
        }
    }

    LaunchedEffect(uiState.error) {
        uiState.error?.let { message ->
            snackbarHostState.showSnackbar(message)
            serverViewModel.clearError()
        }
    }

    LaunchedEffect(showServerMenu) {
        if (showServerMenu) {
            serverViewModel.loadServerMenuMembers()
        }
    }

    if (showServerMenu && uiState.server != null) {
        val server = uiState.server!!
        val categories = server.categoriesValue
        val channelCount = categories.sumOf { it.chatsValue.size }
        val memberCount = uiState.serverMenuMembers.size
        val onlineCount = countOnlineMembers(uiState.serverMenuMembers)

        ServerContextMenuBottomSheet(
            server = server,
            memberCount = memberCount,
            onlineCount = onlineCount,
            isMembersLoading = uiState.isServerMenuMembersLoading,
            channelCount = channelCount,
            canManageServer = serverViewModel.canManageServer(),
            canManageChannels = serverViewModel.canManageChannels(),
            canCreateInvites = serverViewModel.canCreateInvites(),
            isOwner = serverViewModel.isCurrentUserOwner(),
            onDismiss = { showServerMenu = false },
            onInvite = { showAddMemberSheet = true },
            onOpenSettings = onOpenServerSettings,
            onCreateChannel = { serverViewModel.openCreateChannelSheet() },
            onCreateCategory = serverViewModel::openCreateCategorySheet,
            onSetupContinue = {
                when (
                    serverViewModel.resolveSetupContinueAction(
                        memberCount = memberCount,
                        channelCount = channelCount,
                    )
                ) {
                    ServerSetupContinueAction.INVITE_MEMBERS -> showAddMemberSheet = true
                    ServerSetupContinueAction.CREATE_CHANNEL -> serverViewModel.openCreateChannelSheet()
                    ServerSetupContinueAction.OPEN_SETTINGS -> onOpenServerSettings()
                }
            },
            onLeave = { showLeaveConfirm = true },
            onDelete = { showDeleteConfirm = true },
        )
    }

    if (uiState.showDeleteChannelConfirm) {
        val channelName = uiState.channelSettings?.channel?.nameValue.orEmpty()
        AlertDialog(
            onDismissRequest = { serverViewModel.showDeleteChannelConfirm(false) },
            title = { Text("Удалить канал") },
            text = { Text("Удалить канал \"$channelName\"? Это действие нельзя отменить.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        serverViewModel.deleteChannel { deletedId ->
                            onChannelDeleted(deletedId)
                        }
                    },
                    enabled = !uiState.actionInProgress,
                ) {
                    Text("Удалить", color = Color(0xFFFF453A))
                }
            },
            dismissButton = {
                TextButton(onClick = { serverViewModel.showDeleteChannelConfirm(false) }) {
                    Text("Отмена")
                }
            },
        )
    }

    if (uiState.showDeleteCategoryConfirm) {
        val categoryName = uiState.categorySettings?.categoryNameValue.orEmpty()
        AlertDialog(
            onDismissRequest = { serverViewModel.showDeleteCategoryConfirm(false) },
            title = { Text("Удалить категорию") },
            text = { Text("Удалить категорию \"$categoryName\" и все каналы в ней?") },
            confirmButton = {
                TextButton(
                    onClick = { serverViewModel.deleteCategory() },
                    enabled = !uiState.actionInProgress,
                ) {
                    Text("Удалить", color = Color(0xFFFF453A))
                }
            },
            dismissButton = {
                TextButton(onClick = { serverViewModel.showDeleteCategoryConfirm(false) }) {
                    Text("Отмена")
                }
            },
        )
    }

    if (uiState.showPanelContextMenu) {
        ServerPanelContextMenuSheet(
            onDismiss = serverViewModel::closePanelContextMenu,
            onCreateChannel = { serverViewModel.openCreateChannelSheet() },
            onCreateCategory = serverViewModel::openCreateCategorySheet,
        )
    }

    if (uiState.createCategorySheet) {
        CreateCategoryBottomSheet(
            roles = uiState.channelSettingsRoles,
            members = uiState.channelSettingsMembers,
            currentUserId = currentUserId,
            isLoading = uiState.isChannelSettingsLoading,
            isSaving = uiState.actionInProgress,
            onDismiss = serverViewModel::closeCreateCategorySheet,
            onCreate = serverViewModel::createCategory,
        )
    }

    uiState.createChannelSheet?.let { target ->
        CreateChannelBottomSheet(
            categories = uiState.server?.categoriesValue.orEmpty(),
            members = uiState.channelSettingsMembers,
            currentUserId = currentUserId,
            presetCategoryId = target.categoryId,
            isLoading = uiState.isChannelSettingsLoading,
            isSaving = uiState.actionInProgress,
            onDismiss = serverViewModel::closeCreateChannelSheet,
            onCreate = serverViewModel::createChannel,
        )
    }

    uiState.categorySettings?.let { category ->
        CategorySettingsBottomSheet(
            category = category,
            roles = uiState.channelSettingsRoles,
            members = uiState.channelSettingsMembers,
            currentUserId = currentUserId,
            isLoading = uiState.isChannelSettingsLoading,
            isSaving = uiState.actionInProgress,
            onDismiss = serverViewModel::closeCategorySettings,
            onSave = serverViewModel::saveCategorySettings,
            onDeleteRequest = { serverViewModel.showDeleteCategoryConfirm(true) },
        )
    }

    uiState.channelSettings?.let { settings ->
        ChannelSettingsBottomSheet(
            channel = settings.channel,
            roles = uiState.channelSettingsRoles,
            members = uiState.channelSettingsMembers,
            currentUserId = currentUserId,
            isLoading = uiState.isChannelSettingsLoading,
            isSaving = uiState.actionInProgress,
            onDismiss = serverViewModel::closeChannelSettings,
            onSave = serverViewModel::saveChannelSettings,
            onDeleteRequest = { serverViewModel.showDeleteChannelConfirm(true) },
        )
    }

    if (showLeaveConfirm) {
        AlertDialog(
            onDismissRequest = { showLeaveConfirm = false },
            title = { Text("Покинуть сервер") },
            text = { Text("Вы уверены, что хотите покинуть этот сервер?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLeaveConfirm = false
                        serverViewModel.leaveServer(onServerLeftOrDeleted)
                    },
                    enabled = !uiState.actionInProgress,
                ) {
                    Text("Покинуть", color = Color(0xFFFF453A))
                }
            },
            dismissButton = {
                TextButton(onClick = { showLeaveConfirm = false }) {
                    Text("Отмена")
                }
            },
        )
    }

    if (showDeleteConfirm) {
        val serverName = uiState.server?.nameValue.orEmpty()
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Удалить сервер") },
            text = {
                Text("Вы уверены, что хотите удалить сервер \"$serverName\"? Это действие нельзя отменить.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        serverViewModel.deleteServer(onServerLeftOrDeleted)
                    },
                    enabled = !uiState.actionInProgress,
                ) {
                    Text("Удалить", color = Color(0xFFFF453A))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Отмена")
                }
            },
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DiscordBackground),
    ) {
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .zIndex(2f),
        )
        when {
            uiState.isLoading -> {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.primary,
                        strokeWidth = 3.dp,
                        modifier = Modifier.size(40.dp)
                    )
                    Text(
                        text = "Загрузка сервера…",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 13.sp
                    )
                }
            }

            uiState.error != null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = uiState.error ?: "Ошибка загрузки",
                        color = Color(0xFFF04747),
                        fontSize = 16.sp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { serverViewModel.loadServer(serverId, currentUserId) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text("Повторить")
                    }
                }
            }

            uiState.server == null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Сервер не найден",
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            else -> {
                val server = uiState.server!!
                val categories = server.categoriesValue.sortedForServerDisplay()

                val canManageChannels = serverViewModel.canManageChannels()
                val channelCount = categories.sumOf { it.chatsValue.size }

                Box(modifier = Modifier.fillMaxSize()) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        ServerBannerHeader(
                            server = server,
                            channelCount = channelCount,
                            menuExpanded = showServerMenu,
                            onMenuClick = { showServerMenu = !showServerMenu },
                        )

                        LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        items(
                            items = categories,
                            key = { it.categoryIdValue ?: "uncategorized" }
                        ) { category ->
                            CategorySection(
                                category = category,
                                channelParticipantsMap = uiState.voiceChannelParticipants,
                                selectedChannelId = selectedChannelId,
                                canManageChannels = canManageChannels,
                                modifier = Modifier.fillMaxWidth(),
                                onChannelClick = onChannelSelected,
                                onVoiceChannelClick = onVoiceChannelSelected,
                                onIdeasBoardClick = onIdeasBoardSelected,
                                onNewsClick = onNewsSelected,
                                onChannelLongClick = { channel ->
                                    serverViewModel.openChannelSettings(channel, category.categoryIdValue)
                                },
                                onCategoryLongClick = {
                                    if (!category.isUncategorizedValue) {
                                        serverViewModel.openCategorySettings(category)
                                    }
                                },
                            )
                        }
                        if (canManageChannels) {
                            item(key = "panel_context_anchor") {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(56.dp)
                                        .combinedClickable(
                                            onClick = {},
                                            onLongClick = serverViewModel::openPanelContextMenu,
                                        ),
                                )
                            }
                        }
                    }
                    }
                }
            }
        }

        AddServerMemberBottomSheet(
            visible = showAddMemberSheet,
            friends = friendState.friends,
            existingMemberIds = uiState.serverMenuMembers.map { it.userIdValue }.toSet(),
            isLoading = friendState.isLoading || uiState.isServerMenuMembersLoading,
            addingUserIds = uiState.addingMemberIds,
            error = uiState.error,
            onDismiss = {
                showAddMemberSheet = false
                serverViewModel.clearError()
            },
            onRefresh = {
                if (currentUserId.isNotBlank()) {
                    friendViewModel.load(currentUserId)
                }
                serverViewModel.loadServerMenuMembers()
            },
            onAddMember = { friend ->
                serverViewModel.addMember(friend.userIdValue)
            },
        )
    }
}

private fun resolveServerBannerUrl(path: String): String {
    val p = path.trim()
    return when {
        p.startsWith("http://") || p.startsWith("https://") -> p
        p.startsWith("/uploads/") -> "$MEDIA_ORIGIN$p"
        p.startsWith("uploads/") -> "$MEDIA_ORIGIN/$p"
        p.startsWith("/") -> "$MEDIA_ORIGIN$p"
        else -> "$MEDIA_ORIGIN/uploads/$p"
    }
}

private fun parseBannerHex(hex: String, fallback: Color): Color {
    return try {
        val h = hex.trim().let { if (it.startsWith("#")) it else "#$it" }
        Color(AndroidColor.parseColor(h))
    } catch (_: Exception) {
        fallback
    }
}

@Composable
private fun ServerBannerHeader(
    server: ServerDetail,
    channelCount: Int = 0,
    menuExpanded: Boolean = false,
    onMenuClick: () -> Unit = {},
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isHovered by interactionSource.collectIsHoveredAsState()

    val tintColor = remember(server.bannerColorValue) {
        parseBannerHex(server.bannerColorValue, Color(0xFF3F3F3F))
    }
    val bannerUrl = remember(server.bannerPathValue) {
        server.bannerPathValue?.takeIf { it.isNotBlank() }?.let(::resolveServerBannerUrl)
    }
    val avatarUrl = remember(server.avatarPathValue) {
        resolveServerIconUrl(server.avatarPathValue)
    }
    val hasBanner = bannerUrl != null || server.hasBannerSection
    val serverInfoHeight = 56.dp
    val bannerHeaderHeight = 128.dp
    val headerHeight =
        when {
            bannerUrl != null -> bannerHeaderHeight
            server.hasBannerSection -> bannerHeaderHeight
            else -> serverInfoHeight + 8.dp
        }
    val serverInitial = server.nameValue.firstOrNull()?.uppercaseChar()?.toString() ?: "S"
    val channelSubtitle =
        when (channelCount) {
            0 -> "Нет каналов"
            1 -> "1 канал"
            in 2..4 -> "$channelCount канала"
            else -> "$channelCount каналов"
        }
    val context = LocalContext.current
    val density = LocalDensity.current
    val bannerDecodeH = with(density) { bannerHeaderHeight.roundToPx() }
    val avatarDecodePx = with(density) { 40.dp.roundToPx() }

    Column(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(headerHeight)
        ) {
            if (!hasBanner) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.18f),
                                    DiscordBackground,
                                ),
                            ),
                        ),
                )
            } else if (bannerUrl != null) {
                Box(Modifier.fillMaxSize().background(tintColor))
                val bannerRequest =
                    remember(bannerUrl, bannerDecodeH) {
                        sizedImageRequest(context, bannerUrl, 1080, bannerDecodeH)
                    }
                AsyncImage(
                    model = bannerRequest,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxSize()
                        .alpha(0.82f),
                    contentScale = ContentScale.Crop,
                )
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Black.copy(alpha = 0.42f), Color.Transparent),
                                startY = 0f,
                                endY = 280f,
                            ),
                        ),
                )
            } else {
                Box(Modifier.fillMaxSize().background(tintColor))
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(MaterialTheme.colorScheme.primary.copy(alpha = 0.45f), tintColor),
                                startY = 0f,
                                endY = 360f,
                            ),
                        ),
                )
            }

            val titleBarBg =
                when {
                    !hasBanner ->
                        if (isHovered) Color(0x22000000) else Color.Transparent
                    isHovered ->
                        Color.Black.copy(alpha = 0.22f)
                    else ->
                        Color.Transparent
                }

            Row(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .height(serverInfoHeight)
                    .hoverable(interactionSource)
                    .clickable(onClick = onMenuClick)
                    .background(titleBarBg)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(DiscordModalCard),
                    contentAlignment = Alignment.Center,
                ) {
                    if (avatarUrl != null) {
                        val avatarRequest =
                            remember(avatarUrl, avatarDecodePx) {
                                sizedImageRequest(context, avatarUrl, avatarDecodePx)
                            }
                        AsyncImage(
                            model = avatarRequest,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Text(
                            text = serverInitial,
                            color = DiscordText,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }

                Spacer(Modifier.width(10.dp))

                Column(Modifier.weight(1f)) {
                    Text(
                        text = server.nameValue,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = DiscordText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = channelSubtitle,
                        fontSize = 12.sp,
                        color = DiscordTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                Icon(
                    imageVector = Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = DiscordTextSecondary,
                    modifier = Modifier
                        .size(22.dp)
                        .rotate(if (menuExpanded) 180f else 0f),
                )
            }
        }

        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun CategorySection(
    category: Category,
    channelParticipantsMap: Map<String, List<VoiceChannelParticipant>>,
    selectedChannelId: String?,
    canManageChannels: Boolean,
    modifier: Modifier = Modifier,
    onChannelClick: (String, String) -> Unit,
    onVoiceChannelClick: (String, String, String, String) -> Unit,
    onIdeasBoardClick: (String, String) -> Unit = { _, _ -> },
    onNewsClick: (String, String) -> Unit = { _, _ -> },
    onChannelLongClick: (Channel) -> Unit,
    onCategoryLongClick: () -> Unit,
) {
    var isCollapsed by remember(category.categoryIdValue) { mutableStateOf(false) }
    val label = category.headerLabelValue
    val showCategoryHeader = !label.isNullOrBlank()

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp)
            .padding(bottom = 12.dp),
    ) {
        if (showCategoryHeader) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (canManageChannels) {
                            Modifier.combinedClickable(
                                onClick = { isCollapsed = !isCollapsed },
                                onLongClick = onCategoryLongClick,
                            )
                        } else {
                            Modifier.clickable { isCollapsed = !isCollapsed }
                        },
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 2.dp, end = 8.dp, top = 14.dp, bottom = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(
                        imageVector = Icons.Default.ExpandMore,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .size(16.dp)
                            .rotate(if (isCollapsed) -90f else 0f)
                    )
                    Text(
                        text = label.orEmpty().uppercase(),
                        modifier = Modifier.weight(1f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 0.45.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (category.isPrivateValue) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Приватная категория",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.75f),
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            }
        }

        val showChannels = !showCategoryHeader || !isCollapsed
        if (showChannels) {
            val sortedChannels = category.chatsValue.sortedBy { it.chatOrderValue }
            val insetStart = when {
                showCategoryHeader -> 12.dp
                else -> 2.dp
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        start = insetStart,
                        top = when {
                            showCategoryHeader -> 4.dp
                            else -> 2.dp
                        },
                    ),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                sortedChannels.forEach { channel ->
                    ChannelItem(
                        channel = channel,
                        selected = channel.chatIdValue == selectedChannelId,
                        voiceParticipants = channelParticipantsMap[channel.chatIdValue].orEmpty(),
                        onClick = {
                            when {
                                channel.isVoiceChannel -> {
                                    onVoiceChannelClick(channel.chatIdValue, channel.nameValue, "", "")
                                }
                                channel.isIdeasBoardChannel -> {
                                    onIdeasBoardClick(channel.chatIdValue, channel.nameValue)
                                }
                                channel.isNewsChannel -> {
                                    onNewsClick(channel.chatIdValue, channel.nameValue)
                                }
                                else -> {
                                    onChannelClick(channel.chatIdValue, channel.nameValue)
                                }
                            }
                        },
                        onLongClick =
                            if (canManageChannels) {
                                { onChannelLongClick(channel) }
                            } else {
                                null
                            },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun ChannelItem(
    channel: Channel,
    selected: Boolean,
    voiceParticipants: List<VoiceChannelParticipant>,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null,
) {
    val nameColor =
        if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
    val glyphTint =
        nameColor.copy(alpha = if (selected) 1f else 0.92f)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick ?: {},
            ),
        shape = ChannelRowShape,
        color = if (selected) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.88f) else Color.Transparent,
        shadowElevation = 0.dp,
        tonalElevation = 0.dp,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (selected) {
                Box(
                    Modifier
                        .padding(vertical = 6.dp)
                        .width(3.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(2.dp))
                )
                Spacer(Modifier.width(6.dp))
            } else {
                Spacer(Modifier.width(9.dp))
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(vertical = 7.dp)
                    .padding(end = 6.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(
                        modifier = Modifier.width(22.dp),
                        contentAlignment = Alignment.CenterEnd
                    ) {
                        when {
                            channel.isTextChannel -> Text(
                                text = "#",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = glyphTint.copy(alpha = 0.82f),
                            )

                            channel.isIdeasBoardChannel -> Icon(
                                imageVector = Icons.Default.ContentPaste,
                                contentDescription = "Доска идей",
                                modifier = Modifier.size(16.dp),
                                tint = glyphTint.copy(alpha = 0.82f),
                            )

                            channel.isNewsChannel -> Icon(
                                imageVector = Icons.Default.Newspaper,
                                contentDescription = "Новости",
                                modifier = Modifier.size(16.dp),
                                tint = glyphTint.copy(alpha = 0.82f),
                            )

                            else -> Icon(
                                imageVector = Icons.Default.VolumeUp,
                                contentDescription = "Голосовой канал",
                                modifier = Modifier.size(16.dp),
                                tint = glyphTint.copy(alpha = 0.82f)
                            )
                        }
                    }

                    Text(
                        text = channel.nameValue.removePrefix("#").trim(),
                        fontSize = 15.sp,
                        lineHeight = 19.sp,
                        fontWeight =
                            if (selected) FontWeight.SemiBold else FontWeight.Medium,
                        color = nameColor,
                        modifier = Modifier.weight(1f, fill = false),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (channel.isPrivateValue) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Приватный канал",
                            tint = nameColor.copy(alpha = 0.72f),
                            modifier = Modifier.size(13.dp),
                        )
                    }
                }

                if (channel.isVoiceChannel && voiceParticipants.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 20.dp, top = 2.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        voiceParticipants.take(6).forEach { participant ->
                            VoiceChannelParticipantRow(
                                participant = participant,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        if (voiceParticipants.size > 6) {
                            Text(
                                text = "+${voiceParticipants.size - 6} еще",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}
