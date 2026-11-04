package com.whithin.voice.presentation.ui.screens

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.DropdownMenu
import androidx.compose.material.DropdownMenuItem
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PersonRemove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.whithin.voice.data.model.FriendInfo
import com.whithin.voice.data.model.FriendRequestInfo
import com.whithin.voice.data.model.PresenceStatus
import com.whithin.voice.data.model.UserSearchInfo
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.FriendViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendsScreen(
    onBack: () -> Unit,
    authViewModel: AuthViewModel,
    initialTab: Int = 0,
    friendViewModel: FriendViewModel = hiltViewModel(),
) {
    val uiState by friendViewModel.uiState.collectAsUiState()
    val authState by authViewModel.uiState.collectAsUiState()
    val userId = authState.user?.id

    var selectedTab by remember(initialTab) { mutableStateOf(initialTab.coerceIn(0, 1)) }
    var showAddDialog by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var showStatusMenu by remember { mutableStateOf(false) }
    val currentStatus = remember(authState.currentStatus) { PresenceStatus.from(authState.currentStatus) }

    LaunchedEffect(userId) {
        if (!userId.isNullOrBlank()) {
            friendViewModel.load(userId)
        }
    }

    val pendingCombined = remember(uiState.pendingRequests, uiState.sentRequests) {
        val incoming = uiState.pendingRequests.map { it to false }
        val sent = uiState.sentRequests.map { it to true }
        (incoming + sent).sortedByDescending { (item, _) -> item.createdAtValue }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Друзья") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    Box {
                        TextButton(onClick = { showStatusMenu = true }) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(CircleShape)
                                    .background(statusColor(currentStatus))
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(currentStatus.label)
                        }
                        DropdownMenu(
                            expanded = showStatusMenu,
                            onDismissRequest = { showStatusMenu = false }
                        ) {
                            PresenceStatus.entries.forEach { statusOption ->
                                DropdownMenuItem(
                                    onClick = {
                                        authViewModel.updateStatus(statusOption)
                                        showStatusMenu = false
                                    }
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(10.dp)
                                                .clip(CircleShape)
                                                .background(statusColor(statusOption))
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(statusOption.label)
                                    }
                                }
                            }
                        }
                    }
                    IconButton(onClick = { showAddDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Добавить друга")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Все (${uiState.friends.size})") }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Ожидают (${pendingCombined.size})") }
                )
            }

            when {
                uiState.isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                selectedTab == 0 && uiState.friends.isEmpty() -> {
                    EmptyState("Список друзей пуст")
                }
                selectedTab == 1 && pendingCombined.isEmpty() -> {
                    EmptyState("Нет ожидающих запросов")
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        if (selectedTab == 0) {
                            items(
                                items = uiState.friends,
                                key = { friend -> friend.userIdValue }
                            ) { friend ->
                                FriendRow(
                                    friend = friend,
                                    onRemove = { friendViewModel.removeFriend(friend.userIdValue) }
                                )
                                Divider(color = MaterialTheme.colorScheme.outline)
                            }
                        } else {
                            items(
                                items = pendingCombined,
                                key = { pair -> pair.first.idValue }
                            ) { pair ->
                                val request = pair.first
                                val isSent = pair.second
                                RequestRow(
                                    request = request,
                                    isSent = isSent,
                                    onAccept = { friendViewModel.acceptFriendRequest(request.idValue) },
                                    onDecline = { friendViewModel.declineFriendRequest(request.idValue) }
                                )
                                Divider(color = MaterialTheme.colorScheme.outline)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Добавить друга") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = {
                            searchQuery = it
                            friendViewModel.searchUsers(it)
                        },
                        label = { Text("Найти пользователя") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    LazyColumn(modifier = Modifier.height(260.dp)) {
                        items(
                            items = uiState.searchResults,
                            key = { user -> user.userIdValue }
                        ) { user ->
                            UserSearchRow(
                                user = user,
                                currentUserId = userId,
                                sentRequests = uiState.sentRequests,
                                pendingRequests = uiState.pendingRequests,
                                onAdd = { friendViewModel.sendFriendRequest(user.userIdValue) }
                            )
                            Divider(color = MaterialTheme.colorScheme.outline)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Закрыть")
                }
            }
        )
    }
}

@Composable
private fun FriendRow(
    friend: FriendInfo,
    onRemove: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(
            name = friend.usernameValue,
            avatar = friend.avatarValue,
            color = friend.avatarColorValue
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(friend.usernameValue, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(
                PresenceStatus.from(friend.statusValue).label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        OutlinedButton(onClick = onRemove) {
            Icon(Icons.Default.PersonRemove, contentDescription = null)
            Spacer(modifier = Modifier.width(6.dp))
            Text("Удалить")
        }
    }
}

@Composable
private fun RequestRow(
    request: FriendRequestInfo,
    isSent: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(
            name = request.requesterUsernameValue,
            avatar = request.requesterAvatarValue,
            color = request.requesterAvatarColorValue
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(request.requesterUsernameValue, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(
                if (isSent) "Исходящий запрос" else "Входящий запрос",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (!isSent) {
            IconButton(onClick = onAccept) {
                Icon(Icons.Default.Check, contentDescription = "Принять")
            }
            IconButton(onClick = onDecline) {
                Icon(Icons.Default.Close, contentDescription = "Отклонить")
            }
        } else {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Text(
                    "Ожидает ответа",
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun UserSearchRow(
    user: UserSearchInfo,
    currentUserId: String?,
    sentRequests: List<FriendRequestInfo>,
    pendingRequests: List<FriendRequestInfo>,
    onAdd: () -> Unit
) {
    val outgoingPending = currentUserId != null &&
        sentRequests.any { req ->
            req.addresseeIdValue == user.userIdValue && req.requesterIdValue == currentUserId
        }
    val incomingPending = currentUserId != null &&
        pendingRequests.any { req ->
            req.requesterIdValue == user.userIdValue && req.addresseeIdValue == currentUserId
        }
    val statusLower = user.friendshipStatusValue?.trim()?.lowercase().orEmpty()
    val pendingFromApi = statusLower == "pending"
    val blocked = statusLower == "blocked"

    val addActionLabel: String
    val subtitle: String
    val canSendAdd: Boolean

    when {
        user.isFriendValue || statusLower == "accepted" -> {
            addActionLabel = "В друзьях"
            subtitle = "Уже в друзьях"
            canSendAdd = false
        }
        incomingPending -> {
            addActionLabel = "Входящий"
            subtitle = "Входящий запрос в друзья"
            canSendAdd = false
        }
        outgoingPending || (pendingFromApi && !incomingPending) -> {
            addActionLabel = "Отправлено"
            subtitle = "Запрос в друзья отправлен"
            canSendAdd = false
        }
        blocked -> {
            addActionLabel = "Недоступно"
            subtitle = "Пользователь недоступен"
            canSendAdd = false
        }
        else -> {
            addActionLabel = "Добавить"
            subtitle = when {
                user.hasExistingChatValue -> "Есть чат"
                else -> "Можно отправить запрос"
            }
            canSendAdd = true
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 6.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(
            name = user.usernameValue,
            avatar = user.avatarUrlValue,
            color = user.avatarColorValue
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(user.usernameValue, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Button(
            onClick = onAdd,
            enabled = canSendAdd && !user.isFriendValue
        ) {
            Text(addActionLabel)
        }
    }
}

@Composable
private fun Avatar(
    name: String,
    avatar: String?,
    color: String?
) {
    val parsedColor =
        remember(color) {
            color?.let {
                try {
                    Color(android.graphics.Color.parseColor(it))
                } catch (_: Exception) {
                    Color(0xFF5865F2)
                }
            } ?: Color(0xFF5865F2)
        }
    val context = LocalContext.current
    val density = LocalDensity.current
    val sizePx = with(density) { 40.dp.roundToPx() }

    if (!avatar.isNullOrBlank()) {
        val avatarUrl =
            remember(avatar) {
                when {
                    avatar.startsWith("/uploads/") -> "https://whithin.ru$avatar"
                    avatar.startsWith("http") -> avatar
                    else -> "https://whithin.ru/uploads/$avatar"
                }
            }
        val request =
            remember(avatarUrl, sizePx) {
                ImageRequest.Builder(context)
                    .data(avatarUrl)
                    .size(sizePx)
                    .crossfade(false)
                    .build()
            }
        AsyncImage(
            model = request,
            contentDescription = name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
        )
    } else {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(parsedColor),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = name.takeIf { it.isNotBlank() }?.firstOrNull()?.uppercase() ?: "U",
                color = Color.White,
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}

@Composable
private fun EmptyState(text: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun statusColor(status: PresenceStatus): Color {
    return when (status) {
        PresenceStatus.ONLINE -> Color(0xFF43B581)
        PresenceStatus.INACTIVE -> Color(0xFFF0B232)
        PresenceStatus.DO_NOT_DISTURB -> Color(0xFFF23F43)
        PresenceStatus.OFFLINE -> Color(0xFF80848E)
    }
}

