package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.whithin.voice.data.model.ChatDetailInfo
import com.whithin.voice.data.model.ChatLink
import com.whithin.voice.data.model.ChatParticipant
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.presentation.ui.media.MediaViewerItem
import com.whithin.voice.presentation.ui.media.MediaViewerState
import com.whithin.voice.presentation.ui.media.buildViewerStateFromMediaList
import androidx.compose.runtime.collectAsState
import com.whithin.voice.presentation.ui.components.AvatarWithPresenceIndicator
import com.whithin.voice.presentation.ui.components.UserNameplate
import com.whithin.voice.presentation.ui.media.buildAvatarDecorationMapFromMessages
import com.whithin.voice.presentation.ui.media.resolveAvatarDecoration
import com.whithin.voice.presentation.ui.media.resolveNameplate
import com.whithin.voice.presentation.ui.media.ProfileMediaSpecs
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordModalBackground
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.components.FloatingPillTabBar
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import androidx.compose.material3.MaterialTheme
import com.whithin.voice.presentation.ui.utils.formatPresenceLabel
import com.whithin.voice.presentation.viewmodel.ChatViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val MEDIA_BASE = "https://whithin.ru"
private val NameplateTextColor = Color(0xFFF2F3F5)

private sealed class ProfileTab(val label: String) {
    data object Participants : ProfileTab("Участники")
    data object Media : ProfileTab("Медиа")
    data object Video : ProfileTab("Видео")
    data object Files : ProfileTab("Файлы")
    data object Audio : ProfileTab("Аудио")
    data object Links : ProfileTab("Ссылки")
}

private fun buildMediaUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    return when {
        raw.startsWith("http://") || raw.startsWith("https://") -> raw
        raw.startsWith("content://") || raw.startsWith("file://") -> raw
        raw.startsWith("/uploads/") -> "$MEDIA_BASE$raw"
        raw.startsWith("uploads/") -> "$MEDIA_BASE/$raw"
        else -> "$MEDIA_BASE/uploads/$raw"
    }
}

private fun buildVideoUrl(file: MediaFile): String? =
    buildMediaUrl(file.filePathValue)

private fun buildThumbnailUrl(file: MediaFile): String? =
    buildMediaUrl(file.thumbnailPathValue)

private fun isBannerImage(bannerPath: String?): Boolean {
    if (bannerPath.isNullOrBlank() || bannerPath.startsWith("#")) return false
    val lower = bannerPath.lowercase()
    return lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".gif") ||
        lower.endsWith(".webp") ||
        lower.endsWith(".svg") ||
        lower.startsWith("http://") ||
        lower.startsWith("https://") ||
        lower.startsWith("/uploads/") ||
        lower.startsWith("uploads/") ||
        lower.startsWith("/api/") ||
        lower.startsWith("api/")
}

private fun parseBannerColor(bannerPath: String?): Color? {
    if (bannerPath.isNullOrBlank() || isBannerImage(bannerPath)) return null
    return runCatching { Color(android.graphics.Color.parseColor(bannerPath)) }
        .getOrNull()
}

private fun resolveBannerBackgroundColor(bannerPath: String?, fallbackColor: Color): Color {
    return parseBannerColor(bannerPath) ?: fallbackColor.copy(alpha = 0.4f)
}

private fun formatFileSize(bytes: Long): String {
    if (bytes <= 0L) return "—"
    val kb = bytes / 1024.0
    if (kb < 1024.0) return String.format("%.0f КБ", kb)
    val mb = kb / 1024.0
    return String.format("%.1f МБ", mb)
}

private fun formatMediaCreatedAt(raw: String): String {
    if (raw.isBlank()) return ""
    return runCatching {
        val zdt = Instant.parse(raw).atZone(ZoneId.systemDefault())
        val today = java.time.LocalDate.now(ZoneId.systemDefault())
        val date = zdt.toLocalDate()
        val time = zdt.format(DateTimeFormatter.ofPattern("HH:mm"))
        when {
            date == today -> "Сегодня, $time"
            date == today.minusDays(1) -> "Вчера, $time"
            date.year == today.year ->
                zdt.format(DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale("ru")))
            else ->
                zdt.format(DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale("ru")))
        }
    }.getOrDefault(raw.take(16))
}

private fun findParticipantForMedia(
    senderUsername: String,
    participants: List<ChatParticipant>,
): ChatParticipant? {
    if (senderUsername.isBlank()) return null
    return participants.find { it.usernameValue.equals(senderUsername, ignoreCase = true) }
}

