package com.whithin.voice.presentation.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DynamicFeed
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.runtime.*
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.focusable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.onFocusEvent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.runtime.Stable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.launch
import androidx.hilt.navigation.compose.hiltViewModel
import com.whithin.voice.data.model.ChatInfo
import com.whithin.voice.data.model.splitChatListSections
import com.whithin.voice.data.model.FriendInfo
import com.whithin.voice.data.model.Server
import com.whithin.voice.data.model.UserSearchInfo
import com.whithin.voice.presentation.ui.components.AddServerDialog
import com.whithin.voice.presentation.ui.components.CreateServerBottomSheet
import com.whithin.voice.presentation.ui.components.AvatarWithPresenceIndicator
import com.whithin.voice.presentation.ui.components.ChatItem
import com.whithin.voice.presentation.ui.components.ChatListContextSheet
import com.whithin.voice.presentation.ui.components.ChatListSkeleton
import com.whithin.voice.presentation.ui.components.SearchResultItem
import com.whithin.voice.presentation.ui.components.ServerSidebar
import com.whithin.voice.presentation.ui.components.SwipeBackContainer
import com.whithin.voice.presentation.ui.utils.formatPresenceLabel
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.presentation.viewmodel.ChatListViewModel
import com.whithin.voice.presentation.viewmodel.FriendViewModel
import com.whithin.voice.presentation.viewmodel.ServerListViewModel
import com.whithin.voice.presentation.viewmodel.ServerViewModel
import com.whithin.voice.presentation.viewmodel.SettingsViewModel
import com.whithin.voice.util.visibleName
import com.whithin.voice.presentation.ui.screens.ServerScreen
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import com.whithin.voice.presentation.ui.components.TelegramMessageUi
import com.whithin.voice.presentation.ui.utils.RememberChatListScrollAnchor
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Stable
fun Modifier.clearFocusOnKeyboardDismiss(): Modifier = composed {
    var isFocused by remember { mutableStateOf(false) }
    var keyboardWasVisible by remember { mutableStateOf(false) }
    val density = LocalDensity.current
    val focusManager = LocalFocusManager.current
    val imeInsets = WindowInsets.ime

    LaunchedEffect(isFocused, density) {
        if (!isFocused) return@LaunchedEffect
        snapshotFlow { imeInsets.getBottom(density) > 0 }
            .distinctUntilChanged()
            .collect { visible ->
                if (visible) {
                    keyboardWasVisible = true
                } else if (keyboardWasVisible) {
                    focusManager.clearFocus()
                }
            }
    }

    onFocusEvent {
        if (isFocused != it.isFocused) {
            isFocused = it.isFocused
            if (isFocused) keyboardWasVisible = false
        }
    }
}

