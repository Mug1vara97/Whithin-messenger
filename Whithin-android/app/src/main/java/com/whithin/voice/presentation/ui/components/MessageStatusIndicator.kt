package com.whithin.voice.presentation.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.whithin.voice.data.model.MessageStatus

@Composable
fun MessageStatusIndicator(
    status: String?,
    modifier: Modifier = Modifier,
    onLightBubble: Boolean = false,
) {
    val normalized = MessageStatus.normalize(status)
    val tint =
        when (normalized) {
            MessageStatus.READ ->
                if (onLightBubble) TelegramMessageUi.AccentBlue else Color(0xFF8BE9FF)
            MessageStatus.DELIVERED ->
                if (onLightBubble) Color(0xFF949BA4) else Color.White.copy(alpha = 0.72f)
            MessageStatus.SENDING ->
                if (onLightBubble) Color(0xFF949BA4) else Color.White.copy(alpha = 0.45f)
            MessageStatus.FAILED -> Color(0xFFED4245)
            else ->
                if (onLightBubble) Color(0xFF949BA4) else Color.White.copy(alpha = 0.55f)
        }

    val icon: ImageVector =
        when (normalized) {
            MessageStatus.SENDING -> Icons.Filled.Schedule
            MessageStatus.DELIVERED, MessageStatus.READ -> Icons.Filled.DoneAll
            MessageStatus.FAILED -> Icons.Filled.ErrorOutline
            else -> Icons.Filled.Done
        }

    Icon(
        imageVector = icon,
        contentDescription = statusLabel(normalized),
        tint = tint,
        modifier = modifier.size(14.dp),
    )
}

private fun statusLabel(status: String): String =
    when (status) {
        MessageStatus.SENDING -> "Отправляется"
        MessageStatus.SENT -> "Отправлено"
        MessageStatus.DELIVERED -> "Доставлено"
        MessageStatus.READ -> "Прочитано"
        MessageStatus.FAILED -> "Ошибка отправки"
        else -> "Отправлено"
    }
