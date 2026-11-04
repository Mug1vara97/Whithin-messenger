package com.whithin.voice.presentation.ui.screens

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.ForwardListItem
import com.whithin.voice.data.model.Message
import com.whithin.voice.presentation.ui.components.ForwardTargetRow
import com.whithin.voice.presentation.ui.components.buildForwardListItems
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.ChatViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForwardMessageScreen(
    currentChatId: String,
    userId: String,
    chatViewModel: ChatViewModel,
    onBack: () -> Unit,
    onShowMessage: (String) -> Unit,
) {
    val chatState by chatViewModel.uiState.collectAsUiState()
    val forwardMessage = chatState.forwardMessage
    val forwardChats by chatViewModel.chats.collectAsUiState()
    val forwardChannels by chatViewModel.forwardChannels.collectAsUiState()
    val forwardTargetsLoading by chatViewModel.forwardTargetsLoading.collectAsUiState()
    val clipboard = LocalClipboardManager.current

    var searchQuery by remember { mutableStateOf("") }
    var comment by remember(forwardMessage?.messageIdValue) { mutableStateOf("") }
    var selectedIds by remember { mutableStateOf(setOf<String>()) }
    var isSending by remember { mutableStateOf(false) }

    LaunchedEffect(forwardMessage?.messageIdValue, userId) {
        if (forwardMessage != null && userId.isNotBlank()) {
            chatViewModel.ensureForwardTargets(userId)
        }
    }

    BackHandler {
        if (!isSending) {
            chatViewModel.cancelForwardMessage()
            onBack()
        }
    }

    val listItems =
        remember(forwardChats, forwardChannels, currentChatId) {
            buildForwardListItems(
                chats = forwardChats,
                channelTargets = forwardChannels,
                currentChatId = currentChatId,
            )
        }
    val searchEntries =
        remember(listItems) {
            listItems.map { item -> item to item.searchText.lowercase() }
        }
    val filteredItems =
        remember(searchEntries, searchQuery) {
            val query = searchQuery.trim().lowercase()
            if (query.isBlank()) {
                listItems
            } else {
                searchEntries
                    .asSequence()
                    .filter { (_, searchLower) -> searchLower.contains(query) }
                    .map { (item, _) -> item }
                    .toList()
            }
        }

    val colorScheme = MaterialTheme.colorScheme
    val forwardBackground = colorScheme.background
    val forwardListSurface = colorScheme.surface
    val forwardFieldSurface = colorScheme.surfaceVariant

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(forwardBackground)
                .statusBarsPadding()
                .navigationBarsPadding(),
    ) {
        ForwardTopBar(
            onClose = {
                if (!isSending) {
                    chatViewModel.cancelForwardMessage()
                    onBack()
                }
            },
            onCopyLink = {
                forwardMessage?.let { msg ->
                    val text = buildMessageLinkText(msg)
                    clipboard.setText(AnnotatedString(text))
                    onShowMessage("Ссылка скопирована")
                }
            },
        )

        TextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = {
                Text("Поиск", color = colorScheme.onSurfaceVariant, scrambleOnce = false)
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = null,
                    tint = colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp),
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = forwardFieldSurface,
                    unfocusedContainerColor = forwardFieldSurface,
                    disabledContainerColor = forwardFieldSurface,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent,
                    cursorColor = colorScheme.primary,
                    focusedTextColor = colorScheme.onSurface,
                    unfocusedTextColor = colorScheme.onSurface,
                ),
        )

        Surface(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 12.dp, vertical = 4.dp),
            shape = RoundedCornerShape(20.dp),
            color = forwardListSurface,
        ) {
            when {
                forwardTargetsLoading && listItems.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = colorScheme.primary)
                    }
                }
                filteredItems.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text =
                                if (searchQuery.isNotBlank()) {
                                    "Ничего не найдено"
                                } else {
                                    "Нет доступных чатов и каналов"
                                },
                            color = colorScheme.onSurfaceVariant,
                            scrambleOnce = false,
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(
                            items = filteredItems,
                            key = { it.chatId },
                        ) { item ->
                            ForwardTargetRow(
                                item = item,
                                isSelected = selectedIds.contains(item.chatId),
                                showSelection = true,
                                onClick = {
                                    selectedIds =
                                        if (selectedIds.contains(item.chatId)) {
                                            selectedIds - item.chatId
                                        } else {
                                            selectedIds + item.chatId
                                        }
                                },
                            )
                        }
                        if (forwardTargetsLoading) {
                            item {
                                Box(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 12.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        color = colorScheme.primary,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        ForwardBottomBar(
            comment = comment,
            onCommentChange = { comment = it },
            selectedCount = selectedIds.size,
            isSending = isSending,
            fieldSurfaceColor = forwardFieldSurface,
            onSend = {
                if (selectedIds.isEmpty() || isSending) return@ForwardBottomBar
                isSending = true
                chatViewModel.forwardMessagesToTargets(
                    targetChatIds = selectedIds.toList(),
                    comment = comment,
                    activeChatId = currentChatId,
                ) { result ->
                    isSending = false
                    result
                        .onSuccess { count ->
                            onShowMessage(
                                if (count == 1) {
                                    "Сообщение переслано"
                                } else {
                                    "Переслано в $count чатов"
                                },
                            )
                            onBack()
                        }
                        .onFailure { error ->
                            onShowMessage(
                                error.message ?: "Не удалось переслать сообщение",
                            )
                        }
                }
            },
        )
    }
}

@Composable
private fun ForwardTopBar(
    onClose: () -> Unit,
    onCopyLink: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onClose) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Закрыть",
                tint = colorScheme.onSurface,
            )
        }
        Text(
            text = "Переслать",
            modifier = Modifier.weight(1f),
            color = colorScheme.onSurface,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            scrambleOnce = false,
        )
        IconButton(onClick = onCopyLink) {
            Icon(
                imageVector = Icons.Default.Link,
                contentDescription = "Копировать ссылку",
                tint = colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun ForwardBottomBar(
    comment: String,
    onCommentChange: (String) -> Unit,
    selectedCount: Int,
    isSending: Boolean,
    fieldSurfaceColor: Color,
    onSend: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    val canSend = selectedCount > 0 && !isSending
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TextField(
            value = comment,
            onValueChange = onCommentChange,
            modifier = Modifier.weight(1f),
            placeholder = {
                Text(
                    "Добавить сообщение (необязательно)",
                    color = colorScheme.onSurfaceVariant,
                    fontSize = 14.sp,
                    scrambleOnce = false,
                )
            },
            singleLine = true,
            maxLines = 1,
            shape = RoundedCornerShape(20.dp),
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = fieldSurfaceColor,
                    unfocusedContainerColor = fieldSurfaceColor,
                    disabledContainerColor = fieldSurfaceColor,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent,
                    cursorColor = colorScheme.primary,
                    focusedTextColor = colorScheme.onSurface,
                    unfocusedTextColor = colorScheme.onSurface,
                ),
        )

        Surface(
            onClick = onSend,
            enabled = canSend,
            shape = CircleShape,
            color =
                if (canSend) {
                    colorScheme.primary
                } else {
                    colorScheme.primary.copy(alpha = 0.45f)
                },
            modifier = Modifier.size(48.dp),
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                if (isSending) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Отправить ($selectedCount)",
                        tint = colorScheme.onPrimary,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
        }
    }
}

private fun buildMessageLinkText(message: Message): String {
    val preview =
        message.contentValue.ifBlank {
            when {
                message.mediaFilesValue.isNotEmpty() -> "Медиа"
                else -> "Сообщение"
            }
        }
    val sender = message.senderUsernameValue.ifBlank { "Unknown" }
    return "https://whithin.ru — $sender: $preview"
}
