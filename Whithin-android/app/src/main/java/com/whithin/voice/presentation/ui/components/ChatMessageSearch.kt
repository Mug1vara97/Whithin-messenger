package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.Message
import com.whithin.voice.presentation.ui.components.AppText as Text
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.utils.formatE2eMessageDisplayText
import kotlinx.coroutines.delay

@Composable
fun ChatMessageSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    // Как ChatHeader: фон под status bar, контент ниже выреза/шапки телефона.
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(TelegramMessageUi.ChatHeaderBackground),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 6.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = DiscordTextSecondary,
                modifier = Modifier.padding(start = 8.dp),
            )
            TextField(
                value = query,
                onValueChange = onQueryChange,
                modifier =
                    Modifier
                        .weight(1f)
                        .focusRequester(focusRequester),
                singleLine = true,
                placeholder = {
                    Text("Поиск сообщений", color = DiscordTextSecondary, fontSize = 15.sp)
                },
                colors =
                    TextFieldDefaults.colors(
                        focusedTextColor = DiscordText,
                        unfocusedTextColor = DiscordText,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        disabledContainerColor = Color.Transparent,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        cursorColor = TelegramMessageUi.AccentBlue,
                    ),
            )
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, contentDescription = "Закрыть поиск", tint = DiscordText)
            }
        }
    }
}

@Composable
fun ChatMessageSearchResults(
    query: String,
    results: List<Message>,
    isSearching: Boolean,
    timeLabel: (Message) -> String,
    onResultClick: (Message) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (query.isBlank()) return

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(TelegramMessageUi.InputBackground)
                .heightIn(max = 280.dp),
    ) {
        Text(
            text =
                when {
                    isSearching -> "Поиск…"
                    results.isEmpty() -> "Ничего не найдено"
                    else -> "Найдено: ${results.size}"
                },
            color = DiscordTextSecondary,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        )

        if (isSearching && results.isEmpty()) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(22.dp),
                    strokeWidth = 2.dp,
                    color = TelegramMessageUi.AccentBlue,
                )
            }
            return
        }

        LazyColumn {
            items(results, key = { it.messageIdValue }) { message ->
                val preview = remember(message.messageIdValue, message.contentValue) {
                    formatE2eMessageDisplayText(message)
                        .replace('\n', ' ')
                        .trim()
                        .ifBlank { "Медиа / вложение" }
                }
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { onResultClick(message) }
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = message.senderUsernameValue.ifBlank { "Участник" },
                                color = DiscordText,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = timeLabel(message),
                                color = DiscordTextSecondary,
                                fontSize = 11.sp,
                                maxLines = 1,
                            )
                        }
                        Text(
                            text = preview,
                            color = DiscordTextSecondary,
                            fontSize = 13.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }
        }
    }
}

/**
 * Debounced client-side search over currently loaded chat messages.
 */
@Composable
fun rememberChatMessageSearch(
    messages: List<Message>,
    query: String,
): Pair<List<Message>, Boolean> {
    var results by remember { mutableStateOf<List<Message>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    LaunchedEffect(query, messages) {
        val trimmed = query.trim()
        if (trimmed.isEmpty()) {
            results = emptyList()
            isSearching = false
            return@LaunchedEffect
        }
        isSearching = true
        delay(180)
        val needle = trimmed.lowercase()
        results =
            messages
                .asSequence()
                .filter { message ->
                    val content = formatE2eMessageDisplayText(message).lowercase()
                    val sender = message.senderUsernameValue.lowercase()
                    content.contains(needle) || sender.contains(needle)
                }
                .sortedByDescending { it.createdAtValue }
                .take(80)
                .toList()
        isSearching = false
    }

    return results to isSearching
}
