package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.Category
import com.whithin.voice.data.model.ChannelTypes
import com.whithin.voice.data.model.UNCATEGORIZED_CATEGORY_LABEL
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerPanelContextMenuSheet(
    onDismiss: () -> Unit,
    onCreateChannel: () -> Unit,
    onCreateCategory: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordModalCard,
        dragHandle = { SheetDragHandle() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp)
                .padding(bottom = 16.dp),
        ) {
            Text(
                text = "Управление каналами",
                color = DiscordText,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            ContextMenuAction(
                icon = Icons.Default.Add,
                title = "Создать канал",
                onClick = {
                    onDismiss()
                    onCreateChannel()
                },
            )
            ContextMenuAction(
                icon = Icons.Default.CreateNewFolder,
                title = "Создать категорию",
                onClick = {
                    onDismiss()
                    onCreateCategory()
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategorySettingsBottomSheet(
    category: Category,
    roles: List<ServerRoleInfo>,
    members: List<ServerMemberInfo>,
    currentUserId: String,
    isLoading: Boolean,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (name: String, isPrivate: Boolean, allowedRoleIds: List<String>, allowedUserIds: List<String>) -> Unit,
    onDeleteRequest: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember(category.categoryIdValue) { mutableStateOf(category.categoryNameValue.orEmpty()) }
    var isPrivate by remember(category.categoryIdValue) { mutableStateOf(category.isPrivateValue) }
    var selectedRoleIds by remember(category.categoryIdValue) {
        mutableStateOf(category.allowedRoleIdsValue.toSet())
    }
    var selectedMemberIds by remember(category.categoryIdValue) {
        mutableStateOf(category.allowedUserIdsValue.toSet())
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordModalCard,
        dragHandle = { SheetDragHandle() },
    ) {
        ScrollableSheetColumn {
            Text("Настройки категории", color = DiscordText, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Название категории") },
                singleLine = true,
                enabled = !isSaving,
            )
            PrivateToggleRow(
                title = "Приватная категория",
                subtitle = "Только выбранные роли и участники увидят категорию",
                checked = isPrivate,
                enabled = !isSaving,
                onCheckedChange = {
                    isPrivate = it
                    if (!it) {
                        selectedRoleIds = emptySet()
                        selectedMemberIds = emptySet()
                    }
                },
            )
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
            SaveDeleteActions(
                isSaving = isSaving,
                onSave = { onSave(name, isPrivate, selectedRoleIds.toList(), selectedMemberIds.toList()) },
                onDelete = onDeleteRequest,
                deleteLabel = "Удалить категорию",
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateCategoryBottomSheet(
    roles: List<ServerRoleInfo>,
    members: List<ServerMemberInfo>,
    currentUserId: String,
    isLoading: Boolean,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onCreate: (name: String, isPrivate: Boolean, allowedRoleIds: List<String>, allowedUserIds: List<String>) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember { mutableStateOf("") }
    var isPrivate by remember { mutableStateOf(false) }
    var selectedRoleIds by remember { mutableStateOf(emptySet<String>()) }
    var selectedMemberIds by remember { mutableStateOf(emptySet<String>()) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordModalCard,
        dragHandle = { SheetDragHandle() },
    ) {
        ScrollableSheetColumn {
            Text("Новая категория", color = DiscordText, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Название категории") },
                singleLine = true,
                enabled = !isSaving,
            )
            PrivateToggleRow(
                title = "Приватная категория",
                subtitle = "Доступ только у выбранных ролей и участников",
                checked = isPrivate,
                enabled = !isSaving,
                onCheckedChange = {
                    isPrivate = it
                    if (!it) {
                        selectedRoleIds = emptySet()
                        selectedMemberIds = emptySet()
                    }
                },
            )
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
            Text(
                text = if (isSaving) "Создание…" else "Создать категорию",
                color = if (isSaving) DiscordTextSecondary else TelegramMessageUi.AccentBlue,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = !isSaving) {
                        onCreate(name, isPrivate, selectedRoleIds.toList(), selectedMemberIds.toList())
                    }
                    .padding(vertical = 12.dp),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateChannelBottomSheet(
    categories: List<Category>,
    members: List<ServerMemberInfo>,
    currentUserId: String,
    presetCategoryId: String?,
    isLoading: Boolean,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onCreate: (name: String, chatType: Int, categoryId: String?, isPrivate: Boolean, memberIds: List<String>) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember { mutableStateOf("") }
    var chatType by remember { mutableIntStateOf(ChannelTypes.TEXT) }
    var isPrivate by remember { mutableStateOf(false) }
    var selectedMemberIds by remember { mutableStateOf(emptySet<String>()) }
    val selectableCategories = remember(categories) {
        categories.filter { !it.isUncategorizedValue && !it.categoryIdValue.isNullOrBlank() }
    }
    var selectedCategoryId by remember(presetCategoryId, selectableCategories) {
        mutableStateOf(
            when {
                presetCategoryId != null -> presetCategoryId
                else -> null
            },
        )
    }
    val selectedCategoryLabel = remember(selectedCategoryId, selectableCategories) {
        if (selectedCategoryId == null) {
            UNCATEGORIZED_CATEGORY_LABEL
        } else {
            selectableCategories
                .firstOrNull { it.categoryIdValue == selectedCategoryId }
                ?.categoryNameValue
                ?: UNCATEGORIZED_CATEGORY_LABEL
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordModalCard,
        dragHandle = { SheetDragHandle() },
    ) {
        ScrollableSheetColumn {
            Text("Новый канал", color = DiscordText, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(
                text = "в $selectedCategoryLabel",
                color = DiscordTextSecondary,
                fontSize = 13.sp,
            )
            Text("Категория", color = DiscordTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            CategoryPickerOption(
                label = UNCATEGORIZED_CATEGORY_LABEL,
                selected = selectedCategoryId == null,
                enabled = !isSaving,
                onClick = { selectedCategoryId = null },
            )
            selectableCategories.forEach { category ->
                val id = category.categoryIdValue ?: return@forEach
                CategoryPickerOption(
                    label = category.categoryNameValue.orEmpty(),
                    selected = selectedCategoryId == id,
                    enabled = !isSaving,
                    onClick = { selectedCategoryId = id },
                )
            }
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Название канала") },
                singleLine = true,
                enabled = !isSaving,
            )
            Text("Тип канала", color = DiscordTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            ChannelTypeOption(
                icon = Icons.Default.Tag,
                label = "Текстовый",
                selected = chatType == ChannelTypes.TEXT,
                enabled = !isSaving,
                onClick = { chatType = ChannelTypes.TEXT },
            )
            ChannelTypeOption(
                icon = Icons.Default.VolumeUp,
                label = "Голосовой",
                selected = chatType == ChannelTypes.VOICE,
                enabled = !isSaving,
                onClick = { chatType = ChannelTypes.VOICE },
            )
            ChannelTypeOption(
                icon = Icons.Default.ContentPaste,
                label = "Доска",
                selected = chatType == ChannelTypes.IDEAS_BOARD,
                enabled = !isSaving,
                onClick = { chatType = ChannelTypes.IDEAS_BOARD },
            )
            PrivateToggleRow(
                title = "Приватный канал",
                subtitle = "Только выбранные участники смогут просматривать канал",
                checked = isPrivate,
                enabled = !isSaving,
                onCheckedChange = {
                    isPrivate = it
                    if (!it) selectedMemberIds = emptySet()
                },
            )
            if (isPrivate) {
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
            Text(
                text = if (isSaving) "Создание…" else "Создать канал",
                color = if (isSaving) DiscordTextSecondary else TelegramMessageUi.AccentBlue,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = !isSaving) {
                        onCreate(name, chatType, selectedCategoryId, isPrivate, selectedMemberIds.toList())
                    }
                    .padding(vertical = 12.dp),
            )
        }
    }
}

@Composable
private fun CategoryPickerOption(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (selected) {
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                } else {
                    Color.Transparent
                },
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            color = DiscordText,
            fontSize = 15.sp,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            Text("✓", color = TelegramMessageUi.AccentBlue, fontSize = 16.sp)
        }
    }
}

@Composable
private fun ContextMenuAction(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = DiscordText, modifier = Modifier.size(22.dp))
        Text(title, color = DiscordText, fontSize = 16.sp)
    }
}

@Composable
private fun SheetDragHandle() {
    Box(
        modifier = Modifier
            .padding(vertical = 10.dp)
            .size(width = 36.dp, height = 4.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(MaterialTheme.colorScheme.outline),
    )
}

@Composable
fun ScrollableSheetColumn(
    modifier: Modifier = Modifier,
    maxHeightFraction: Float = 0.65f,
    contentPadding: PaddingValues = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(12.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val maxHeight = (LocalConfiguration.current.screenHeightDp * maxHeightFraction).dp
    Column(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = maxHeight)
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(contentPadding),
        verticalArrangement = verticalArrangement,
        content = content,
    )
}

@Composable
private fun PrivateToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Lock, contentDescription = null, tint = DiscordTextSecondary, modifier = Modifier.size(18.dp))
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 10.dp),
        ) {
            Text(title, color = DiscordText, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            Text(subtitle, color = DiscordTextSecondary, fontSize = 12.sp)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
    }
}

@Composable
fun RoleAccessSection(
    roles: List<ServerRoleInfo>,
    isLoading: Boolean,
    selectedRoleIds: Set<String>,
    enabled: Boolean,
    onToggleRole: (String, Boolean) -> Unit,
) {
    Text("Роли с доступом", color = DiscordTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    when {
        isLoading -> {
            Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = TelegramMessageUi.AccentBlue, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        roles.isEmpty() -> Text("Роли не найдены", color = DiscordTextSecondary, fontSize = 14.sp)

        else -> {
            roles.forEach { role ->
                val roleId = role.roleIdValue
                val checked = selectedRoleIds.contains(roleId)
                val roleColor = runCatching {
                    Color(android.graphics.Color.parseColor(role.colorValue))
                }.getOrDefault(Color.Gray)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = enabled) { onToggleRole(roleId, !checked) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(12.dp).clip(CircleShape).background(roleColor))
                    Text(
                        text = role.roleNameValue,
                        color = DiscordText,
                        fontSize = 15.sp,
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 10.dp),
                    )
                    Checkbox(
                        checked = checked,
                        onCheckedChange = { onToggleRole(roleId, it) },
                        enabled = enabled,
                    )
                }
            }
        }
    }
}

@Composable
fun MemberAccessSection(
    members: List<ServerMemberInfo>,
    currentUserId: String,
    isLoading: Boolean,
    selectedMemberIds: Set<String>,
    enabled: Boolean,
    onToggleMember: (String, Boolean) -> Unit,
) {
    Text("Участники с доступом", color = DiscordTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    val selectableMembers = remember(members, currentUserId) {
        members.filter { member ->
            member.userIdValue.isNotBlank() &&
                !member.userIdValue.equals(currentUserId.trim(), ignoreCase = true)
        }
    }
    when {
        isLoading -> {
            Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    color = TelegramMessageUi.AccentBlue,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(24.dp),
                )
            }
        }

        selectableMembers.isEmpty() -> {
            Text("Участники сервера не найдены", color = DiscordTextSecondary, fontSize = 14.sp)
        }

        else -> {
            selectableMembers.forEach { member ->
                val memberId = member.userIdValue
                val checked = selectedMemberIds.contains(memberId)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = enabled) { onToggleMember(memberId, !checked) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = member.usernameValue,
                        color = DiscordText,
                        fontSize = 15.sp,
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 4.dp),
                    )
                    Checkbox(
                        checked = checked,
                        onCheckedChange = { onToggleMember(memberId, it) },
                        enabled = enabled,
                    )
                }
            }
        }
    }
}

@Composable
private fun SaveDeleteActions(
    isSaving: Boolean,
    onSave: () -> Unit,
    onDelete: () -> Unit,
    deleteLabel: String,
) {
    Spacer(Modifier.height(4.dp))
    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
    Text(
        text = if (isSaving) "Сохранение…" else "Сохранить",
        color = if (isSaving) DiscordTextSecondary else TelegramMessageUi.AccentBlue,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !isSaving, onClick = onSave)
            .padding(vertical = 12.dp),
    )
    Text(
        text = deleteLabel,
        color = DiscordError,
        fontSize = 16.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !isSaving, onClick = onDelete)
            .padding(vertical = 8.dp),
    )
}

@Composable
private fun ChannelTypeOption(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(
                if (selected) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f) else Color.Transparent,
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = DiscordText, modifier = Modifier.size(20.dp))
        Text(label, color = DiscordText, fontSize = 15.sp, modifier = Modifier.weight(1f))
        if (selected) Text("✓", color = TelegramMessageUi.AccentBlue)
    }
}
