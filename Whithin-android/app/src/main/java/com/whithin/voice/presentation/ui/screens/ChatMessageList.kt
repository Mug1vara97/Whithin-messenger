package com.whithin.voice.presentation.ui.screens

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.data.model.Message
import com.whithin.voice.presentation.ui.media.MediaViewerState
import com.whithin.voice.presentation.ui.utils.getCopyableMessageText
import com.whithin.voice.presentation.ui.utils.getMessageContextMenuActions
import com.whithin.voice.presentation.viewmodel.ChatViewModel
import androidx.compose.material3.SnackbarHostState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Stable
class MessageRowEventHandlers(
    val onOpenMediaViewer: (MediaViewerState) -> Unit,
    val onFileDownload: (MediaFile) -> Unit,
    val onReplyClick: (Message) -> Unit,
    val onEditClick: (Message) -> Unit,
    val onCopyTextClick: (Message) -> Unit,
    val onCopyImageClick: (Message) -> Unit,
    val onCopyVideoClick: (Message) -> Unit,
    val onSaveAsClick: (Message) -> Unit,
    val onDeleteClick: (Message) -> Unit,
    val onForwardClick: (Message) -> Unit,
    val onSelectClick: (Message) -> Unit,
    val onToggleSelection: (Message) -> Unit,
    val onPinClick: (Message) -> Unit,
    val onUnpinClick: (Message) -> Unit,
    val onSaveToFavoritesClick: (Message) -> Unit,
    val onVotePoll: (String, List<String>) -> Unit,
    val onVideoNoteOpen: () -> Unit,
)

@Composable
fun rememberMessageRowEventHandlers(
    chatViewModel: ChatViewModel,
    context: Context,
    scope: CoroutineScope,
    snackbarHostState: SnackbarHostState,
    onOpenMediaViewer: (MediaViewerState) -> Unit,
    onVideoNoteOpen: () -> Unit,
): MessageRowEventHandlers {
    val clipboard = LocalClipboardManager.current
    val onOpenMediaViewerState = rememberUpdatedState(onOpenMediaViewer)
    val onVideoNoteOpenState = rememberUpdatedState(onVideoNoteOpen)
    return remember(chatViewModel, context, clipboard, scope, snackbarHostState) {
        MessageRowEventHandlers(
            onOpenMediaViewer = { onOpenMediaViewerState.value(it) },
            onFileDownload = { file -> chatViewModel.downloadMediaFile(context, file) },
            onReplyClick = { chatViewModel.setReplyMessage(it) },
            onEditClick = { chatViewModel.setEditingMessage(it) },
            onCopyTextClick = { message ->
                val text = getCopyableMessageText(message)
                if (text.isNotBlank()) {
                    clipboard.setText(AnnotatedString(text))
                    scope.launch { snackbarHostState.showSnackbar("Скопировано") }
                }
            },
            onCopyImageClick = { message ->
                val file = getMessageContextMenuActions(message).images.firstOrNull()
                if (file != null) {
                    chatViewModel.downloadMediaFile(context, file)
                    scope.launch { snackbarHostState.showSnackbar("Файл сохранён") }
                }
            },
            onCopyVideoClick = { message ->
                val file = getMessageContextMenuActions(message).videos.firstOrNull()
                if (file != null) {
                    chatViewModel.downloadMediaFile(context, file)
                    scope.launch { snackbarHostState.showSnackbar("Файл сохранён") }
                }
            },
            onSaveAsClick = { message ->
                getMessageContextMenuActions(message).savableMedia.forEach {
                    chatViewModel.downloadMediaFile(context, it)
                }
            },
            onDeleteClick = { msg ->
                chatViewModel.deleteMessage(msg) { result ->
                    result.onFailure { e ->
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                e.message ?: "Не удалось удалить сообщение",
                            )
                        }
                    }
                }
            },
            onForwardClick = { chatViewModel.startForwardMessage(it) },
            onSelectClick = { msg -> chatViewModel.enterSelectionMode(msg.messageIdValue) },
            onToggleSelection = { msg -> chatViewModel.toggleMessageSelection(msg.messageIdValue) },
            onPinClick = { msg ->
                chatViewModel.pinMessage(msg.messageIdValue) { result ->
                    result.onFailure { e ->
                        scope.launch {
                            snackbarHostState.showSnackbar(e.message ?: "Не удалось закрепить")
                        }
                    }
                }
            },
            onUnpinClick = { msg ->
                chatViewModel.unpinMessage(msg.messageIdValue) { result ->
                    result.onFailure { e ->
                        scope.launch {
                            snackbarHostState.showSnackbar(e.message ?: "Не удалось открепить")
                        }
                    }
                }
            },
            onSaveToFavoritesClick = { msg ->
                chatViewModel.saveMessageToFavorites(msg.messageIdValue) { result ->
                    result
                        .onSuccess {
                            scope.launch {
                                snackbarHostState.showSnackbar("Сохранено в избранное")
                            }
                        }
                        .onFailure { e ->
                            scope.launch {
                                snackbarHostState.showSnackbar(
                                    e.message ?: "Не удалось сохранить",
                                )
                            }
                        }
                }
            },
            onVotePoll = { messageId, optionIds ->
                chatViewModel.votePoll(messageId, optionIds)
            },
            onVideoNoteOpen = { onVideoNoteOpenState.value() },
        )
    }
}
