package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordSurface
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

private val MinimizedButtonSize = 36.dp
private val MinimizedIconSize = 18.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MinimizedCallBar(
    roomName: String,
    participantCount: Int,
    isMuted: Boolean,
    onExpandClick: () -> Unit,
    onMuteClick: () -> Unit,
    onLeaveClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = DiscordSurface,
        shadowElevation = 8.dp,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = roomName.ifBlank { "Голосовой звонок" },
                    color = DiscordText,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
                Text(
                    text = participantLabel(participantCount),
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    scrambleOnce = false,
                )
            }

            MinimizedCallIconButton(
                icon = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                contentDescription = if (isMuted) "Включить микрофон" else "Выключить микрофон",
                backgroundColor = if (isMuted) DiscordError else MaterialTheme.colorScheme.surfaceVariant,
                iconTint =
                    if (isMuted) {
                        MaterialTheme.colorScheme.onError
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                onClick = onMuteClick,
            )
            MinimizedCallIconButton(
                icon = Icons.Default.OpenInFull,
                contentDescription = "Развернуть звонок",
                backgroundColor = MaterialTheme.colorScheme.surfaceVariant,
                iconTint = MaterialTheme.colorScheme.onSurfaceVariant,
                onClick = onExpandClick,
            )
            MinimizedCallIconButton(
                icon = Icons.Default.CallEnd,
                contentDescription = "Завершить звонок",
                backgroundColor = DiscordError,
                iconTint = MaterialTheme.colorScheme.onError,
                onClick = onLeaveClick,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MinimizedCallIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    backgroundColor: androidx.compose.ui.graphics.Color,
    iconTint: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.size(MinimizedButtonSize),
        shape = CircleShape,
        color = backgroundColor,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = iconTint,
                modifier = Modifier.size(MinimizedIconSize),
            )
        }
    }
}

private fun participantLabel(count: Int): String {
    val safeCount = count.coerceAtLeast(1)
    val mod10 = safeCount % 10
    val mod100 = safeCount % 100
    val word =
        when {
            mod100 in 11..14 -> "участников"
            mod10 == 1 -> "участник"
            mod10 in 2..4 -> "участника"
            else -> "участников"
        }
    return "$safeCount $word"
}
