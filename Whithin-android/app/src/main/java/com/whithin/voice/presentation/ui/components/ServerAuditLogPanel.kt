package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.AuditLogEntry
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val AuditActionFilters =
    listOf(
        "all" to "Все действия",
        "channel_create" to "Создание канала",
        "channel_update" to "Обновление канала",
        "channel_delete" to "Удаление канала",
        "category_create" to "Создание категории",
        "category_update" to "Обновление категории",
        "category_delete" to "Удаление категории",
        "role_create" to "Создание роли",
        "role_update" to "Обновление роли",
        "role_delete" to "Удаление роли",
        "member_role_add" to "Роль выдана",
        "member_role_remove" to "Роль снята",
        "member_kick" to "Исключение участника",
        "member_add" to "Добавление участника",
        "server_update" to "Обновление сервера",
        "message_delete" to "Удаление сообщения",
    )

private val AuditDateFormatter =
    DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale("ru"))

private fun formatAuditDate(raw: String?): String {
    if (raw.isNullOrBlank()) return "—"
    return runCatching {
        AuditDateFormatter.format(Instant.parse(raw).atZone(ZoneId.systemDefault()))
    }.getOrDefault("—")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerAuditLogPanel(
    entries: List<AuditLogEntry>,
    totalCount: Int,
    isLoading: Boolean,
    actionFilter: String,
    onActionFilterChange: (String) -> Unit,
    onLoadMore: () -> Unit,
    modifier: Modifier = Modifier,
    embeddedInParentScroll: Boolean = false,
) {
    val filtered =
        remember(entries, actionFilter) {
            if (actionFilter == "all") entries
            else entries.filter { it.actionType == actionFilter }
        }
    val hasMore = entries.size < totalCount

    Column(
        modifier = if (embeddedInParentScroll) {
            modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)
        } else {
            modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 4.dp)
        },
    ) {
        Text(
            text = "Отображаются действия на сервере: каналы, категории, роли, участники и сообщения.",
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            modifier = Modifier.padding(bottom = 10.dp),
        )

        AuditFilterDropdown(
            selected = actionFilter,
            onSelected = onActionFilterChange,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(10.dp))

        Surface(
            modifier = if (embeddedInParentScroll) Modifier.fillMaxWidth() else Modifier.fillMaxSize(),
            color = DiscordModalCard,
            shape = RoundedCornerShape(16.dp),
        ) {
            when {
                isLoading && entries.isEmpty() -> {
                    Box(
                        Modifier.then(if (embeddedInParentScroll) Modifier.fillMaxWidth().height(160.dp) else Modifier.fillMaxSize()),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = TelegramMessageUi.AccentBlue, strokeWidth = 2.dp)
                    }
                }

                filtered.isEmpty() -> {
                    Box(
                        Modifier.then(if (embeddedInParentScroll) Modifier.fillMaxWidth().height(160.dp) else Modifier.fillMaxSize()),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = if (entries.isEmpty()) "Журнал пуст" else "Нет записей для выбранного фильтра",
                            color = DiscordTextSecondary,
                            fontSize = 14.sp,
                        )
                    }
                }

                embeddedInParentScroll -> {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                    ) {
                        filtered.forEach { entry ->
                            AuditLogRow(entry = entry)
                            HorizontalDivider(
                                color = MaterialTheme.colorScheme.outline,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        if (hasMore) {
                            AuditLoadMoreRow(isLoading = isLoading, onLoadMore = onLoadMore)
                        }
                    }
                }

                else -> {
                    LazyColumn(
                        Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 12.dp),
                    ) {
                        items(filtered, key = { it.idValue.ifBlank { "${it.createdAt}-${it.actionType}" } }) { entry ->
                            AuditLogRow(entry = entry)
                            HorizontalDivider(
                                color = MaterialTheme.colorScheme.outline,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }

                        if (hasMore) {
                            item {
                                AuditLoadMoreRow(isLoading = isLoading, onLoadMore = onLoadMore)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AuditLoadMoreRow(
    isLoading: Boolean,
    onLoadMore: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !isLoading, onClick = onLoadMore)
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = TelegramMessageUi.AccentBlue,
                strokeWidth = 2.dp,
                modifier = Modifier.height(24.dp),
            )
        } else {
            Text(
                text = "Загрузить ещё",
                color = TelegramMessageUi.AccentBlue,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AuditFilterDropdown(
    selected: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    val label = AuditActionFilters.firstOrNull { it.first == selected }?.second ?: "Все действия"

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier,
    ) {
        OutlinedTextField(
            value = label,
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth(),
            leadingIcon = {
                Icon(Icons.Default.FilterList, contentDescription = null, tint = DiscordTextSecondary)
            },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            singleLine = true,
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            AuditActionFilters.forEach { (value, title) ->
                DropdownMenuItem(
                    text = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    onClick = {
                        onSelected(value)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun AuditLogRow(entry: AuditLogEntry) {
    val avatarColor =
        entry.avatarColor?.let {
            runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
        } ?: TelegramMessageUi.AccentBlue

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AvatarWithPresenceIndicator(
                name = entry.usernameValue,
                avatarUrl = resolveServerIconUrl(entry.avatar),
                avatarColor = avatarColor,
                status = null,
                size = 36.dp,
                animateDecoration = false,
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = entry.usernameValue,
                    color = DiscordText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = formatAuditDate(entry.createdAt),
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                )
            }
        }

        Text(
            text = entry.actionLabelValue,
            color = DiscordText,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = entry.targetText,
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