@Composable
fun ChatInfoModal(
    visible: Boolean,
    onDismiss: () -> Unit,
    chatId: String,
    chatTitleFallback: String,
    chatViewModel: ChatViewModel,
    onDeletedChatExit: () -> Unit,
    onOpenChat: () -> Unit = onDismiss,
    onCallClick: (() -> Unit)? = null,
    enableCall: Boolean = false,
    isSavedMessagesOverride: Boolean = false,
    currentUserId: String = "",
    modifier: Modifier = Modifier,
) {
    val detail by chatViewModel.chatDetailInfo.collectAsState()
    val participants by chatViewModel.chatParticipants.collectAsState()
    val chatUiState by chatViewModel.uiState.collectAsState()
    val fetchedDecorations by chatViewModel.userAvatarDecorations.collectAsState()
    val fetchedNameplates by chatViewModel.userNameplates.collectAsState()
    val messageDecorationMap =
        remember(chatUiState.messages) {
            buildAvatarDecorationMapFromMessages(chatUiState.messages)
        }
    val chatsList by chatViewModel.chats.collectAsState()
    val chatMedia by chatViewModel.chatMediaFiles.collectAsState()
    val chatMediaLoading by chatViewModel.chatMediaLoading.collectAsState()
    val chatLinks by chatViewModel.chatLinks.collectAsState()
    val chatLinksLoading by chatViewModel.chatLinksLoading.collectAsState()
    val availableUsers by chatViewModel.groupAvailableUsers.collectAsState()
    val availableUsersLoading by chatViewModel.groupAvailableUsersLoading.collectAsState()
    val context = LocalContext.current

    val chatEntry =
        remember(chatsList, chatId) {
            chatsList.find { it.chatIdValue.equals(chatId, ignoreCase = true) }
        }
    val safeDetail =
        remember(detail, chatId) {
            detail?.takeIf { it.chatIdValue.equals(chatId, ignoreCase = true) }
        }
    val isSavedMessages =
        isSavedMessagesOverride ||
            chatId.equals(chatViewModel.savedMessagesChatId, ignoreCase = true) ||
            chatEntry?.isSavedMessagesValue == true ||
            safeDetail?.isSavedMessagesValue == true ||
            chatEntry?.usernameValue.equals("Избранное", ignoreCase = true) ||
            chatTitleFallback.equals("Избранное", ignoreCase = true)
    val isGroup = !isSavedMessages && safeDetail?.isGroupValue == true
    val isPrivateDirectChat =
        remember(isSavedMessages, safeDetail, chatEntry) {
            if (isSavedMessages) return@remember false
            when {
                safeDetail?.type.equals("private", ignoreCase = true) -> true
                chatEntry?.isGroupChatValue == true -> false
                safeDetail?.isGroupValue == true -> false
                else -> false
            }
        }
    val showParticipantsTab = !isSavedMessages && !isPrivateDirectChat
    val isCreator =
        remember(safeDetail, currentUserId) {
            val creatorId = safeDetail?.creatorUserIdValue?.trim().orEmpty()
            creatorId.isNotBlank() && creatorId.equals(currentUserId.trim(), ignoreCase = true)
        }
    val tabs: List<ProfileTab> =
        remember(showParticipantsTab) {
            buildList {
                if (showParticipantsTab) add(ProfileTab.Participants)
                add(ProfileTab.Media)
                add(ProfileTab.Video)
                add(ProfileTab.Files)
                add(ProfileTab.Audio)
                add(ProfileTab.Links)
            }
        }

    var tabIndex by rememberSaveable(chatId, showParticipantsTab) { mutableIntStateOf(0) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showLeaveGroupConfirm by remember { mutableStateOf(false) }
    var showDeleteGroupConfirm by remember { mutableStateOf(false) }
    var showAddUserSheet by remember { mutableStateOf(false) }
    var addingUserIds by remember { mutableStateOf(setOf<String>()) }
    var menuExpanded by remember { mutableStateOf(false) }
    var mediaViewerState by remember { mutableStateOf<MediaViewerState?>(null) }
    var detailHeavyLoaded by rememberSaveable(chatId) { mutableStateOf(false) }

    LaunchedEffect(visible, tabs.size) {
        if (tabIndex >= tabs.size) tabIndex = tabs.lastIndex.coerceAtLeast(0)
    }

    LaunchedEffect(visible, chatId, participants) {
        if (!visible || chatId.isBlank()) return@LaunchedEffect
        chatViewModel.prefetchAvatarDecorations(participants.map { it.userIdValue })
    }

    LaunchedEffect(visible, chatId, isSavedMessages) {
        if (visible && chatId.isNotBlank()) {
            if (isSavedMessages) {
                chatViewModel.refreshSavedChatMedia(chatId)
            } else {
                chatViewModel.refreshChatDetailLight(chatId)
            }
        }
    }

    LaunchedEffect(visible, chatId, tabIndex, tabs, isSavedMessages) {
        if (!visible || chatId.isBlank() || isSavedMessages || detailHeavyLoaded) return@LaunchedEffect
        val activeTab = tabs.getOrNull(tabIndex) ?: return@LaunchedEffect
        if (activeTab != ProfileTab.Participants) {
            chatViewModel.refreshSavedChatMedia(chatId)
            detailHeavyLoaded = true
        }
    }

    LaunchedEffect(chatId, visible) {
        if (!visible || chatId.isBlank()) return@LaunchedEffect
        chatViewModel.chatDeletedEvent.collect { deleted ->
            if (deleted.equals(chatId, ignoreCase = true)) {
                onDeletedChatExit()
            }
        }
    }

    val pickAvatar = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        if (uri != null && chatId.isNotBlank()) {
            chatViewModel.uploadChatAvatar(chatId, uri, context)
        }
    }

    if (showDeleteConfirm && visible && chatId.isNotBlank()) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        chatViewModel.deleteChatViaHub(chatId) {
                            if (it.isSuccess) {
                                onDeletedChatExit()
                            }
                        }
                    },
                ) {
                    Text("Удалить", color = DiscordError)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Отмена") }
            },
            title = { Text("Удалить чат?") },
            text = { Text("Это действие нельзя отменить.") },
        )
    }

    if (showLeaveGroupConfirm && visible && isGroup) {
        AlertDialog(
            onDismissRequest = { showLeaveGroupConfirm = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLeaveGroupConfirm = false
                        chatViewModel.leaveGroupChat(chatId) {
                            if (it.isSuccess) {
                                onDeletedChatExit()
                            }
                        }
                    },
                ) {
                    Text("Покинуть", color = DiscordError)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLeaveGroupConfirm = false }) { Text("Отмена") }
            },
            title = { Text("Покинуть группу?") },
            text = { Text("Вы перестанете получать сообщения из этого чата.") },
        )
    }

    if (showDeleteGroupConfirm && visible && isGroup) {
        AlertDialog(
            onDismissRequest = { showDeleteGroupConfirm = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteGroupConfirm = false
                        chatViewModel.deleteGroupChat(chatId) {
                            if (it.isSuccess) {
                                onDeletedChatExit()
                            }
                        }
                    },
                ) {
                    Text("Удалить", color = DiscordError)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteGroupConfirm = false }) { Text("Отмена") }
            },
            title = { Text("Удалить группу?") },
            text = { Text("Группа будет удалена для всех участников. Это действие нельзя отменить.") },
        )
    }

    AddUserToGroupSheet(
        visible = showAddUserSheet && visible && isGroup,
        users = availableUsers,
        loading = availableUsersLoading,
        addingUserIds = addingUserIds,
        onDismiss = { showAddUserSheet = false },
        onAddUser = { targetUserId ->
            if (targetUserId.isBlank()) return@AddUserToGroupSheet
            addingUserIds = addingUserIds + targetUserId
            chatViewModel.addUserToGroup(chatId, targetUserId) { result ->
                addingUserIds = addingUserIds - targetUserId
                if (result.isFailure) {
                    // no-op: user stays in list
                }
            }
        },
    )

    if (!visible || chatId.isBlank()) return

    val title =
        if (isSavedMessages) {
            "Избранное"
        } else {
            safeDetail?.name?.takeIf { it.isNotBlank() } ?: chatTitleFallback
        }
    val statusText =
        remember(chatEntry, participants, isGroup, isSavedMessages) {
            when {
                isSavedMessages -> "Сохранённые сообщения"
                isGroup -> {
                    when (val count = participants.size) {
                        0 -> "Групповой чат"
                        1 -> "1 участник"
                        in 2..4 -> "$count участника"
                        else -> "$count участников"
                    }
                }
                else -> {
                    val peer = participants.firstOrNull()
                    formatPresenceLabel(
                        chatEntry?.userStatusValue ?: peer?.userStatusValue,
                        chatEntry?.lastSeenValue ?: peer?.lastSeen,
                    )
                }
            }
        }

    val headerAvatarDecoration =
        remember(
            isGroup,
            isSavedMessages,
            safeDetail?.otherUserId,
            chatEntry?.userIdValue,
            chatEntry?.avatarDecorationValue,
            participants,
            messageDecorationMap,
            fetchedDecorations,
        ) {
            if (isGroup || isSavedMessages) {
                null
            } else {
                val targetUserId = safeDetail?.otherUserId ?: chatEntry?.userIdValue
                val targetParticipant =
                    participants.firstOrNull {
                        it.userIdValue.equals(targetUserId?.trim().orEmpty(), ignoreCase = true)
                    } ?: participants.firstOrNull { participant ->
                        val participantId = participant.userIdValue.trim()
                        participantId.isNotBlank() && !participantId.equals(currentUserId.trim(), ignoreCase = true)
                    }
                resolveAvatarDecoration(
                    userId = targetUserId,
                    participantDecoration = targetParticipant?.avatarDecorationValue,
                    chatListDecoration = chatEntry?.avatarDecorationValue,
                    messageDecorations = messageDecorationMap,
                    fetchedDecorations = fetchedDecorations,
                )
            }
        }

    val photos = chatMedia.filter { it.contentTypeValue.startsWith("image/") }
    val videos = chatMedia.filter { it.contentTypeValue.startsWith("video/") }
    val audios = chatMedia.filter { it.contentTypeValue.startsWith("audio/") }
    val files =
        chatMedia.filter {
            val type = it.contentTypeValue
            !type.startsWith("image/") && !type.startsWith("video/") && !type.startsWith("audio/")
        }

    Box(modifier = modifier.fillMaxSize()) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = DiscordModalBackground,
        ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ProfileTopBar(
                onBack = onDismiss,
                menuExpanded = menuExpanded,
                onMenuToggle = { menuExpanded = !menuExpanded },
                onMenuDismiss = { menuExpanded = false },
                showDeletePrivate = !isGroup && !isSavedMessages,
                showGroupAvatar = isGroup,
                showLeaveGroup = isGroup && !isCreator,
                showDeleteGroup = isGroup && isCreator,
                onDeletePrivate = {
                    menuExpanded = false
                    showDeleteConfirm = true
                },
                onPickGroupAvatar = {
                    menuExpanded = false
                    pickAvatar.launch("image/*")
                },
                onLeaveGroup = {
                    menuExpanded = false
                    showLeaveGroupConfirm = true
                },
                onDeleteGroup = {
                    menuExpanded = false
                    showDeleteGroupConfirm = true
                },
            )

            val tabsItemIndex = 1 + (if (!isSavedMessages) 1 else 0)
            val listState = rememberLazyListState()
            val showFloatingTabs by remember(tabsItemIndex) {
                derivedStateOf {
                    listState.firstVisibleItemIndex > tabsItemIndex ||
                        (listState.firstVisibleItemIndex == tabsItemIndex && listState.firstVisibleItemScrollOffset > 8)
                }
            }
            val sortedParticipants =
                remember(participants) {
                    participants.sortedBy { it.usernameValue.lowercase() }
                }
            val activeTab = tabs.getOrElse(tabIndex) { ProfileTab.Media }

            Box(modifier = Modifier.weight(1f)) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxSize()
                    .navigationBarsPadding(),
            ) {
                item(key = "profile-header") {
                    ProfileHeader(
                        detail = if (isSavedMessages) null else safeDetail,
                        title = title,
                        statusText = statusText,
                        isGroup = isGroup,
                        isSavedMessages = isSavedMessages,
                        savedMessagesAvatarUrl = if (isSavedMessages) chatEntry?.avatarUrlValue else null,
                        savedMessagesAvatarColor = if (isSavedMessages) chatEntry?.avatarColorValue else null,
                        avatarDecoration = headerAvatarDecoration,
                    )
                }

                if (!isSavedMessages) {
                    item(key = "profile-actions") {
                        ProfileActionRow(
                            onOpenChat = onOpenChat,
                            onCallClick = onCallClick,
                            enableCall = enableCall,
                        )
                    }
                }

                item(key = "profile-tabs-inline") {
                    FloatingPillTabBar(
                        tabs = tabs.map { it.label },
                        selectedIndex = tabIndex,
                        onSelect = { tabIndex = it },
                    )
                }

                if (activeTab == ProfileTab.Participants) {
                    item(key = "participants-header") {
                        ChatInfoParticipantsHeader(
                            count = sortedParticipants.size,
                            canAddParticipants = isGroup,
                            onAddParticipant = {
                                showAddUserSheet = true
                                chatViewModel.requestGroupAvailableUsers(chatId)
                            },
                        )
                    }
                    if (sortedParticipants.isEmpty()) {
                        item(key = "participants-empty") {
                            EmptyTab(
                                hint = "Нет участников",
                                sub = "Участники канала появятся здесь",
                                icon = Icons.Default.People,
                            )
                        }
                    } else {
                        items(
                            items = sortedParticipants,
                            key = { it.userIdValue },
                            contentType = { "participant" },
                        ) { participant ->
                            Box(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                                ParticipantCard(
                                    participant = participant,
                                    currentUserId = currentUserId,
                                    avatarDecoration =
                                        resolveAvatarDecoration(
                                            userId = participant.userIdValue,
                                            participantDecoration = participant.avatarDecorationValue,
                                            messageDecorations = messageDecorationMap,
                                            fetchedDecorations = fetchedDecorations,
                                        ),
                                    nameplate =
                                        resolveNameplate(
                                            userId = participant.userIdValue,
                                            participantNameplate = participant.nameplateValue,
                                            fetchedNameplates = fetchedNameplates,
                                        ),
                                )
                            }
                        }
                    }
                } else {
                    item(key = "profile-tab-${activeTab.label}") {
                        ChatInfoTabBody(
                            tabs = tabs,
                            tabIndex = tabIndex,
                            chatLinksLoading = chatLinksLoading,
                            chatLinks = chatLinks,
                            chatMediaLoading = chatMediaLoading,
                            photos = photos,
                            videos = videos,
                            files = files,
                            audios = audios,
                            participants = participants,
                            currentUserId = currentUserId,
                            messageDecorationMap = messageDecorationMap,
                            fetchedDecorations = fetchedDecorations,
                            fetchedNameplates = fetchedNameplates,
                            canAddParticipants = isGroup,
                            onAddParticipant = {
                                showAddUserSheet = true
                                chatViewModel.requestGroupAvailableUsers(chatId)
                            },
                            onPhotoClick = { index ->
                                mediaViewerState =
                                    buildViewerStateFromMediaList(
                                        mediaFiles = photos,
                                        initialIndex = index,
                                        includeVideos = false,
                                        includeImages = true,
                                    )
                            },
                            onVideoClick = { index ->
                                mediaViewerState =
                                    buildViewerStateFromMediaList(
                                        mediaFiles = videos,
                                        initialIndex = index,
                                        includeVideos = true,
                                        includeImages = false,
                                    )
                            },
                            onFileClick = { chatViewModel.downloadMediaFile(context, it) },
                        )
                    }
                }

                item(key = "profile-bottom-spacer") {
                    Spacer(modifier = Modifier.height(24.dp))
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
                        tabs = tabs.map { it.label },
                        selectedIndex = tabIndex,
                        onSelect = { tabIndex = it },
                    )
                }
            }
            }
        }
        }

        mediaViewerState?.let { viewerState ->
            MediaViewerOverlay(
                state = viewerState,
                onDismiss = { mediaViewerState = null },
                onSaveToGallery = { item: MediaViewerItem ->
                    chatViewModel.saveMediaToGallery(context, item)
                },
                onDownload = { item: MediaViewerItem ->
                    chatViewModel.downloadViewerItem(context, item)
                },
            )
        }
    }
}

