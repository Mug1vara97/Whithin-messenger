package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.whithin.voice.data.model.UserSearchInfo

@Composable
fun SearchResultItem(
    user: UserSearchInfo,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val avatarUrl = user.avatarUrlValue?.let(::resolveAvatarUrl)
    val avatarColor = user.avatarColorValue?.let {
        runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
    } ?: Color(0xFF5865F2)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AvatarWithPresenceIndicator(
            name = user.usernameValue,
            avatarUrl = avatarUrl,
            avatarColor = avatarColor,
            status = user.userStatusValue,
            size = 40.dp,
            animateDecoration = false,
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = user.usernameValue.ifEmpty { "Unknown" },
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Medium,
                animationKey = "search-${user.userIdValue}-${user.usernameValue}",
            )

            if (user.hasExistingChatValue) {
                Text(
                    text = "Есть чат",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    animationKey = "search-chat-${user.userIdValue}",
                )
            }
        }
    }
}
