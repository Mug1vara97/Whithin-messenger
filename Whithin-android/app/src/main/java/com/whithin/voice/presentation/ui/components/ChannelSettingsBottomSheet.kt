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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.Channel
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.components.TelegramMessageUi

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChannelSettingsBottomSheet(
    channel: Channel,
    roles: List<ServerRoleInfo>,
    members: List<ServerMemberInfo>,
    currentUserId: String,
    isLoading: Boolean,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (name: String, isPrivate: Boolean, allowedRoleIds: List<String>, allowedMemberIds: List<String>) -> Unit,
    onDeleteRequest: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember(channel.chatIdValue) { mutableStateOf(channel.nameValue) }
    var isPrivate by remember(channel.chatIdValue) { mutableStateOf(channel.isPrivateValue) }
    var selectedRoleIds by remember(channel.chatIdValue) {
        mutableStateOf(channel.allowedRoleIdsValue.toSet())
    }
    var selectedMemberIds by remember(channel.chatIdValue) {
        mutableStateOf(channel.membersValue.toSet())
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordModalCard,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 10.dp)
                    .size(width = 36.dp, height = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(MaterialTheme.colorScheme.outline),
            )
        },
    ) {
        ScrollableSheetColumn {
            Text(
                text = "Настройки канала",
                color = DiscordText,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = channel.channelTypeLabel,
                color = DiscordTextSecondary,
                fontSize = 13.sp,
            )

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Название канала") },
                singleLine = true,
                enabled = !isSaving,
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = DiscordTextSecondary,
                    modifier = Modifier.size(18.dp),
                )
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 10.dp),
                ) {
                    Text("Приватный канал", color = DiscordText, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    Text(
                        text = "Только выбранные роли и участники смогут просматривать канал",
                        color = DiscordTextSecondary,
                        fontSize = 12.sp,
                    )
                }
                Switch(
                    checked = isPrivate,
                    onCheckedChange = {
                        isPrivate = it
                        if (!it) {
                            selectedRoleIds = emptySet()
                            selectedMemberIds = emptySet()
                        }
                    },
                    enabled = !isSaving,
                )
            }

            if (isPrivate) {
                RoleAccessSection(
                    roles = roles,
                    isLoading = isLoading,
                    selectedRoleIds = selectedRoleIds,
                    enabled = !isSaving,
                    onToggleRole = { roleId, checked ->
                        selectedRoleIds = if (checked) selectedRoleIds + roleId else selectedRoleIds - roleId
                    },
                )
                MemberAccessSection(
                    members = members,
                    currentUserId = currentUserId,
                    isLoading = isLoading,
                    selectedMemberIds = selectedMemberIds,
                    enabled = !isSaving,
                    onToggleMember = { memberId, checked ->
                        selectedMemberIds = if (checked) selectedMemberIds + memberId else selectedMemberIds - memberId
                    },
                )
            }

            Spacer(Modifier.height(4.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline)

            Text(
                text = if (isSaving) "Сохранение…" else "Сохранить",
                color = if (isSaving) DiscordTextSecondary else TelegramMessageUi.AccentBlue,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = !isSaving) {
                        onSave(name, isPrivate, selectedRoleIds.toList(), selectedMemberIds.toList())
                    }
                    .padding(vertical = 12.dp),
            )

            Text(
                text = "Удалить канал",
                color = DiscordError,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = !isSaving, onClick = onDeleteRequest)
                    .padding(vertical = 8.dp),
            )
        }
    }
}
