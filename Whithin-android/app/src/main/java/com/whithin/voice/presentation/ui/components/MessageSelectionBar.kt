package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Forward
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordSurface
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

@Composable
fun MessageSelectionBar(
    selectedCount: Int,
    canForward: Boolean,
    canDelete: Boolean,
    onCancel: () -> Unit,
    onForward: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(DiscordSurface)
                .navigationBarsPadding(),
    ) {
        HorizontalDivider(
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f),
            thickness = 1.dp,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(63.dp)
                    .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SelectionBarActionButton(
                label = "Переслать",
                icon = Icons.AutoMirrored.Filled.Forward,
                enabled = canForward,
                onClick = onForward,
            )
            SelectionBarActionButton(
                label = "Удалить",
                icon = Icons.Default.Delete,
                enabled = canDelete,
                onClick = onDelete,
                danger = true,
            )
        }

        Text(
            text = if (selectedCount > 0) "Выбрано: $selectedCount" else "Выберите сообщения",
            color = DiscordText,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )

        Text(
            text = "Отменить",
            color = DiscordAccent,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onCancel)
                    .padding(horizontal = 4.dp, vertical = 8.dp),
        )
        }
    }
}

@Composable
private fun SelectionBarActionButton(
    label: String,
    icon: ImageVector,
    enabled: Boolean,
    onClick: () -> Unit,
    danger: Boolean = false,
) {
    val backgroundColor = MaterialTheme.colorScheme.surfaceVariant
    val contentColor =
        when {
            !enabled -> DiscordTextSecondary.copy(alpha = 0.45f)
            danger -> MaterialTheme.colorScheme.error
            else -> DiscordText
        }

    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(backgroundColor.copy(alpha = if (enabled) 1f else 0.55f))
                .then(
                    if (enabled) {
                        Modifier.clickable(onClick = onClick)
                    } else {
                        Modifier
                    },
                )
                .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = label,
            color = contentColor,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}
