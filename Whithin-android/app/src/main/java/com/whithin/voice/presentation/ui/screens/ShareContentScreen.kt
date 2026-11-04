package com.whithin.voice.presentation.ui.screens

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.presentation.share.SharePayload
import com.whithin.voice.presentation.ui.components.ForwardTargetRow
import com.whithin.voice.presentation.ui.components.buildForwardListItems
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.ShareContentViewModel

private val ShareScreenBackground = Color(0xFF000000)
private val ShareListSurface = Color(0xFF1A1A1A)
private val ShareSearchBackground = Color(0xFF2B2D31)
private val ShareInputBackground = Color(0xFF2B2D31)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareContentScreen(
    sharePayload: SharePayload?,
    userId: String,
    username: String,
    onBack: () -> Unit,
    onSent: (chatId: String, chatName: String) -> Unit,
    viewModel: ShareContentViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsUiState()
    var searchQuery by remember { mutableStateOf("") }
    var caption by remember(sharePayload) { mutableStateOf("") }
    var pendingTargetChat by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(userId) {
        if (userId.isNotBlank()) {
            viewModel.loadTargets(userId)
        }
    }

    LaunchedEffect(sharePayload) {
        if (sharePayload == null) {
            onBack()
        }
    }

    LaunchedEffect(uiState.sendSuccess, pendingTargetChat) {
        val target = pendingTargetChat ?: return@LaunchedEffect
        if (!uiState.sendSuccess) return@LaunchedEffect
        viewModel.clearSendSuccess()
        pendingTargetChat = null
        onSent(target.first, target.second)
    }

    LaunchedEffect(uiState.error, uiState.isSending, pendingTargetChat) {
        if (pendingTargetChat == null || uiState.isSending) return@LaunchedEffect
        if (uiState.error != null) {
            pendingTargetChat = null
        }
    }

    BackHandler(enabled = !uiState.isSending) {
        onBack()
    }

    val payload = sharePayload ?: return

    val filteredTargets =
        remember(uiState.chats, uiState.channels, searchQuery) {
            val items =
                buildForwardListItems(
                    chats = uiState.chats,
                    channelTargets = uiState.channels,
                )
            val query = searchQuery.trim().lowercase()
            if (query.isBlank()) {
                items
            } else {
                items.filter { item -> item.searchText.lowercase().contains(query) }
            }
        }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(ShareScreenBackground)
                .statusBarsPadding()
                .navigationBarsPadding(),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, enabled = !uiState.isSending) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Закрыть",
                    tint = DiscordText,
                )
            }
            Text(
                text = "Отправить в Whithin",
                color = DiscordText,
                modifier = Modifier.weight(1f),
                scrambleOnce = false,
            )
        }

        SharePreviewCard(payload = payload)

        TextField(
            value = caption,
            onValueChange = { caption = it },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = {
                Text("Добавить комментарий…", color = DiscordTextSecondary, scrambleOnce = false)
            },
            singleLine = false,
            maxLines = 4,
            shape = RoundedCornerShape(16.dp),
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = ShareInputBackground,
                    unfocusedContainerColor = ShareInputBackground,
                    disabledContainerColor = ShareInputBackground,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent,
                    cursorColor = DiscordAccent,
                    focusedTextColor = DiscordText,
                    unfocusedTextColor = DiscordText,
                ),
        )

        TextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
            placeholder = {
                Text("Поиск чата или канала", color = DiscordTextSecondary, scrambleOnce = false)
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = null,
                    tint = DiscordTextSecondary,
                    modifier = Modifier.size(20.dp),
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = ShareSearchBackground,
                    unfocusedContainerColor = ShareSearchBackground,
                    disabledContainerColor = ShareSearchBackground,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent,
                    cursorColor = DiscordAccent,
                    focusedTextColor = DiscordText,
                    unfocusedTextColor = DiscordText,
                ),
        )

        uiState.error?.let { error ->
            Text(
                text = error,
                color = Color(0xFFED4245),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                scrambleOnce = false,
            )
        }

        Surface(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 12.dp, vertical = 4.dp),
            shape = RoundedCornerShape(20.dp),
            color = ShareListSurface,
        ) {
            when {
                uiState.isLoading && filteredTargets.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = DiscordAccent)
                    }
                }

                filteredTargets.isEmpty() -> {
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
                            color = DiscordTextSecondary,
                            scrambleOnce = false,
                        )
                    }
                }

                else -> {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(
                            items = filteredTargets,
                            key = { it.chatId },
                        ) { target ->
                            ForwardTargetRow(
                                item = target,
                                onClick = {
                                    if (uiState.isSending) return@ForwardTargetRow
                                    pendingTargetChat = target.chatId to target.title
                                    viewModel.sendToChat(
                                        payload = payload,
                                        chatId = target.chatId,
                                        username = username,
                                        extraCaption = caption,
                                    )
                                },
                            )
                        }
                    }
                }
            }
        }

        if (uiState.isSending) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = DiscordAccent,
                    strokeWidth = 2.dp,
                )
                Spacer(modifier = Modifier.size(12.dp))
                Text("Отправка…", color = DiscordTextSecondary, scrambleOnce = false)
            }
        }
    }
}

@Composable
private fun SharePreviewCard(payload: SharePayload) {
    Surface(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(16.dp),
        color = ShareInputBackground,
    ) {
        when (payload) {
            is SharePayload.Text -> {
                Text(
                    text = payload.text,
                    color = DiscordText,
                    modifier = Modifier.padding(16.dp),
                    maxLines = 6,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
            }

            is SharePayload.Media -> {
                val isImage = payload.mimeType?.startsWith("image/") == true
                if (isImage) {
                    val context = LocalContext.current
                    val h = with(LocalDensity.current) { 180.dp.roundToPx() }
                    val request =
                        remember(payload.uri, h) {
                            sizedImageRequest(context, payload.uri, 1080, h)
                        }
                    AsyncImage(
                        model = request,
                        contentDescription = null,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)),
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Default.AttachFile,
                            contentDescription = null,
                            tint = DiscordAccent,
                            modifier = Modifier.size(28.dp),
                        )
                        Spacer(modifier = Modifier.size(12.dp))
                        Text(
                            text = payload.mimeType ?: "Файл",
                            color = DiscordText,
                            scrambleOnce = false,
                        )
                    }
                }

                payload.previewText?.let { text ->
                    Text(
                        text = text,
                        color = DiscordTextSecondary,
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                        scrambleOnce = false,
                    )
                }
            }
        }
    }
}
