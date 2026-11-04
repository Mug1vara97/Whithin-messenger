package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.AvailableGroupUser
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.utils.formatPresenceLabel

private const val MEDIA_BASE = "https://whithin.ru"

private fun buildAvatarUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    return when {
        raw.startsWith("http://") || raw.startsWith("https://") -> raw
        raw.startsWith("/uploads/") -> "$MEDIA_BASE$raw"
        raw.startsWith("uploads/") -> "$MEDIA_BASE/$raw"
        else -> "$MEDIA_BASE/uploads/$raw"
    }
}

@Composable
fun AddUserToGroupSheet(
    visible: Boolean,
    users: List<AvailableGroupUser>,
    loading: Boolean,
    addingUserIds: Set<String>,
    onDismiss: () -> Unit,
    onAddUser: (String) -> Unit,
) {
    if (!visible) return

    ChatBottomSheet(onDismiss = onDismiss) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Добавить участника",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Color.White.copy(alpha = 0.8f))
            }
        }

        when {
            loading -> {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(220.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = TelegramMessageUi.AccentBlue, strokeWidth = 2.dp)
                }
            }
            users.isEmpty() -> {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                            .padding(horizontal = 24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Нет доступных пользователей для добавления",
                        color = DiscordTextSecondary,
                        fontSize = 14.sp,
                    )
                }
            }
            else -> {
                LazyColumn(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(max = 360.dp)
                            .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(users, key = { it.userIdValue }) { user ->
                        AvailableUserRow(
                            user = user,
                            isAdding = addingUserIds.contains(user.userIdValue),
                            onAdd = { onAddUser(user.userIdValue) },
                        )
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun AvailableUserRow(
    user: AvailableGroupUser,
    isAdding: Boolean,
    onAdd: () -> Unit,
) {
    val colorHex = user.avatarColorValue ?: "#5865F2"
    val bubbleColor =
        runCatching { Color(android.graphics.Color.parseColor(colorHex)) }
            .getOrDefault(TelegramMessageUi.AccentBlue)

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarWithPresenceIndicator(
            name = user.usernameValue,
            avatarUrl = buildAvatarUrl(user.avatarUrlValue),
            avatarColor = bubbleColor,
            status = user.userStatusValue,
            size = 42.dp,
            showIndicator = true,
            animateDecoration = false,
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = user.usernameValue.ifBlank { "Пользователь" },
                color = DiscordText,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = formatPresenceLabel(user.userStatusValue, null),
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
            IconButton(onClick = onAdd) {
                Icon(
                    Icons.Default.PersonAdd,
                    contentDescription = "Добавить",
                    tint = TelegramMessageUi.AccentBlue,
                )
            }
        }
    }
}
