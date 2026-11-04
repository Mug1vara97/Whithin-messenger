package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.TypingUser

fun formatTypingLabel(users: List<TypingUser>): String? {
    if (users.isEmpty()) return null
    return when (users.size) {
        1 -> "${users[0].username} печатает…"
        2 -> "${users[0].username} и ${users[1].username} печатают…"
        else -> "${users.size} человек печатают…"
    }
}

@Composable
fun TypingIndicatorBar(
    users: List<TypingUser>,
    excludeUserId: String?,
    modifier: Modifier = Modifier,
) {
    val visible = users.filter { it.userId.isNotBlank() && it.userId != excludeUserId }
    val label = formatTypingLabel(visible) ?: return
    Text(
        text = label,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        color = Color(0xFFB5BAC1),
        fontSize = 13.sp,
    )
}
