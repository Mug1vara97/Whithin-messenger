package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.Icon
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.data.model.ChatInfo

private val ChatListRowHeight = 68.dp

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatItem(
    chat: ChatInfo,
    unreadCount: Int,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null,
    isDragging: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val lastMessagePreview = remember(chat.chatIdValue, chat.lastMessageValue) {
        formatChatListLastMessage(chat.lastMessageValue)
    }
    val lastMessageTimeLabel = remember(chat.chatIdValue, chat.lastMessageTimeValue) {
        formatChatListMessageTime(chat.lastMessageTimeValue)
    }
    val hasUnread = unreadCount > 0
    val isPinned = chat.isPinnedValue && !chat.isSavedMessagesValue
    val avatarUrl =
        remember(chat.chatIdValue, chat.avatarUrlValue) {
            chat.avatarUrlValue?.let(::resolveAvatarUrl)
        }
    val avatarColor =
        remember(chat.chatIdValue, chat.avatarColorValue) {
            chat.avatarColorValue?.let {
                runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
            } ?: Color(0xFF5865F2)
        }
    val subtitle =
        when {
            chat.isSavedMessagesValue -> "Сохранённые сообщения"
            lastMessagePreview != null -> lastMessagePreview
            chat.isGroupChatValue -> "Групповой чат"
            else -> ""
        }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(ChatListRowHeight)
            .then(
                if (isDragging) {
                    Modifier.shadow(4.dp)
                } else {
                    Modifier
                },
            )
            .then(
                if (onLongClick != null) {
                    Modifier.combinedClickable(
                        onClick = onClick,
                        onLongClick = onLongClick,
                    )
                } else {
                    Modifier.clickable(onClick = onClick)
                },
            )
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (chat.isSavedMessagesValue) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.Bookmark,
                    contentDescription = "Избранное",
                    tint = DiscordTextSecondary,
                    modifier = Modifier.size(20.dp),
                )
            }
        } else {
            Box(
                modifier = Modifier.width(52.dp),
                contentAlignment = Alignment.Center,
            ) {
                AvatarWithPresenceIndicator(
                    name = chat.usernameValue,
                    avatarUrl = avatarUrl,
                    avatarColor = avatarColor,
                    status = chat.userStatusValue,
                    size = 40.dp,
                    showIndicator = !chat.isGroupChatValue,
                    avatarDecoration = chat.avatarDecorationValue,
                    animateDecoration = false,
                    displayInitial =
                        if (chat.isGroupChatValue) {
                            "G"
                        } else {
                            chat.usernameValue.takeIf { it.isNotEmpty() }?.firstOrNull()?.uppercase() ?: "U"
                        },
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        Column(
            modifier = Modifier.weight(1f),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = chat.usernameValue.ifEmpty { "Unknown" },
                        modifier = Modifier.weight(1f, fill = false),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = if (hasUnread) FontWeight.SemiBold else FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        animationKey = "chat-title-${chat.chatIdValue}-${chat.usernameValue}",
                    )
                    if (isPinned) {
                        Icon(
                            imageVector = Icons.Default.PushPin,
                            contentDescription = "Закреплено",
                            tint = DiscordTextSecondary,
                            modifier =
                                Modifier
                                    .padding(start = 4.dp)
                                    .size(12.dp)
                                    .rotate(45f),
                        )
                    }
                }
                Text(
                    text = lastMessageTimeLabel.orEmpty(),
                    modifier = Modifier.padding(start = 8.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (hasUnread && lastMessageTimeLabel != null) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        DiscordTextSecondary
                    },
                    fontWeight = if (hasUnread && lastMessageTimeLabel != null) {
                        FontWeight.SemiBold
                    } else {
                        FontWeight.Normal
                    },
                    maxLines = 1,
                    scrambleOnce = false,
                )
            }

            Text(
                text = subtitle,
                modifier = Modifier.heightIn(min = 18.dp),
                style = MaterialTheme.typography.bodySmall,
                color = if (hasUnread && subtitle.isNotEmpty()) {
                    MaterialTheme.colorScheme.onSurface
                } else {
                    DiscordTextSecondary
                },
                fontWeight = if (hasUnread && subtitle.isNotEmpty()) FontWeight.Medium else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                animationKey = "chat-preview-${chat.chatIdValue}-$subtitle",
            )
        }

        if (unreadCount > 0) {
            Box(
                modifier =
                    Modifier
                        .padding(start = 8.dp)
                        .heightIn(min = 18.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFED4245))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (unreadCount > 99) "99+" else unreadCount.toString(),
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
            }
        }
    }
}

internal fun resolveAvatarUrl(raw: String): String {
    return when {
        raw.startsWith("/uploads/") -> "https://whithin.ru$raw"
        raw.startsWith("http://") || raw.startsWith("https://") -> raw
        raw.startsWith("uploads/") -> "https://whithin.ru/$raw"
        else -> "https://whithin.ru/uploads/$raw"
    }
}
