package com.whithin.voice.presentation.ui.components

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import com.whithin.voice.data.model.Message
import com.whithin.voice.presentation.ui.media.MediaViewerState
import com.whithin.voice.presentation.viewmodel.ChatViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Stable message-row callbacks so LazyColumn items skip recomposition when typing in composer. */
@Immutable
data class MessageRowEventHandlers(
    val onOpenMediaViewer: (MediaViewerState) -> Unit,
    val onFileDownload: (com.whithin.voice.data.model.MediaFile) -> Unit,
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
    val onVideoNoteScroll: () -> Unit,
)

@Composable
fun rememberMessageRowEventHandlers(
    chatViewModel: ChatViewModel,
    context: Context,
    scope: CoroutineScope,
    showSnackbar: suspend (String) -> Unit,
    onOpenMediaViewer: (MediaViewerState) -> Unit,
    onVideoNoteScroll: () -> Unit,
    onCopyTextClick: (Message) -> Unit,
    onCopyImageClick: (Message) -> Unit,
    onCopyVideoClick: (Message) -> Unit,
    onSaveAsClick: (Message) -> Unit,
): MessageRowEventHandlers {
    return remember(
        chatViewModel,
        context,
        scope,
        onOpenMediaViewer,
        onVideoNoteScroll,
        onCopyTextClick,
        onCopyImageClick,
        onCopyVideoClick,
        onSaveAsClick,
    ) {
        MessageRowEventHandlers(
            onOpenMediaViewer = onOpenMediaViewer,
            onFileDownload = { file -> chatViewModel.downloadMediaFile(context, file) },
            onReplyClick = { chatViewModel.setReplyMessage(it) },
            onEditClick = { chatViewModel.setEditingMessage(it) },
            onCopyTextClick = onCopyTextClick,
            onCopyImageClick = onCopyImageClick,
            onCopyVideoClick = onCopyVideoClick,
            onSaveAsClick = onSaveAsClick,
            onDeleteClick = { msg ->
                chatViewModel.deleteMessage(msg) { result ->
                    result.onFailure { e ->
                        scope.launch {
                            showSnackbar(e.message ?: "Не удалось удалить сообщение")
                        }
                    }
                }
            },
            onForwardClick = { chatViewModel.startForwardMessage(it) },
            onSelectClick = { chatViewModel.enterSelectionMode(it.messageIdValue) },
            onToggleSelection = { chatViewModel.toggleMessageSelection(it.messageIdValue) },
            onPinClick = { msg ->
                chatViewModel.pinMessage(msg.messageIdValue) { result ->
                    result.onFailure { e ->
                        scope.launch { showSnackbar(e.message ?: "Не удалось закрепить") }
                    }
                }
            },
            onUnpinClick = { msg ->
                chatViewModel.unpinMessage(msg.messageIdValue) { result ->
                    result.onFailure { e ->
                        scope.launch { showSnackbar(e.message ?: "Не удалось открепить") }
                    }
                }
            },
            onSaveToFavoritesClick = { msg ->
                chatViewModel.saveMessageToFavorites(msg.messageIdValue) { result ->
                    scope.launch {
                        result
                            .onSuccess { showSnackbar("Сохранено в избранное") }
                            .onFailure { e ->
                                showSnackbar(e.message ?: "Не удалось сохранить")
                            }
                    }
                }
            },
            onVotePoll = { messageId, optionIds ->
                chatViewModel.votePoll(messageId, optionIds)
            },
            onVideoNoteScroll = onVideoNoteScroll,
        )
    }
}