@Composable
private fun ProfileTopBar(
    onBack: () -> Unit,
    menuExpanded: Boolean,
    onMenuToggle: () -> Unit,
    onMenuDismiss: () -> Unit,
    showDeletePrivate: Boolean,
    showGroupAvatar: Boolean,
    showLeaveGroup: Boolean,
    showDeleteGroup: Boolean,
    onDeletePrivate: () -> Unit,
    onPickGroupAvatar: () -> Unit,
    onLeaveGroup: () -> Unit,
    onDeleteGroup: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 4.dp, vertical = 4.dp),
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = DiscordText)
        }
        Box(modifier = Modifier.align(Alignment.CenterEnd)) {
            IconButton(onClick = onMenuToggle) {
                Icon(Icons.Default.MoreVert, contentDescription = "Меню", tint = DiscordText)
            }
            DropdownMenu(
                expanded = menuExpanded,
                onDismissRequest = onMenuDismiss,
            ) {
                if (showGroupAvatar) {
                    DropdownMenuItem(
                        text = { Text("Аватар группы") },
                        onClick = onPickGroupAvatar,
                    )
                }
                if (showLeaveGroup) {
                    DropdownMenuItem(
                        text = { Text("Покинуть группу", color = DiscordError) },
                        onClick = onLeaveGroup,
                    )
                }
                if (showDeleteGroup) {
                    DropdownMenuItem(
                        text = { Text("Удалить группу", color = DiscordError) },
                        onClick = onDeleteGroup,
                    )
                }
                if (showDeletePrivate) {
                    DropdownMenuItem(
                        text = { Text("Удалить чат", color = DiscordError) },
                        onClick = onDeletePrivate,
                    )
                }
            }
        }
    }
}

