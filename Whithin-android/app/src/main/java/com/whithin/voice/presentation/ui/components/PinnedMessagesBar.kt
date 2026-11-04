package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.Message
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

@Composable
fun PinnedMessagesBar(
    pinnedMessages: List<Message>,
    activeIndex: Int,
    preview: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (pinnedMessages.isEmpty()) return

    val barBackground = MaterialTheme.colorScheme.surface
    val accent = MaterialTheme.colorScheme.primary
    val mutedIcon = MaterialTheme.colorScheme.onSurfaceVariant

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(44.dp)
                .clickable(onClick = onClick)
                .background(barBackground)
                .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (pinnedMessages.size > 1) {
            Column(
                modifier = Modifier.padding(end = 8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                pinnedMessages.forEachIndexed { index, _ ->
                    Box(
                        modifier =
                            Modifier
                                .width(3.dp)
                                .height(if (index == activeIndex) 8.dp else 4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(
                                    if (index == activeIndex) {
                                        accent
                                    } else {
                                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.25f)
                                    },
                                ),
                    )
                }
            }
        }

        Icon(
            imageVector = Icons.Default.PushPin,
            contentDescription = null,
            tint = mutedIcon,
            modifier = Modifier.size(16.dp),
        )

        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .padding(start = 8.dp),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text =
                    if (pinnedMessages.size > 1) {
                        "Закреплённое #${activeIndex + 1}"
                    } else {
                        "Закреплённое"
                    },
                color = accent,
                fontSize = 11.sp,
                lineHeight = 12.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = preview,
                color = DiscordTextSecondary,
                fontSize = 12.sp,
                lineHeight = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
