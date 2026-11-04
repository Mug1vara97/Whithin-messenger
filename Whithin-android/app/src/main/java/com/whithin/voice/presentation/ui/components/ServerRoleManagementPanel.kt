package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.domain.permissions.ServerPermissions
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

private val RoleColorPalette = listOf(
    "#5865F2", "#57F287", "#FEE75C", "#EB459E", "#ED4245", "#99AAB5",
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RoleEditorBottomSheet(
    visible: Boolean,
    isEditing: Boolean,
    draftName: String,
    draftColor: String,
    draftPermissions: Map<String, Boolean>,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onDraftNameChange: (String) -> Unit,
    onDraftColorChange: (String) -> Unit,
    onTogglePermission: (String, Boolean) -> Unit,
    onSave: () -> Unit,
) {
    if (!visible) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
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
                text = if (isEditing) "Редактирование роли" else "Новая роль",
                color = DiscordText,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
            )
            OutlinedTextField(
                value = draftName,
                onValueChange = onDraftNameChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Название роли") },
                singleLine = true,
                enabled = !isSaving,
            )

            Text(
                text = "Цвет",
                color = DiscordTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RoleColorPalette.forEach { hex ->
                    val color = remember(hex) {
                        runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color.Gray)
                    }
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(color)
                            .border(
                                2.dp,
                                if (draftColor.equals(hex, true)) {
                                    MaterialTheme.colorScheme.onSurface
                                } else {
                                    Color.Transparent
                                },
                                CircleShape,
                            )
                            .clickable(enabled = !isSaving) { onDraftColorChange(hex) },
                    )
                }
            }

            ServerPermissions.categories.forEach { category ->
                Text(
                    text = category.title,
                    color = DiscordText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                category.permissions.forEach { key ->
                    val label = ServerPermissions.labels[key] ?: key
                    val checked = draftPermissions[key] == true
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !isSaving) { onTogglePermission(key, !checked) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = label,
                            color = DiscordText,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Switch(
                            checked = checked,
                            onCheckedChange = { onTogglePermission(key, it) },
                            enabled = !isSaving,
                        )
                    }
                }
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
                    .clickable(enabled = !isSaving, onClick = onSave)
                    .padding(vertical = 12.dp),
            )
        }
    }
}

@Composable
fun ServerRoleManagementPanel(
    roles: List<ServerRoleInfo>,
    isLoading: Boolean,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onCreateNew: () -> Unit,
    onEditRole: (ServerRoleInfo) -> Unit,
    onDeleteRole: (String) -> Unit,
    modifier: Modifier = Modifier,
    embeddedInParentScroll: Boolean = false,
) {
    val filtered =
        remember(roles, searchQuery) {
            val q = searchQuery.trim().lowercase()
            if (q.isEmpty()) roles
            else roles.filter { it.roleNameValue.lowercase().contains(q) }
        }

    when {
        isLoading && roles.isEmpty() -> {
            Box(
                modifier = if (embeddedInParentScroll) modifier.fillMaxWidth() else modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = TelegramMessageUi.AccentBlue, strokeWidth = 2.dp)
            }
        }

        roles.isEmpty() -> {
            Column(
                modifier = if (embeddedInParentScroll) {
                    modifier.fillMaxWidth().padding(24.dp)
                } else {
                    modifier.fillMaxSize().padding(24.dp)
                },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = if (embeddedInParentScroll) Arrangement.Top else Arrangement.Center,
            ) {
                Icon(Icons.Default.Security, contentDescription = null, tint = DiscordTextSecondary, modifier = Modifier.size(40.dp))
                Spacer(Modifier.height(12.dp))
                Text("Нет ролей", color = DiscordText, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                Text("Создайте первую роль для сервера", color = DiscordTextSecondary, fontSize = 14.sp)
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Создать роль",
                    color = TelegramMessageUi.AccentBlue,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.clickable(onClick = onCreateNew),
                )
            }
        }

        else -> {
            Surface(
                modifier = if (embeddedInParentScroll) {
                    modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)
                } else {
                    modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 4.dp)
                },
                color = DiscordModalCard,
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(
                    Modifier.then(
                        if (embeddedInParentScroll) Modifier.fillMaxWidth() else Modifier.fillMaxSize(),
                    ),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Роли",
                            color = DiscordText,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = "Создать",
                            color = TelegramMessageUi.AccentBlue,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.clickable(onClick = onCreateNew),
                        )
                    }

                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = onSearchChange,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp),
                        singleLine = true,
                        placeholder = { Text("Поиск ролей") },
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = null, tint = DiscordTextSecondary)
                        },
                    )

                    Spacer(Modifier.height(8.dp))

                    if (filtered.isEmpty()) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .then(if (embeddedInParentScroll) Modifier.padding(vertical = 24.dp) else Modifier.weight(1f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("Роли не найдены", color = DiscordTextSecondary, fontSize = 14.sp)
                        }
                    } else if (embeddedInParentScroll) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp),
                        ) {
                            filtered.forEach { role ->
                                RoleListRow(
                                    role = role,
                                    onClick = { onEditRole(role) },
                                    onDelete = { onDeleteRole(role.roleIdValue) },
                                )
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentPadding = PaddingValues(bottom = 12.dp),
                        ) {
                            items(filtered, key = { it.roleIdValue }) { role ->
                                RoleListRow(
                                    role = role,
                                    onClick = { onEditRole(role) },
                                    onDelete = { onDeleteRole(role.roleIdValue) },
                                )
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoleListRow(
    role: ServerRoleInfo,
    onClick: () -> Unit,
    onDelete: () -> Unit,
) {
    val roleColor =
        remember(role.colorValue) {
            runCatching { Color(android.graphics.Color.parseColor(role.colorValue)) }.getOrDefault(Color.Gray)
        }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(14.dp)
                .clip(CircleShape)
                .background(roleColor),
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = role.roleNameValue,
                color = DiscordText,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val permCount = ServerPermissions.parseJson(role.permissionsValue).count { it.value }
            Text(
                text = if (permCount > 0) "$permCount разрешений" else "Без разрешений",
                color = DiscordTextSecondary,
                fontSize = 13.sp,
            )
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Default.Delete, contentDescription = "Удалить", tint = DiscordError, modifier = Modifier.size(20.dp))
        }
    }
}