@Composable
private fun NewChatSheet(
    friends: List<FriendInfo>,
    groupMode: Boolean,
    groupName: String,
    selectedMemberIds: Set<String>,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onGroupModeChange: (Boolean) -> Unit,
    onGroupNameChange: (String) -> Unit,
    onToggleMember: (String) -> Unit,
    onCreatePrivateChat: (FriendInfo) -> Unit,
    onCreateGroup: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var presenceTick by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000)
            presenceTick++
        }
    }

    SwipeBackContainer(onBack = onDismiss, modifier = modifier) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background,
        ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding(),
        ) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = MaterialTheme.colorScheme.onSurface)
                }
                Text(
                    text = if (groupMode) "Создать группу" else "Новое сообщение",
                    fontSize = 21.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                if (groupMode) {
                    TextButton(
                        enabled = groupName.trim().isNotBlank() && selectedMemberIds.isNotEmpty(),
                        onClick = onCreateGroup,
                    ) {
                        Text("Создать")
                    }
                }
            }

            if (groupMode) {
                OutlinedTextField(
                    value = groupName,
                    onValueChange = onGroupNameChange,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    singleLine = true,
                    placeholder = { Text("Название группы") },
                    shape = RoundedCornerShape(22.dp),
                )
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(MaterialTheme.colorScheme.surface),
                ) {
                    NewChatActionRow("Создать группу", onClick = { onGroupModeChange(true) })
                }
            }

            Text(
                text = if (groupMode) "Выберите участников" else "Друзья",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
            )

            if (isLoading && friends.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(friends, key = { it.userIdValue }) { friend ->
                        val selected = selectedMemberIds.contains(friend.userIdValue)
                        FriendPickRow(
                            friend = friend,
                            selected = selected,
                            groupMode = groupMode,
                            presenceTick = presenceTick,
                            onClick = {
                                if (groupMode) {
                                    onToggleMember(friend.userIdValue)
                                } else {
                                    onCreatePrivateChat(friend)
                                }
                            },
                        )
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun NewChatActionRow(
    title: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.People, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary)
        }
        Spacer(Modifier.width(14.dp))
        Text(title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun FriendPickRow(
    friend: FriendInfo,
    selected: Boolean,
    groupMode: Boolean,
    presenceTick: Int,
    onClick: () -> Unit,
) {
    val avatarUrl =
        friend.avatarValue?.takeIf { it.isNotBlank() }?.let { avatar ->
            when {
                avatar.startsWith("http://") || avatar.startsWith("https://") -> avatar
                avatar.startsWith("/uploads/") -> "https://whithin.ru$avatar"
                avatar.startsWith("uploads/") -> "https://whithin.ru/$avatar"
                else -> "https://whithin.ru/uploads/$avatar"
            }
        }
    val avatarColor =
        friend.avatarColorValue?.let {
            runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(it)) }
                .getOrNull()
        } ?: MaterialTheme.colorScheme.surfaceVariant
    val statusText =
        remember(friend.statusValue, friend.lastSeenValue, presenceTick) {
            formatPresenceLabel(friend.statusValue, friend.lastSeenValue)
        }

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarWithPresenceIndicator(
            name = friend.usernameValue,
            avatarUrl = avatarUrl,
            avatarColor = avatarColor,
            status = friend.statusValue,
            size = 52.dp,
            animateDecoration = false,
        )
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                friend.usernameValue,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                statusText,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (groupMode) {
            RadioButton(selected = selected, onClick = onClick)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    authViewModel: AuthViewModel,
    onChatSelected: (ChatInfo, enableVoiceCall: Boolean) -> Unit,
    onNavigateToFriends: () -> Unit = {},
    onNavigateToFeed: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToProfileSettings: () -> Unit = {},
    onVoiceChannelSelected: (String, String, String, String, String) -> Unit = { _, _, _, _, _ -> },
    onIdeasBoardSelected: (String, String, String) -> Unit = { _, _, _ -> },
    onNewsSelected: (String, String, String) -> Unit = { _, _, _ -> },
    modifier: Modifier = Modifier,
    interactive: Boolean = true,
    chatListViewModel: ChatListViewModel = hiltViewModel(),
    friendViewModel: FriendViewModel = hiltViewModel(),
    serverListViewModel: ServerListViewModel = hiltViewModel(),
    serverViewModel: ServerViewModel = hiltViewModel(),
    settingsViewModel: SettingsViewModel = hiltViewModel(),
) {
    val chatListState by chatListViewModel.uiState.collectAsUiState()
    val chatListLazyState = rememberLazyListState()
    val chatSections =
        remember(chatListState.chats) {
            splitChatListSections(chatListState.chats)
        }
    val chatIds =
        remember(chatSections) {
            chatSections.all.map { it.chatIdValue }
        }
    var chatContextMenuTarget by remember { mutableStateOf<ChatInfo?>(null) }
    val friendState by friendViewModel.uiState.collectAsUiState()
    val authState by authViewModel.uiState.collectAsUiState()
    val serverListState by serverListViewModel.uiState.collectAsUiState()
    val publicServersState by serverListViewModel.publicServersState.collectAsUiState()
    val createServerState by serverListViewModel.createServerState.collectAsUiState()
    val appSettings by settingsViewModel.settings.collectAsUiState()
    
    val userId = authState.user?.id ?: authViewModel.peekCachedUserId()
    var selectedServerId by rememberSaveable {
        mutableStateOf(chatListViewModel.shellState.value.selectedServerId)
    }
    var showDiscoveryDialog by rememberSaveable { mutableStateOf(false) }
    var showCreateServerDialog by rememberSaveable { mutableStateOf(false) }
    var showNewChatSheet by rememberSaveable { mutableStateOf(false) }
    var groupMode by rememberSaveable { mutableStateOf(false) }
    var groupName by rememberSaveable { mutableStateOf("") }
    var selectedGroupMemberIds by rememberSaveable { mutableStateOf(setOf<String>()) }
    var highlightedServerChannelId by rememberSaveable {
        mutableStateOf(chatListViewModel.shellState.value.highlightedChannelId)
    }
    var showServerSettings by rememberSaveable { mutableStateOf(false) }
    var serverSettingsRefreshKey by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    val shellState by chatListViewModel.shellState.collectAsState()

    // При открытии из push shell state уже содержит serverId — показываем сервер сразу под чатом.
    val displayServerId =
        if (!interactive) {
            shellState.selectedServerId ?: selectedServerId
        } else {
            selectedServerId
        }
    val displayHighlightedChannelId =
        if (!interactive) {
            shellState.highlightedChannelId ?: highlightedServerChannelId
        } else {
            highlightedServerChannelId
        }

    LaunchedEffect(interactive, shellState.selectedServerId, shellState.highlightedChannelId) {
        chatListViewModel.applyPendingPushShellIfAny()
        val shell = chatListViewModel.shellState.value
        if (!interactive) {
            selectedServerId = shell.selectedServerId
            highlightedServerChannelId = shell.highlightedChannelId
        } else if (shell.selectedServerId != null) {
            selectedServerId = shell.selectedServerId
            highlightedServerChannelId = shell.highlightedChannelId
        }
    }

    LaunchedEffect(selectedServerId, highlightedServerChannelId, interactive) {
        if (interactive) {
            chatListViewModel.updateShellState(selectedServerId, highlightedServerChannelId)
        }
    }

    var previousSelectedServerId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(selectedServerId) {
        val previous = previousSelectedServerId
        if (previous != null && previous != selectedServerId) {
            highlightedServerChannelId = null
            showServerSettings = false
        }
        previousSelectedServerId = selectedServerId
    }
    
    // Search state
    var searchQuery by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val searchFieldFocusRequester = remember { FocusRequester() }
    val rootFocusRequester = remember { FocusRequester() }
    var isSearchFieldFocused by remember { mutableStateOf(false) }

    if (searchQuery.isBlank() && displayServerId == null) {
        RememberChatListScrollAnchor(
            listState = chatListLazyState,
            chatIds = chatIds,
            enabled = chatListState.chats.isNotEmpty(),
        )
    }
    
    // Handle back button press - hide keyboard (focus will be cleared automatically by clearFocusOnKeyboardDismiss)
    BackHandler(enabled = isSearchFieldFocused) {
        // Just hide keyboard - the clearFocusOnKeyboardDismiss modifier will handle clearing focus
        keyboardController?.hide()
    }
    
    // Track previous chat count to detect new chat creation
    var previousChatCount by remember { mutableStateOf(0) }
    var pendingChatUserId by remember { mutableStateOf<String?>(null) }
    
    // Debounce search query
    LaunchedEffect(searchQuery) {
        if (searchQuery.isNotBlank()) {
            kotlinx.coroutines.delay(300) // 300ms debounce
            chatListViewModel.searchUsers(searchQuery)
        } else {
            chatListViewModel.searchUsers("")
        }
    }
    
    // Watch for new chat creation
    LaunchedEffect(chatListState.chats.size) {
        if (pendingChatUserId != null && chatListState.chats.size > previousChatCount) {
            // New chat was added, find it and navigate to it
            val newChat = chatListState.chats.find { 
                it.userIdValue == pendingChatUserId 
            }
            if (newChat != null) {
                onChatSelected(newChat, true)
                pendingChatUserId = null
                searchQuery = ""
            }
        }
        previousChatCount = chatListState.chats.size
    }
    
    // Track if we've already loaded chats for this userId
    var loadedUserId by remember { mutableStateOf<String?>(null) }
    
    LaunchedEffect(userId) {
        val id = userId?.takeIf { it.isNotBlank() } ?: return@LaunchedEffect
        if (id == loadedUserId) return@LaunchedEffect
        loadedUserId = id
        chatListViewModel.loadChats(id)
        serverListViewModel.loadServers(id)
    }
    
    val memberServerIds =
        remember(serverListState.servers) {
            serverListState.servers
                .map { it.serverIdValue.trim().lowercase() }
                .toSet()
        }

    if (interactive) {
        BackHandler(enabled = showServerSettings) {
            showServerSettings = false
        }
        BackHandler(enabled = showDiscoveryDialog) {
            showDiscoveryDialog = false
            serverListViewModel.clearPublicServersError()
        }
        BackHandler(enabled = showCreateServerDialog) {
            showCreateServerDialog = false
            serverListViewModel.clearCreateServerError()
        }
        BackHandler(enabled = showNewChatSheet) {
            showNewChatSheet = false
            groupMode = false
            groupName = ""
            selectedGroupMemberIds = emptySet()
        }
    }

    val sidebarColor = LocalAppThemePreset.current.serverListBackground
    val contentBackground = MaterialTheme.colorScheme.background

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(sidebarColor),
    ) {
    Row(
        modifier = Modifier.fillMaxSize(),
    ) {
            // Server sidebar (Discord-like)
            ServerSidebar(
                servers = serverListState.servers,
                selectedServerId = displayServerId,
                onServerSelected = { server ->
                    selectedServerId = server?.serverIdValue
                },
                onDiscoverClick = {
                    showDiscoveryDialog = true
                    serverListViewModel.loadPublicServers()
                },
                onCreateServerClick = {
                    showCreateServerDialog = true
                    serverListViewModel.clearCreateServerError()
                },
                userAvatarUrl = authState.user?.avatarUrl,
                userAvatarColor = authState.user?.avatarColor,
                userName = authState.user?.visibleName().orEmpty(),
                onProfileClick = onNavigateToProfile,
                onProfileSettingsClick = onNavigateToProfileSettings,
                onLogout = { authViewModel.logout() },
                modifier = Modifier.fillMaxHeight()
            )
            
            // Под status bar — цвет шапки (как у списка серверов); ниже — фон чатов/панели сервера
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(sidebarColor),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .background(contentBackground),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .navigationBarsPadding(),
                    ) {
                when {
                    displayServerId != null -> {
                        val currentServerId = displayServerId!!
                        val currentUserId = userId ?: ""
                        val currentUserName = authState.user?.visibleName().orEmpty()
                        Box(modifier = Modifier.fillMaxSize()) {
                        ServerScreen(
                            serverId = currentServerId,
                            currentUserId = currentUserId,
                            selectedChannelId = displayHighlightedChannelId,
                            refreshToken = serverSettingsRefreshKey,
                            serverViewModel = serverViewModel,
                            onOpenServerSettings = { showServerSettings = true },
                            onServerLeftOrDeleted = { selectedServerId = null },
                            onChannelDeleted = { deletedChannelId ->
                                if (highlightedServerChannelId == deletedChannelId) {
                                    highlightedServerChannelId = null
                                }
                            },
                            onChannelSelected = { channelId, channelName ->
                                highlightedServerChannelId = channelId
                                // Create a temporary ChatInfo for navigation
                                // The actual chat will be loaded in ChatScreen
                                val tempChat = ChatInfo(
                                    chatId = channelId,
                                    chatIdAlt = null,
                                    username = channelName,
                                    usernameAlt = null,
                                    userId = null,
                                    userIdAlt = null,
                                    avatarUrl = null,
                                    avatarUrlAlt = null,
                                    avatarColor = null,
                                    avatarColorAlt = null,
                                    userStatus = null,
                                    userStatusAlt = null,
                                    lastSeen = null,
                                    lastSeenAlt = null,
                                    isGroupChat = true,
                                    isGroupChatAlt = null,
                                    lastMessage = null,
                                    lastMessageAlt = null,
                                    lastMessageTime = null,
                                    lastMessageTimeAlt = null
                                )
                                onChatSelected(tempChat, false)
                            },
                            onVoiceChannelSelected = { channelId, channelName, _, _ ->
                                onVoiceChannelSelected(
                                    currentServerId,
                                    channelId,
                                    channelName,
                                    currentUserId,
                                    currentUserName,
                                )
                            },
                            onIdeasBoardSelected = { channelId, channelName ->
                                highlightedServerChannelId = channelId
                                onIdeasBoardSelected(currentServerId, channelId, channelName)
                            },
                            onNewsSelected = { channelId, channelName ->
                                highlightedServerChannelId = channelId
                                onNewsSelected(currentServerId, channelId, channelName)
                            },
                        )
                        }
                    }
                    
                    else -> {
                        Column(
                            modifier =
                                Modifier
                                    .fillMaxSize()
                                    .background(MaterialTheme.colorScheme.background)
                                    .focusRequester(rootFocusRequester)
                                    .focusable(),
                        ) {
                            ChatListStickyHeader(
                                searchQuery = searchQuery,
                                onSearchQueryChange = { searchQuery = it },
                                searchFieldFocusRequester = searchFieldFocusRequester,
                                onSearchFocusChanged = { isSearchFieldFocused = it },
                                onClearSearch = {
                                    searchQuery = ""
                                    focusManager.clearFocus()
                                },
                                onNavigateToFriends = onNavigateToFriends,
                                onNavigateToFeed = onNavigateToFeed,
                            )

                            when {
                                chatListState.isSearching && searchQuery.isNotBlank() -> {
                                    if (chatListState.searchResults.isEmpty()) {
                                        Box(
                                            modifier =
                                                Modifier
                                                    .weight(1f)
                                                    .fillMaxWidth(),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            Text(
                                                text = "Пользователи не найдены",
                                                style = MaterialTheme.typography.bodyLarge,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                animationKey = "search-empty",
                                            )
                                        }
                                    } else {
                                        LazyColumn(
                                            modifier = Modifier.weight(1f),
                                        ) {
                                            items(
                                                items = chatListState.searchResults,
                                                key = { it.userIdValue },
                                            ) { user ->
                                                SearchResultItem(
                                                    user = user,
                                                    onClick = {
                                                        scope.launch {
                                                            pendingChatUserId = user.userIdValue
                                                            chatListViewModel.createPrivateChat(user.userIdValue)
                                                                .onSuccess { }
                                                                .onFailure { exception ->
                                                                    android.util.Log.e(
                                                                        "ChatListScreen",
                                                                        "Failed to create chat",
                                                                        exception,
                                                                    )
                                                                    pendingChatUserId = null
                                                                }
                                                        }
                                                    },
                                                )
                                                Divider(color = MaterialTheme.colorScheme.outline)
                                            }
                                        }
                                    }
                                }

                                chatListState.isLoading && chatListState.chats.isEmpty() -> {
                                    ChatListSkeleton(
                                        modifier = Modifier.weight(1f),
                                    )
                                }

                                chatListState.error != null && chatListState.chats.isEmpty() -> {
                                    Column(
                                        modifier =
                                            Modifier
                                                .weight(1f)
                                                .fillMaxWidth()
                                                .padding(16.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center,
                                    ) {
                                        Text(
                                            text = chatListState.error ?: "Error loading chats",
                                            color = MaterialTheme.colorScheme.error,
                                            animationKey = "chat-list-error",
                                        )
                                        Spacer(modifier = Modifier.height(16.dp))
                                        Button(onClick = {
                                            userId?.let { chatListViewModel.loadChats(it) }
                                        }) {
                                            Text("Retry")
                                        }
                                    }
                                }

                                chatListState.chats.isEmpty() -> {
                                    Box(
                                        modifier =
                                            Modifier
                                                .weight(1f)
                                                .fillMaxWidth(),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            text = "Пока нет чатов",
                                            style = MaterialTheme.typography.bodyLarge,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            animationKey = "chat-list-empty",
                                        )
                                    }
                                }

                                else -> {
                                    val pinnedStartIndex = chatSections.saved.size
                                    val pinnedEndIndex = pinnedStartIndex + chatSections.pinned.size
                                    val reorderableState =
                                        rememberReorderableLazyListState(chatListLazyState) { from, to ->
                                            if (from.index < pinnedStartIndex || from.index >= pinnedEndIndex) {
                                                return@rememberReorderableLazyListState
                                            }
                                            if (to.index < pinnedStartIndex || to.index >= pinnedEndIndex) {
                                                return@rememberReorderableLazyListState
                                            }
                                            chatListViewModel.movePinnedChat(
                                                fromIndex = from.index - pinnedStartIndex,
                                                toIndex = to.index - pinnedStartIndex,
                                            )
                                        }

                                    Box(modifier = Modifier.weight(1f)) {
                                        LazyColumn(
                                            state = chatListLazyState,
                                            modifier = Modifier.fillMaxSize(),
                                        ) {
                                            chatSections.saved.forEach { chat ->
                                                item(key = "saved-${chat.chatIdValue}") {
                                                    ChatListRow(
                                                        chat = chat,
                                                        onClick = {
                                                            chatListViewModel.markChatAsRead(chat.chatIdValue)
                                                            onChatSelected(chat, true)
                                                        },
                                                    )
                                                }
                                            }

                                            chatSections.pinned.forEach { chat ->
                                                item(key = "pinned-${chat.chatIdValue}") {
                                                    ReorderableItem(
                                                        state = reorderableState,
                                                        key = chat.chatIdValue,
                                                    ) { isDragging ->
                                                        ChatListRow(
                                                            chat = chat,
                                                            isDragging = isDragging,
                                                            modifier = Modifier.draggableHandle(),
                                                            onClick = {
                                                                chatListViewModel.markChatAsRead(chat.chatIdValue)
                                                                onChatSelected(chat, true)
                                                            },
                                                            onLongClick = { chatContextMenuTarget = chat },
                                                        )
                                                    }
                                                }
                                            }

                                            chatSections.unpinned.forEach { chat ->
                                                item(key = "chat-${chat.chatIdValue}") {
                                                    ChatListRow(
                                                        chat = chat,
                                                        onClick = {
                                                            chatListViewModel.markChatAsRead(chat.chatIdValue)
                                                            onChatSelected(chat, true)
                                                        },
                                                        onLongClick = { chatContextMenuTarget = chat },
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    ChatListContextSheet(
                                        chat = chatContextMenuTarget,
                                        hasUnread = (chatContextMenuTarget?.unreadCountValue ?: 0) > 0,
                                        onDismiss = { chatContextMenuTarget = null },
                                        onPinToggle = {
                                            val target = chatContextMenuTarget ?: return@ChatListContextSheet
                                            chatListViewModel.setChatPinned(
                                                target.chatIdValue,
                                                pinned = !target.isPinnedValue,
                                            )
                                        },
                                        onMarkAsRead = {
                                            val target = chatContextMenuTarget ?: return@ChatListContextSheet
                                            chatListViewModel.markChatAsRead(target.chatIdValue)
                                        },
                                    )
                                }
                            }
                        }
                    }
                }

                    if (!chatListState.isConnected && chatListState.chats.isNotEmpty()) {
                        Card(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .fillMaxWidth()
                                .padding(16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                            ),
                        ) {
                            Text(
                                text = "Reconnecting...",
                                modifier = Modifier.padding(8.dp),
                                style = MaterialTheme.typography.bodySmall,
                                scrambleOnce = false,
                            )
                        }
                    }
                    if (displayServerId == null && !showNewChatSheet) {
                        FloatingActionButton(
                            onClick = {
                                showNewChatSheet = true
                                groupMode = false
                                groupName = ""
                                selectedGroupMemberIds = emptySet()
                            },
                            modifier =
                                Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(end = 18.dp, bottom = 22.dp),
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Новое сообщение")
                        }
                    }
                    }
                }
            }
    }

        if (showDiscoveryDialog) {
            AddServerDialog(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .zIndex(10f),
                publicServers = publicServersState.servers,
                memberServerIds = memberServerIds,
                isLoading = publicServersState.isLoading,
                error = publicServersState.error,
                joiningServerId = publicServersState.joiningServerId,
                activeThemePresetId = appSettings.themePresetId,
                activeAvatarDecoration = authState.user?.avatarDecoration,
                currentUser = authState.user,
                avatarDecorationBusy = authState.profileVisualLoading,
                onDismiss = {
                    showDiscoveryDialog = false
                    serverListViewModel.clearPublicServersError()
                },
                onRetry = { serverListViewModel.loadPublicServers() },
                onJoinServer = { server ->
                    serverListViewModel.joinPublicServer(server.serverIdValue) { result ->
                        result
                            .onSuccess {
                                selectedServerId = server.serverIdValue
                                showDiscoveryDialog = false
                            }
                    }
                },
                onApplyTheme = settingsViewModel::setThemePresetId,
                onApplyAvatarDecoration = authViewModel::applyAvatarDecoration,
                onRemoveAvatarDecoration = authViewModel::removeAvatarDecoration,
            )
        }

        CreateServerBottomSheet(
            visible = showCreateServerDialog,
            defaultServerName = "Сервер ${authState.user?.username.orEmpty()}".trim(),
            isSubmitting = createServerState.isSubmitting,
            error = createServerState.error,
            onDismiss = {
                showCreateServerDialog = false
                serverListViewModel.clearCreateServerError()
            },
            onCreate = { serverName, isPublic, description, avatarUri ->
                serverListViewModel.createServer(
                    serverName = serverName,
                    isPublic = isPublic,
                    description = description,
                    avatarUri = avatarUri,
                ) { result ->
                    result
                        .onSuccess { server ->
                            server?.serverIdValue?.let { selectedServerId = it }
                            showCreateServerDialog = false
                        }
                }
            },
        )

        if (showNewChatSheet) {
            NewChatSheet(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .zIndex(10f),
                friends = friendState.friends,
                groupMode = groupMode,
                groupName = groupName,
                selectedMemberIds = selectedGroupMemberIds,
                isLoading = friendState.isLoading,
                onDismiss = {
                    showNewChatSheet = false
                    groupMode = false
                    groupName = ""
                    selectedGroupMemberIds = emptySet()
                },
                onGroupModeChange = { enabled ->
                    groupMode = enabled
                    selectedGroupMemberIds = emptySet()
                },
                onGroupNameChange = { groupName = it },
                onToggleMember = { memberId ->
                    selectedGroupMemberIds =
                        if (selectedGroupMemberIds.contains(memberId)) {
                            selectedGroupMemberIds - memberId
                        } else {
                            selectedGroupMemberIds + memberId
                        }
                },
                onCreatePrivateChat = { friend ->
                    val existing = chatListState.chats.firstOrNull { !it.isGroupChatValue && it.userIdValue == friend.userIdValue }
                    if (existing != null) {
                        showNewChatSheet = false
                        onChatSelected(existing, true)
                    } else {
                        scope.launch {
                            pendingChatUserId = friend.userIdValue
                            chatListViewModel.createPrivateChat(friend.userIdValue)
                                .onFailure { e ->
                                    android.util.Log.e("ChatListScreen", "Failed to create private chat", e)
                                    pendingChatUserId = null
                                }
                            showNewChatSheet = false
                        }
                    }
                },
                onCreateGroup = {
                    scope.launch {
                        chatListViewModel.createGroupChat(groupName.trim(), selectedGroupMemberIds.toList())
                            .onSuccess {
                                showNewChatSheet = false
                                groupMode = false
                                groupName = ""
                                selectedGroupMemberIds = emptySet()
                            }
                            .onFailure { e ->
                                android.util.Log.e("ChatListScreen", "Failed to create group chat", e)
                            }
                    }
                },
            )
        }

        if (showServerSettings && selectedServerId != null && userId != null) {
            val settingsServerId = selectedServerId!!
            val settingsUserId = userId
            SwipeBackContainer(
                onBack = { showServerSettings = false },
                modifier = Modifier
                    .fillMaxSize()
                    .zIndex(10f),
            ) {
                ServerSettingsPanel(
                    serverId = settingsServerId,
                    userId = settingsUserId,
                    onClose = { showServerSettings = false },
                )
            }
        }
    }
}

@Composable
private fun ChatListRow(
    chat: ChatInfo,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null,
    isDragging: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        ChatItem(
            chat = chat,
            unreadCount = chat.unreadCountValue,
            onClick = onClick,
            onLongClick = onLongClick,
            isDragging = isDragging,
        )
        HorizontalDivider(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f),
        )
    }
}

