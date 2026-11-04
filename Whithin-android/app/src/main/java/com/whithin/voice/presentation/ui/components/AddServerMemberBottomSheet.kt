package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.FriendInfo
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.utils.formatPresenceLabel

@Composable
fun AddServerMemberBottomSheet(
    visible: Boolean,
    friends: List<FriendInfo>,
    existingMemberIds: Set<String>,
    isLoading: Boolean,
    addingUserIds: Set<String>,
    error: String? = null,
    onDismiss: () -> Unit,
    onRefresh: () -> Unit,
    onAddMember: (FriendInfo) -> Unit,
) {
    if (!visible) return

    var searchQuery by remember { mutableStateOf("") }

    val availableFriends = remember(friends, existingMemberIds, searchQuery) {
        val query = searchQuery.trim().lowercase()
        friends
            .filter { friend ->
                friend.userIdValue.isNotBlank() &&
                    !existingMemberIds.contains(friend.userIdValue)
            }
            .filter { friend ->
                query.isBlank() || friend.usernameValue.lowercase().contains(query)
            }
            .sortedBy { it.usernameValue.lowercase() }
    }

    ChatBottomSheet(onDismiss = onDismiss) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Добавить участника",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "Выберите друзей для добавления на сервер",
                    color = DiscordTextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            IconButton(onClick = onRefresh, enabled = !isLoading) {
                Icon(
                    Icons.Default.Refresh,
                    contentDescription = "Обновить",
                    tint = if (isLoading) DiscordTextSecondary else TelegramMessageUi.AccentBlue,
                )
            }
            IconButton(onClick = onDismiss) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Закрыть",
                    tint = Color.White.copy(alpha = 0.8f),
                )
            }
        }

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = { Text("Поиск друзей", color = DiscordTextSecondary) },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = null, tint = DiscordTextSecondary)
            },
            singleLine = true,
        )

        error?.takeIf { it.isNotBlank() }?.let { message ->
            Text(
                text = message,
                color = Color(0xFFF04747),
                fontSize = 13.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        when {
            isLoading && availableFriends.isEmpty() && friends.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(
                            color = TelegramMessageUi.AccentBlue,
                            strokeWidth = 2.dp,
                        )
                        Spacer(Modifier.height(12.dp))
                        Text("Загрузка друзей…", color = DiscordTextSecondary, fontSize = 14.sp)
                    }
                }
            }

            availableFriends.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 180.dp)
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.PersonAdd,
                            contentDescription = null,
                            tint = DiscordTextSecondary.copy(alpha = 0.6f),
                            modifier = Modifier.size(40.dp),
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = if (searchQuery.isNotBlank()) {
                                "Друзья не найдены"
                            } else {
                                "Нет доступных друзей"
                            },
                            color = DiscordText,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = when {
                                searchQuery.isNotBlank() -> "Попробуйте другой запрос"
                                friends.isEmpty() -> "Добавьте друзей, чтобы пригласить их на сервер"
                                else -> "Все ваши друзья уже на этом сервере"
                            },
                            color = DiscordTextSecondary,
                            fontSize = 13.sp,
                        )
                    }
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(availableFriends, key = { it.userIdValue }) { friend ->
                        AddServerMemberRow(
                            friend = friend,
                            isAdding = addingUserIds.contains(friend.userIdValue),
                            onAdd = { onAddMember(friend) },
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun AddServerMemberRow(
    friend: FriendInfo,
    isAdding: Boolean,
    onAdd: () -> Unit,
) {
    val colorHex = friend.avatarColorValue ?: "#5865F2"
    val bubbleColor =
        runCatching { Color(android.graphics.Color.parseColor(colorHex)) }
            .getOrDefault(TelegramMessageUi.AccentBlue)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarWithPresenceIndicator(
            name = friend.usernameValue,
            avatarUrl = resolveServerIconUrl(friend.avatarValue),
            avatarColor = bubbleColor,
            status = friend.statusValue,
            size = 42.dp,
            showIndicator = true,
            animateDecoration = false,
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = friend.usernameValue.ifBlank { "Пользователь" },
                color = DiscordText,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = formatPresenceLabel(friend.statusValue, friend.lastSeenValue),
                color = DiscordTextSecondary,
                fontSize = 12.sp,
            )
        }
        if (isAdding) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                color = TelegramMessageUi.AccentBlue,
                strokeWidth = 2.dp,
            )
        } else {
            TextButton(onClick = onAdd) {
                Icon(
                    Icons.Default.PersonAdd,
                    contentDescription = null,
                    tint = TelegramMessageUi.AccentBlue,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text("Добавить", color = TelegramMessageUi.AccentBlue)
            }
        }
    }
}