@Composable
private fun UserBannerStrip(
    bannerPath: String?,
    fallbackColor: Color,
    height: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    val bannerImageUrl =
        if (isBannerImage(bannerPath)) resolveServerIconUrl(bannerPath) else null
    val bgColor = resolveBannerBackgroundColor(bannerPath, fallbackColor)

    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(height)
                .background(bgColor),
    ) {
        if (!bannerImageUrl.isNullOrBlank()) {
            val context = LocalContext.current
            val h = with(LocalDensity.current) { height.roundToPx() }
            val request =
                remember(bannerImageUrl, h) {
                    sizedImageRequest(context, bannerImageUrl, 1080, h)
                }
            AsyncImage(
                model = request,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
    }
}

@Composable
private fun ProfileAvatarBubble(
    avatarPath: String?,
    title: String,
    color: Color,
    size: androidx.compose.ui.unit.Dp,
    avatarDecoration: String? = null,
    modifier: Modifier = Modifier,
) {
    val url = avatarPath?.let(::buildMediaUrl)
    val decorationScale = ProfileMediaSpecs.AVATAR_DECORATION_SCALE_DEFAULT
    val hasDecoration = !avatarDecoration.isNullOrBlank()
    val slotSize = if (hasDecoration) size * decorationScale else size

    Box(
        modifier = modifier.size(slotSize),
        contentAlignment = Alignment.Center,
    ) {
        AvatarWithPresenceIndicator(
            name = title,
            avatarUrl = url,
            avatarColor = color,
            status = null,
            size = size,
            showIndicator = false,
            displayInitial = title.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?",
            avatarDecoration = avatarDecoration,
            decorationPreviewSizeDp = (size.value * 1.6f).dp.coerceAtLeast(96.dp),
        )
    }
}

@Composable
private fun ProfileHeader(
    detail: ChatDetailInfo?,
    title: String,
    statusText: String,
    isGroup: Boolean,
    isSavedMessages: Boolean = false,
    savedMessagesAvatarUrl: String? = null,
    savedMessagesAvatarColor: String? = null,
    avatarDecoration: String? = null,
) {
    if (isSavedMessages) {
        val colorHex = savedMessagesAvatarColor ?: "#5865F2"
        val color =
            runCatching { Color(android.graphics.Color.parseColor(colorHex)) }
                .getOrDefault(TelegramMessageUi.AccentBlue)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(color.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.Bookmark,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(52.dp),
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = title.ifBlank { "Избранное" },
                color = DiscordText,
                fontSize = 26.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = statusText,
                color = DiscordTextSecondary,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
            )
        }
        return
    }

    val avatarPath =
        savedMessagesAvatarUrl?.let(::buildMediaUrl)
            ?: detail?.displayAvatarPath()
    val colorHex =
        savedMessagesAvatarColor
            ?: detail?.displayAvatarColor()
            ?: "#5865F2"
    val color =
        runCatching { Color(android.graphics.Color.parseColor(colorHex)) }
            .getOrDefault(TelegramMessageUi.AccentBlue)

    if (!isGroup) {
        val bannerPath = detail?.displayBannerPath()
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(148.dp),
            ) {
                UserBannerStrip(
                    bannerPath = bannerPath,
                    fallbackColor = color,
                    height = 148.dp,
                )
                ProfileAvatarBubble(
                    avatarPath = avatarPath,
                    title = title,
                    color = color,
                    size = 108.dp,
                    avatarDecoration = avatarDecoration,
                    modifier =
                        Modifier
                            .align(Alignment.BottomCenter)
                            .offset(y = 54.dp),
                )
            }

            Spacer(modifier = Modifier.height(62.dp))

            Text(
                text = title.ifBlank { "Чат" },
                color = DiscordText,
                fontSize = 26.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 20.dp),
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = statusText,
                color = DiscordTextSecondary,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 12.dp),
            )
        }
        return
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ProfileAvatarBubble(
            avatarPath = avatarPath,
            title = title,
            color = color,
            size = 120.dp,
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = title.ifBlank { "Группа" },
            color = DiscordText,
            fontSize = 26.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = statusText,
            color = DiscordTextSecondary,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ProfileActionRow(
    onOpenChat: () -> Unit,
    onCallClick: (() -> Unit)?,
    enableCall: Boolean,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ProfileActionButton(
            label = "Чат",
            icon = Icons.Default.Chat,
            onClick = onOpenChat,
            modifier = Modifier.weight(1f),
        )
        ProfileActionButton(
            label = "Звук",
            icon = Icons.Default.Notifications,
            onClick = {},
            modifier = Modifier.weight(1f),
        )
        ProfileActionButton(
            label = "Звонок",
            icon = Icons.Default.Call,
            onClick = { onCallClick?.invoke() },
            enabled = enableCall && onCallClick != null,
            modifier = Modifier.weight(1f),
        )
        ProfileActionButton(
            label = "Видео",
            icon = Icons.Default.Videocam,
            onClick = { onCallClick?.invoke() },
            enabled = enableCall && onCallClick != null,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ProfileActionButton(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val tint = if (enabled) DiscordText else DiscordTextSecondary.copy(alpha = 0.55f)
    Surface(
        modifier =
            modifier
                .clip(RoundedCornerShape(12.dp))
                .clickable(enabled = enabled, onClick = onClick),
        color = DiscordModalCard,
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = label, color = tint, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun ChatInfoParticipantsHeader(
    count: Int,
    canAddParticipants: Boolean,
    onAddParticipant: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "$count участников",
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            modifier = Modifier.weight(1f),
        )
        if (canAddParticipants) {
            IconButton(onClick = onAddParticipant) {
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
private fun ChatInfoParticipantsTab(
    participants: List<ChatParticipant>,
    currentUserId: String,
    messageDecorationMap: Map<String, String>,
    fetchedDecorations: Map<String, String>,
    fetchedNameplates: Map<String, String>,
    canAddParticipants: Boolean,
    onAddParticipant: () -> Unit,
) {
    // Fallback path if invoked outside the parent LazyColumn items() lift.
    val sortedParticipants =
        remember(participants) {
            participants.sortedBy { it.usernameValue.lowercase() }
        }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ChatInfoParticipantsHeader(
            count = sortedParticipants.size,
            canAddParticipants = canAddParticipants,
            onAddParticipant = onAddParticipant,
        )
        if (sortedParticipants.isEmpty()) {
            EmptyTab(
                hint = "Нет участников",
                sub = "Участники канала появятся здесь",
                icon = Icons.Default.People,
            )
        } else {
            sortedParticipants.forEach { participant ->
                ParticipantCard(
                    participant = participant,
                    currentUserId = currentUserId,
                    avatarDecoration =
                        resolveAvatarDecoration(
                            userId = participant.userIdValue,
                            participantDecoration = participant.avatarDecorationValue,
                            messageDecorations = messageDecorationMap,
                            fetchedDecorations = fetchedDecorations,
                        ),
                    nameplate =
                        resolveNameplate(
                            userId = participant.userIdValue,
                            participantNameplate = participant.nameplateValue,
                            fetchedNameplates = fetchedNameplates,
                        ),
                )
            }
        }
    }
}

@Composable
private fun ParticipantCard(
    participant: ChatParticipant,
    currentUserId: String,
    avatarDecoration: String? = null,
    nameplate: String? = null,
) {
    val url = participant.avatarUrl?.let { buildMediaUrl(it) }
    val colorHex = participant.avatarColor ?: "#5865F2"
    val bubbleColor =
        try {
            Color(android.graphics.Color.parseColor(colorHex))
        } catch (_: Exception) {
            Color(0xFF5865F2)
        }
    val isSelf = participant.userIdValue.equals(currentUserId.trim(), ignoreCase = true)
    val displayName =
        if (isSelf) "Вы" else participant.usernameValue.ifBlank { "Пользователь" }
    val hasNameplate = !nameplate.isNullOrBlank()
    val nameTextStyle =
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

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = DiscordModalCard,
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.weight(1f)) {
                UserNameplate(
                    nameplate = nameplate,
                    modifier = Modifier.fillMaxWidth(),
                    decoratedMinHeight = ProfileMediaSpecs.MEMBER_LIST_NAMEPLATE_MIN_HEIGHT_DP,
                    playAnimation = false,
                    contentPadding =
                        if (hasNameplate) {
                            PaddingValues(
                                start = ProfileMediaSpecs.MEMBER_LIST_AVATAR_SLOT_DP + 8.dp,
                                end = 10.dp,
                                top = 6.dp,
                                bottom = 6.dp,
                            )
                        } else {
                            PaddingValues(
                                start = ProfileMediaSpecs.MEMBER_LIST_AVATAR_SLOT_DP + 8.dp,
                                end = 0.dp,
                                top = 0.dp,
                                bottom = 0.dp,
                            )
                        },
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .then(
                                if (hasNameplate) {
                                    Modifier
                                } else {
                                    Modifier.padding(start = ProfileMediaSpecs.MEMBER_LIST_AVATAR_SLOT_DP + 8.dp)
                                },
                            ),
                    ) {
                        Text(
                            text = displayName,
                            color = if (hasNameplate) NameplateTextColor else DiscordText,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            style = nameTextStyle,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = formatPresenceLabel(participant.userStatusValue, participant.lastSeen),
                            color = if (hasNameplate) NameplateTextColor.copy(alpha = 0.92f) else DiscordTextSecondary,
                            fontSize = 13.sp,
                            style = nameTextStyle,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Box(
                    modifier = Modifier.width(ProfileMediaSpecs.MEMBER_LIST_AVATAR_SLOT_DP),
                    contentAlignment = Alignment.Center,
                ) {
                    AvatarWithPresenceIndicator(
                        name = participant.usernameValue,
                        avatarUrl = url,
                        avatarColor = bubbleColor,
                        status = participant.userStatusValue,
                        size = 42.dp,
                        showIndicator = true,
                        avatarDecoration = avatarDecoration,
                        animateDecoration = false,
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatInfoTabBody(
    tabs: List<ProfileTab>,
    tabIndex: Int,
    chatLinksLoading: Boolean,
    chatLinks: List<ChatLink>,
    chatMediaLoading: Boolean,
    photos: List<MediaFile>,
    videos: List<MediaFile>,
    files: List<MediaFile>,
    audios: List<MediaFile>,
    participants: List<ChatParticipant>,
    currentUserId: String,
    messageDecorationMap: Map<String, String>,
    fetchedDecorations: Map<String, String>,
    fetchedNameplates: Map<String, String>,
    canAddParticipants: Boolean,
    onAddParticipant: () -> Unit,
    onPhotoClick: (Int) -> Unit,
    onVideoClick: (Int) -> Unit,
    onFileClick: (MediaFile) -> Unit,
) {
    when (tabs.getOrElse(tabIndex) { ProfileTab.Media }) {
        ProfileTab.Participants ->
            ChatInfoParticipantsTab(
                participants = participants,
                currentUserId = currentUserId,
                messageDecorationMap = messageDecorationMap,
                fetchedDecorations = fetchedDecorations,
                fetchedNameplates = fetchedNameplates,
                canAddParticipants = canAddParticipants,
                onAddParticipant = onAddParticipant,
            )
        ProfileTab.Links ->
            if (chatLinksLoading) {
                LoadingTab()
            } else {
                ChatInfoLinksTab(links = chatLinks)
            }
        ProfileTab.Media,
        ProfileTab.Video,
        ProfileTab.Files,
        ProfileTab.Audio,
        -> {
            if (chatMediaLoading) {
                LoadingTab()
            } else {
                when (tabs.getOrElse(tabIndex) { ProfileTab.Media }) {
                    ProfileTab.Media -> TelegramPhotoGrid(photos = photos, onPhotoClick = onPhotoClick)
                    ProfileTab.Video -> TelegramVideoGrid(videos = videos, onVideoClick = onVideoClick)
                    ProfileTab.Files ->
                        MediaListTab(
                            items = files,
                            icon = Icons.Default.AttachFile,
                            emptyHint = "Нет файлов",
                            onItemClick = onFileClick,
                        )
                    ProfileTab.Audio ->
                        ChatInfoVoiceTab(
                            items = audios,
                            participants = participants,
                            currentUserId = currentUserId,
                            messageDecorationMap = messageDecorationMap,
                            fetchedDecorations = fetchedDecorations,
                        )
                    else -> Unit
                }
            }
        }
    }
}

@Composable
private fun TelegramPhotoGrid(
    photos: List<MediaFile>,
    onPhotoClick: (Int) -> Unit,
) {
    if (photos.isEmpty()) {
        EmptyTab(
            hint = "Нет фото",
            sub = "Фотографии из чата появятся здесь",
            icon = Icons.Default.Image,
        )
        return
    }

    MediaGridLayout(items = photos) { file, cellModifier, index ->
        val thumbUrl = buildMediaUrl(file.thumbnailPathValue ?: file.filePathValue)
        Box(
            modifier =
                cellModifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(DiscordModalCard)
                    .clickable { onPhotoClick(index) },
        ) {
            if (thumbUrl != null) {
                val context = LocalContext.current
                val thumbPx = with(LocalDensity.current) { 120.dp.roundToPx() }
                val request =
                    remember(thumbUrl, thumbPx) {
                        sizedImageRequest(context, thumbUrl, thumbPx)
                    }
                AsyncImage(
                    model = request,
                    contentDescription = file.displayNameValue,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
        }
    }
}

@Composable
private fun TelegramVideoGrid(
    videos: List<MediaFile>,
    onVideoClick: (Int) -> Unit,
) {
    if (videos.isEmpty()) {
        EmptyTab(
            hint = "Нет видео",
            sub = "Видео из чата появятся здесь",
            icon = Icons.Default.Movie,
        )
        return
    }

    MediaGridLayout(items = videos) { file, cellModifier, index ->
        VideoGridThumbnailCell(
            file = file,
            modifier = cellModifier,
            onClick = { onVideoClick(index) },
        )
    }
}

@Composable
private fun MediaGridLayout(
    items: List<MediaFile>,
    cell: @Composable (MediaFile, Modifier, Int) -> Unit,
) {
    var itemIndex = 0
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items.chunked(3).forEach { rowMedia ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                rowMedia.forEach { file ->
                    val index = itemIndex
                    cell(
                        file,
                        Modifier
                            .weight(1f)
                            .aspectRatio(1f),
                        index,
                    )
                    itemIndex++
                }
                repeat(3 - rowMedia.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun VideoGridThumbnailCell(
    file: MediaFile,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val thumbnailUrl = remember(file.idValue) { buildThumbnailUrl(file) }
    val videoUrl = remember(file.idValue) { buildVideoUrl(file).orEmpty() }

    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(6.dp))
                .clickable(onClick = onClick),
    ) {
        VideoThumbnailBox(
            videoUrl = videoUrl,
            thumbnailUrl = thumbnailUrl,
            contentDescription = file.displayNameValue,
            modifier = Modifier.fillMaxSize(),
        )

        if (file.isVideoNoteValue) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.Black.copy(alpha = 0.55f))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
            ) {
                Text("кружок", color = DiscordTextSecondary, fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun ChatInfoLinksTab(links: List<ChatLink>) {
    val uriHandler = LocalUriHandler.current
    if (links.isEmpty()) {
        EmptyTab(
            hint = "Нет ссылок",
            sub = "Ссылки из сообщений чата появятся здесь",
            icon = Icons.Default.Link,
        )
        return
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        links.forEach { link ->
            Surface(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            runCatching { uriHandler.openUri(link.url) }
                        },
                color = DiscordModalCard,
                shape = RoundedCornerShape(12.dp),
            ) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                ) {
                    Text(
                        text = link.domainLabel,
                        color = TelegramMessageUi.AccentBlue,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = link.url,
                        color = DiscordTextSecondary,
                        fontSize = 13.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Row(
                        modifier = Modifier.padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (link.senderUsername.isNotBlank()) {
                            Text(
                                text = link.senderUsername,
                                color = DiscordText,
                                fontSize = 12.sp,
                            )
                        }
                        val createdLabel = remember(link.createdAt) { formatMediaCreatedAt(link.createdAt) }
                        if (createdLabel.isNotBlank()) {
                            Text(
                                text = createdLabel,
                                color = DiscordTextSecondary,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatInfoVoiceTab(
    items: List<MediaFile>,
    participants: List<ChatParticipant>,
    currentUserId: String,
    messageDecorationMap: Map<String, String>,
    fetchedDecorations: Map<String, String>,
) {
    if (items.isEmpty()) {
        EmptyTab(
            hint = "Нет голосовых",
            sub = "Голосовые сообщения из чата появятся здесь",
            icon = Icons.Default.Mic,
        )
        return
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items.forEach { file ->
            ChatInfoVoiceRow(
                file = file,
                participants = participants,
                currentUserId = currentUserId,
                messageDecorationMap = messageDecorationMap,
                fetchedDecorations = fetchedDecorations,
            )
        }
    }
}

@Composable
private fun ChatInfoVoiceRow(
    file: MediaFile,
    participants: List<ChatParticipant>,
    currentUserId: String,
    messageDecorationMap: Map<String, String>,
    fetchedDecorations: Map<String, String>,
) {
    val senderName = file.senderUsernameValue.ifBlank { "Неизвестный" }
    val displaySenderName =
        remember(senderName, currentUserId, participants) {
            val self =
                participants.find { it.userIdValue.equals(currentUserId.trim(), ignoreCase = true) }
            if (self != null && self.usernameValue.equals(senderName, ignoreCase = true)) {
                "Вы"
            } else {
                senderName
            }
        }
    val participant =
        remember(file.idValue, senderName, participants) {
            findParticipantForMedia(senderName, participants)
        }
    val avatarUrl = participant?.avatarUrl?.let { buildMediaUrl(it) }
    val avatarColor =
        runCatching { Color(android.graphics.Color.parseColor(participant?.avatarColor ?: "#5865F2")) }
            .getOrDefault(TelegramMessageUi.AccentBlue)
    val avatarDecoration =
        remember(participant, messageDecorationMap, fetchedDecorations) {
            resolveAvatarDecoration(
                userId = participant?.userIdValue,
                participantDecoration = participant?.avatarDecorationValue,
                messageDecorations = messageDecorationMap,
                fetchedDecorations = fetchedDecorations,
            )
        }
    val createdLabel = remember(file.createdAtValue) { formatMediaCreatedAt(file.createdAtValue) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = DiscordModalCard,
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                AvatarWithPresenceIndicator(
                    name = senderName,
                    avatarUrl = avatarUrl,
                    avatarColor = avatarColor,
                    status = participant?.userStatusValue ?: "offline",
                    size = 36.dp,
                    showIndicator = false,
                    avatarDecoration = avatarDecoration,
                    decorationPreviewSizeDp = 80.dp,
                    animateDecoration = false,
                )
                Spacer(modifier = Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = displaySenderName,
                        color = DiscordText,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (createdLabel.isNotBlank()) {
                        Text(
                            text = createdLabel,
                            color = DiscordTextSecondary,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            VoiceMessageItem(
                mediaFile = file,
                modifier = Modifier.fillMaxWidth(),
                lazyLoad = true,
                preloadWaveform = true,
                layoutMaxWidth = null,
            )
        }
    }
}

@Composable
private fun MediaListTab(
    items: List<MediaFile>,
    icon: ImageVector,
    emptyHint: String,
    onItemClick: (MediaFile) -> Unit = {},
) {
    if (items.isEmpty()) {
        EmptyTab(hint = emptyHint, sub = "Файлы из чата появятся здесь", icon = icon)
        return
    }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        items.forEach { file ->
            Surface(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { onItemClick(file) },
                color = DiscordModalCard,
                shape = RoundedCornerShape(12.dp),
            ) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(TelegramMessageUi.AccentBlue.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(icon, contentDescription = null, tint = TelegramMessageUi.AccentBlue, modifier = Modifier.size(22.dp))
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = file.displayNameValue,
                            color = DiscordText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontSize = 15.sp,
                        )
                        Text(
                            text = formatFileSize(file.fileSize ?: file.fileSizeAlt ?: 0L),
                            color = DiscordTextSecondary,
                            fontSize = 13.sp,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadingTab() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 48.dp),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            color = DiscordAccent,
            strokeWidth = 2.dp,
        )
    }
}

@Composable
private fun EmptyTab(
    hint: String,
    sub: String,
    icon: ImageVector,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 48.dp, horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(DiscordModalCard),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = DiscordAccent, modifier = Modifier.size(28.dp))
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text(text = hint, color = DiscordText, fontSize = 16.sp, fontWeight = FontWeight.Medium)
        Text(
            text = sub,
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 6.dp),
            textAlign = TextAlign.Center,
        )
    }
}
