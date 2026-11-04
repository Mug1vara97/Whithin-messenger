package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.whithin.voice.data.model.ChatInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListContextSheet(
    chat: ChatInfo?,
    hasUnread: Boolean,
    onDismiss: () -> Unit,
    onPinToggle: () -> Unit,
    onMarkAsRead: (() -> Unit)? = null,
) {
    val target = chat ?: return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
        ) {
            Text(
                text = target.usernameValue.ifEmpty { "Чат" },
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
                style = MaterialTheme.typography.titleMedium,
            )

            if (hasUnread && onMarkAsRead != null) {
                ListItem(
                    headlineContent = { Text("Пометить как прочитанное") },
                    modifier =
                        Modifier.clickable {
                            onMarkAsRead()
                            onDismiss()
                        },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
            }

            ListItem(
                headlineContent = {
                    Text(if (target.isPinnedValue) "Открепить" else "Закрепить")
                },
                modifier =
                    Modifier.clickable {
                        onPinToggle()
                        onDismiss()
                    },
            )

            Spacer(modifier = Modifier.navigationBarsPadding())
        }
    }
}