@Composable
private fun ChatListStickyHeader(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    searchFieldFocusRequester: FocusRequester,
    onSearchFocusChanged: (Boolean) -> Unit,
    onClearSearch: () -> Unit,
    onNavigateToFriends: () -> Unit,
    onNavigateToFeed: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.background),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(7.dp),
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp, max = 52.dp)
                        .focusRequester(searchFieldFocusRequester)
                        .onFocusChanged { focusState -> onSearchFocusChanged(focusState.isFocused) }
                        .clearFocusOnKeyboardDismiss(),
                placeholder = {
                    Text(
                        "Найти или начать беседу",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                trailingIcon =
                    if (searchQuery.isNotBlank()) {
                        {
                            IconButton(onClick = onClearSearch) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Clear search",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    } else {
                        null
                    },
                singleLine = true,
                shape = RoundedCornerShape(4.dp),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.outline,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                        focusedContainerColor = MaterialTheme.colorScheme.background,
                        unfocusedContainerColor = MaterialTheme.colorScheme.background,
                        focusedTextColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                    ),
                textStyle =
                    MaterialTheme.typography.bodyMedium.copy(
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                    ),
            )
        }
        Divider(color = MaterialTheme.colorScheme.outline)

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TextButton(
                onClick = onNavigateToFriends,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(4.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                colors =
                    ButtonDefaults.textButtonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurface,
                    ),
            ) {
                Icon(
                    imageVector = Icons.Default.People,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Друзья",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
                    animationKey = "nav-friends",
                )
            }
            TextButton(
                onClick = onNavigateToFeed,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(4.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                colors =
                    ButtonDefaults.textButtonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurface,
                    ),
            ) {
                Icon(
                    imageVector = Icons.Default.DynamicFeed,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Лента",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
                    animationKey = "nav-feed",
                )
            }
        }
        Divider(color = MaterialTheme.colorScheme.outline)
    }
}
