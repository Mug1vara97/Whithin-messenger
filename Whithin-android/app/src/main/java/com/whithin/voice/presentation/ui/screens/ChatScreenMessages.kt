@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.whithin.voice.presentation.ui.screens

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.foundation.border
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import com.whithin.voice.util.ChatCallSignalingState
import com.whithin.voice.util.OutgoingCallRingtone
import com.whithin.voice.util.formatCallLogText
import com.whithin.voice.util.parseCallLogPayload
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Forward
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Reply
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.SaveAlt
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.outlined.Poll
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.FlipCameraAndroid
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material.icons.outlined.Interests
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import com.whithin.voice.presentation.ui.components.TelegramMessagePopupMenu
import com.whithin.voice.presentation.ui.components.TelegramPopupMenuEntry
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitLongPressOrCancellation
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.viewinterop.AndroidView
import androidx.camera.view.PreviewView
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.whithin.voice.data.model.Message
import com.whithin.voice.data.model.RepliedMessage
import androidx.activity.ComponentActivity
import com.whithin.voice.presentation.ui.components.ChatInfoModal
import com.whithin.voice.presentation.ui.components.AvatarWithPresenceIndicator
import com.whithin.voice.presentation.ui.components.SwipeBackContainer
import com.whithin.voice.presentation.ui.components.ForwardedMessageSnippet
import com.whithin.voice.presentation.ui.components.LinkifiedMessageText
import com.whithin.voice.presentation.ui.components.MessageStatusIndicator
import com.whithin.voice.presentation.ui.components.LocalChatAnimationsAllowed
import com.whithin.voice.presentation.ui.components.LocalChatListScrolling
import com.whithin.voice.presentation.ui.components.ChatSwipeReplyState
import com.whithin.voice.presentation.ui.components.chatSwipeReplyOverlay
import com.whithin.voice.presentation.ui.components.chatSwipeReplyRow
import com.whithin.voice.presentation.ui.components.rememberChatSwipeReplyState
import com.whithin.voice.presentation.ui.media.ChatAnimationPlayback
import com.whithin.voice.presentation.ui.components.ChatVoicePresenceBar
import com.whithin.voice.presentation.ui.components.formatTypingLabel
import com.whithin.voice.presentation.ui.components.buildChatVoiceParticipants
import com.whithin.voice.presentation.notifications.PushNotificationTitles
import com.whithin.voice.presentation.ui.components.ChatMessagesSkeleton
import com.whithin.voice.presentation.ui.components.ProvideTextScramble
import com.whithin.voice.presentation.ui.components.ImageMessageItem
import com.whithin.voice.presentation.ui.components.buildMessageMediaUrl
import com.whithin.voice.presentation.ui.components.FileMessageItem
import com.whithin.voice.presentation.ui.components.MediaViewerOverlay
import com.whithin.voice.presentation.ui.components.TelegramMessageUi
import com.whithin.voice.presentation.ui.components.VideoMessageItem
import com.whithin.voice.presentation.ui.components.ChatMessageSearchField
import com.whithin.voice.presentation.ui.components.ChatMessageSearchResults
import com.whithin.voice.presentation.ui.components.rememberChatMessageSearch
import com.whithin.voice.presentation.ui.utils.ChatComposerDrafts
import com.whithin.voice.presentation.ui.components.ComposerInputMaxHeightDp
import com.whithin.voice.presentation.ui.components.ComposerMessageMaxLines
import com.whithin.voice.presentation.ui.components.VoiceComposerBarHeightDp
import com.whithin.voice.presentation.ui.components.ComposerActionButton
import com.whithin.voice.presentation.ui.components.ComposerActionButtonSize
import com.whithin.voice.presentation.ui.components.ComposerHoldActionOrb
import com.whithin.voice.presentation.ui.components.ComposerHoldOrbOuterDp
import com.whithin.voice.presentation.ui.components.ComposerPauseFabOffsetY
import com.whithin.voice.presentation.ui.components.ComposerPillCornerRadius
import com.whithin.voice.presentation.ui.components.ComposerRecordingPauseFab
import com.whithin.voice.presentation.ui.components.ComposerRecordingSendOrb
import com.whithin.voice.presentation.ui.components.ComposerRowGap
import com.whithin.voice.presentation.ui.components.composerPillSurface
import com.whithin.voice.presentation.ui.components.VoiceMessageItem
import com.whithin.voice.presentation.ui.components.RecordingComposerSession
import com.whithin.voice.presentation.ui.components.VideoNoteRecordingSession
import com.whithin.voice.presentation.ui.media.MediaViewerState
import com.whithin.voice.presentation.ui.media.buildViewerStateFromMediaListByUrl
import com.whithin.voice.presentation.ui.media.buildViewerStateFromMessage
import com.whithin.voice.presentation.ui.components.VoiceRecordingHoldBar
import com.whithin.voice.presentation.ui.components.VoiceRecordingLockedBar
import com.whithin.voice.presentation.ui.components.VoiceRecordingSession
import com.whithin.voice.presentation.ui.components.VoiceRecordingSessionEffects
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.notifications.ActiveChatState
import com.whithin.voice.presentation.ui.components.StickerMedia
import com.whithin.voice.presentation.ui.components.ChatBottomSheet
import com.whithin.voice.presentation.ui.components.ExpressionPanelTab
import com.whithin.voice.presentation.ui.components.EmojiPickerSheet
import com.whithin.voice.presentation.ui.components.StickerPickerSheet
import com.whithin.voice.presentation.ui.components.ImageEditOverlay
import com.whithin.voice.presentation.ui.components.MediaSendOverlay
import com.whithin.voice.presentation.ui.components.MessageFileGroup
import com.whithin.voice.presentation.ui.components.MessageMediaAlbumGrid
import com.whithin.voice.presentation.ui.components.MultiMediaSendOverlay
import com.whithin.voice.presentation.ui.components.PendingMediaSend
import com.whithin.voice.presentation.ui.components.MAX_BATCH_MEDIA_COUNT
import com.whithin.voice.presentation.ui.components.filterBatchSendableUris
import com.whithin.voice.presentation.ui.components.VideoEditOverlay
import com.whithin.voice.presentation.ui.components.VideoSpatialCrop
import com.whithin.voice.presentation.ui.components.resolveEditedImageSend
import com.whithin.voice.presentation.ui.components.resolvePendingMediaSend
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.util.visibleName
import com.whithin.voice.presentation.ui.components.CreatePollSheet
import com.whithin.voice.presentation.ui.components.MessageSelectionBar
import com.whithin.voice.presentation.ui.components.PinnedMessagesBar
import com.whithin.voice.presentation.ui.components.PollMessageContent
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.ui.media.resolveAvatarUrl
import com.whithin.voice.presentation.ui.utils.formatE2eMessageDisplayText
import com.whithin.voice.presentation.ui.utils.formatPresenceLabel
import com.whithin.voice.presentation.ui.utils.getCopyableMessageText
import com.whithin.voice.presentation.ui.utils.getMessageContextMenuActions
import com.whithin.voice.presentation.ui.utils.getPinnedMessagePreview
import com.whithin.voice.presentation.viewmodel.ChatViewModel
import com.whithin.voice.presentation.viewmodel.StickerViewModel
import com.whithin.voice.presentation.viewmodel.VoiceRoomViewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.io.File
import java.io.FileOutputStream
import kotlin.math.absoluteValue
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Immutable
internal sealed interface ChatListItem {
    @Immutable
    data class DateSeparator(val label: String, val key: String) : ChatListItem
    @Immutable
    data class MessageRow(val entry: MessageEntry) : ChatListItem
}

@Immutable
internal data class MessageEntry(
    val message: Message,
    val isOwn: Boolean,
    val showAvatar: Boolean,
    val showAvatarColumn: Boolean,
    val showSender: Boolean,
    val isFirstInGroup: Boolean,
    val isLastInGroup: Boolean,
    val rowType: String,
)

internal const val MessageGroupWindowMs = 5 * 60 * 1000L

internal val DiscordUsernameColors =
    listOf(
        Color(0xFFE01E5A),
        Color(0xFFEB459E),
        Color(0xFFFFA02D),
        Color(0xFFE7C22C),
        Color(0xFF98D39B),
        Color(0xFF3BA55C),
        Color(0xFF45B691),
        Color(0xFF1ABC9C),
        Color(0xFF00B4DC),
        Color(0xFF45B6FB),
        Color(0xFF5865ED),
        Color(0xFF9B59B6),
    )

internal fun discordUsernameColor(sender: String): Color {
    val h = sender.lowercase(Locale.getDefault()).hashCode().absoluteValue
    return DiscordUsernameColors[h % DiscordUsernameColors.size]
}

internal fun discordMessageTopPadding(): Dp = 14.dp

@Composable
internal fun rememberDiscordMediaMaxWidth(hasAvatarGutter: Boolean): Dp {
    val screenDp = LocalConfiguration.current.screenWidthDp.dp
    val gutter = if (hasAvatarGutter) 76.dp else 28.dp
    return (screenDp - gutter).coerceAtLeast(140.dp)
}

internal fun formatDiscordMessageTimestamp(value: String): String {
    val instant = parseInstant(value) ?: return ""
    return instant.atZone(ZoneId.systemDefault()).format(ChatDateTimeFormatter)
}

internal val DiscordMediaRounding =
    RoundedCornerShape(TelegramMessageUi.MediaCornerRadius)

internal fun isMessageEditable(message: Message, currentUsername: String): Boolean {
    val id = message.messageIdValue.trim()
    if (id.isBlank() || id.startsWith("temp_")) return false
    if (message.senderUsernameValue != currentUsername) return false
    return message.contentValue.isNotBlank()
}

@Composable
internal fun CallLogMessageRow(
    message: Message,
    currentUserId: String,
) {
    val payload = remember(message.contentValue) { parseCallLogPayload(message.contentValue) }
    val text = remember(payload, currentUserId) {
        payload?.let { formatCallLogText(it, currentUserId) }
    }
    if (text.isNullOrBlank()) return

    val isMissed = payload?.callEvent == "missed"
    val timeLabel = remember(message.createdAtValue) { formatChatTime(message.createdAtValue) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (isMissed) Icons.Filled.CallEnd else Icons.Filled.Call,
            contentDescription = null,
            tint =
                if (isMissed) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.secondary
                },
            modifier = Modifier.size(16.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        if (timeLabel.isNotBlank()) {
            Text(
                text = timeLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun MessageRow(
    entry: MessageEntry,
    currentUsername: String,
    currentUserId: String,
    currentChatId: String,
    savedMessagesChatId: String?,
    selectionMode: Boolean,
    isSelected: Boolean,
    contentMax: Dp,
    handlers: MessageRowEventHandlers,
    swipeReply: ChatSwipeReplyState? = null,
) {
    if (entry.message.isCallLogMessage) {
        CallLogMessageRow(
            message = entry.message,
            currentUserId = currentUserId,
        )
        return
    }

    var menuExpanded by remember(entry.message.messageIdValue) { mutableStateOf(false) }
    val senderName = entry.message.senderUsernameValue.ifEmpty { "Unknown" }
    val canSaveToFavorites =
        !savedMessagesChatId.isNullOrBlank() &&
            !savedMessagesChatId.equals(currentChatId, ignoreCase = true)
    val isPinned = entry.message.isPinnedValue
    val selectedBackground =
        if (selectionMode && isSelected) {
            MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
        } else {
            null
        }
    val onMessageClick = {
        if (selectionMode) {
            handlers.onToggleSelection(entry.message)
        }
    }
    val onMessageLongClick = {
        if (selectionMode) {
            handlers.onToggleSelection(entry.message)
        } else {
            menuExpanded = true
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = discordMessageTopPadding()),
    ) {
        // Свайп-ответ как в Telegram: общий трекер списка, строка только сдвигается
        // в graphicsLayer — дёшево даже для стикеров и фото.
        val swipeModifier =
            if (swipeReply != null) {
                Modifier
                    .fillMaxWidth()
                    .chatSwipeReplyRow(
                        state = swipeReply,
                        key = messageRowKey(entry.message),
                        isOwn = entry.isOwn,
                        enabled = !selectionMode,
                        onReply = { handlers.onReplyClick(entry.message) },
                    )
            } else {
                Modifier.fillMaxWidth()
            }
        Box(modifier = swipeModifier) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .then(
                        if (selectedBackground != null) {
                            Modifier.background(
                                color = selectedBackground,
                                shape = RoundedCornerShape(8.dp),
                            )
                        } else {
                            Modifier
                        },
                    )
                    .padding(
                        start = if (selectionMode) 6.dp else 0.dp,
                        end = if (selectionMode) 36.dp else 0.dp,
                        top = if (selectionMode) 4.dp else 0.dp,
                        bottom = if (selectionMode) 4.dp else 0.dp,
                    ),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.Top,
        ) {
        if (entry.showAvatarColumn) {
            Box(
                modifier =
                    Modifier
                        .width(52.dp)
                        .combinedClickable(
                            onClick = onMessageClick,
                            onLongClick = onMessageLongClick,
                        ),
                contentAlignment = Alignment.Center,
            ) {
                if (entry.showAvatar) {
                    Avatar(
                        senderName = senderName,
                        avatarUrl = entry.message.avatarUrlValue,
                        avatarColor = entry.message.avatarColorValue,
                        avatarDecoration = entry.message.avatarDecorationValue,
                        avatarSize = 40.dp,
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        Box(modifier = Modifier.weight(1f).widthIn(max = contentMax)) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .combinedClickable(
                            onClick = onMessageClick,
                            onLongClick = onMessageLongClick,
                        ),
            ) {
                DiscordMessageContent(
                    entry = entry,
                    mediaLayoutMaxWidth = contentMax,
                    onOpenMediaViewer = handlers.onOpenMediaViewer,
                    onFileDownload = handlers.onFileDownload,
                    onVotePoll = { optionIds ->
                        handlers.onVotePoll(entry.message.messageIdValue, optionIds)
                    },
                    onVideoNoteOpen = handlers.onVideoNoteOpen,
                    contentColor = DiscordText,
                    metaColor = DiscordTextSecondary,
                    showFooterMeta = !entry.showSender,
                )
            }

            if (menuExpanded) {
                val menuActions = getMessageContextMenuActions(entry.message)
                val popupItems =
                    buildList {
                        add(
                            TelegramPopupMenuEntry(
                                icon = Icons.Default.Reply,
                                title = "Ответить",
                                onClick = { handlers.onReplyClick(entry.message) },
                            ),
                        )
                        add(
                            TelegramPopupMenuEntry(
                                icon = Icons.Default.SelectAll,
                                title = "Выбрать",
                                onClick = { handlers.onSelectClick(entry.message) },
                            ),
                        )
                        add(
                            TelegramPopupMenuEntry(
                                icon = Icons.Default.Forward,
                                title = "Переслать",
                                onClick = { handlers.onForwardClick(entry.message) },
                            ),
                        )
                        if (menuActions.canCopyText) {
                            add(
                                TelegramPopupMenuEntry(
                                    icon = Icons.Default.ContentCopy,
                                    title = "Копировать",
                                    onClick = { handlers.onCopyTextClick(entry.message) },
                                ),
                            )
                        }
                        if (menuActions.canCopyImage) {
                            add(
                                TelegramPopupMenuEntry(
                                    icon = Icons.Default.ContentCopy,
                                    title = "Копировать изображение",
                                    onClick = { handlers.onCopyImageClick(entry.message) },
                                ),
                            )
                        }
                        if (menuActions.canCopyVideo) {
                            add(
                                TelegramPopupMenuEntry(
                                    icon = Icons.Default.ContentCopy,
                                    title = "Копировать видео",
                                    onClick = { handlers.onCopyVideoClick(entry.message) },
                                ),
                            )
                        }
                        if (menuActions.canSaveAs) {
                            add(
                                TelegramPopupMenuEntry(
                                    icon = Icons.Default.SaveAlt,
                                    title = "Сохранить как",
                                    onClick = { handlers.onSaveAsClick(entry.message) },
                                ),
                            )
                        }
                        if (canSaveToFavorites) {
                            add(
                                TelegramPopupMenuEntry(
                                    icon = Icons.Default.BookmarkBorder,
                                    title = "Сохранить в избранное",
                                    onClick = { handlers.onSaveToFavoritesClick(entry.message) },
                                ),
                            )
                        }
                        add(
                            TelegramPopupMenuEntry(
                                icon = Icons.Default.PushPin,
                                title = if (isPinned) "Открепить" else "Закрепить",
                                showDividerBefore = true,
                                onClick = {
                                    if (isPinned) {
                                        handlers.onUnpinClick(entry.message)
                                    } else {
                                        handlers.onPinClick(entry.message)
                                    }
                                },
                            ),
                        )
                        if (isMessageEditable(entry.message, currentUsername)) {
                            add(
                                TelegramPopupMenuEntry(
                                    icon = Icons.Default.Edit,
                                    title = "Редактировать",
                                    onClick = { handlers.onEditClick(entry.message) },
                                ),
                            )
                        }
                        add(
                            TelegramPopupMenuEntry(
                                icon = Icons.Default.Delete,
                                title = "Удалить",
                                isDanger = true,
                                showDividerBefore = true,
                                enabled = entry.isOwn,
                                onClick = { handlers.onDeleteClick(entry.message) },
                            ),
                        )
                    }
                TelegramMessagePopupMenu(
                    visible = true,
                    onDismiss = { menuExpanded = false },
                    items = popupItems,
                    modifier = Modifier.align(Alignment.TopEnd),
                )
            }
        }
        }
        }

        if (selectionMode) {
            Icon(
                imageVector =
                    if (isSelected) {
                        Icons.Default.CheckBox
                    } else {
                        Icons.Default.CheckBoxOutlineBlank
                    },
                contentDescription = if (isSelected) "Снять выбор" else "Выбрать",
                tint = if (isSelected) TelegramMessageUi.AccentBlue else DiscordTextSecondary,
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 8.dp, end = 8.dp)
                        .size(24.dp),
            )
        }
    }
}

@Composable
internal fun Avatar(
    senderName: String,
    avatarUrl: String?,
    avatarColor: String?,
    avatarDecoration: String? = null,
    avatarSize: Dp = 40.dp,
) {
    val color =
        avatarColor?.let {
            try {
                Color(android.graphics.Color.parseColor(it))
            } catch (_: Exception) {
                TelegramMessageUi.AccentBlue
            }
        } ?: TelegramMessageUi.AccentBlue

    val resolvedAvatarUrl = resolveAvatarUrl(avatarUrl)

    AvatarWithPresenceIndicator(
        name = senderName,
        avatarUrl = resolvedAvatarUrl,
        avatarColor = color,
        status = null,
        size = avatarSize,
        showIndicator = false,
        avatarDecoration = avatarDecoration,
        // Анимация паузится через LocalChatAnimationsAllowed (байты кэшируются).
        animateDecoration = true,
    )
}

@Composable
internal fun DiscordReplySnippet(
    reply: RepliedMessage,
    accent: Color,
    textColor: Color,
) {
    val userLabel = reply.senderUsername?.trim().takeUnless { it.isNullOrBlank() } ?: "Unknown"
    val body = reply.content?.trim().orEmpty().take(90)
    val snippet =
        if (body.isBlank()) {
            "Медиа"
        } else {
            body
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(bottom = 6.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(accent.copy(alpha = 0.14f))
                .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .width(3.dp)
                    .height(32.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(accent),
        )
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = userLabel,
                color = accent,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                animationKey = "reply-name-${reply.senderUsername}-$userLabel",
            )
            Text(
                text = snippet,
                color = textColor.copy(alpha = 0.85f),
                fontSize = 12.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                animationKey = snippet,
            )
        }
    }
}

@Composable
internal fun DiscordMessageContent(
    entry: MessageEntry,
    mediaLayoutMaxWidth: Dp,
    onOpenMediaViewer: (MediaViewerState) -> Unit,
    onFileDownload: (com.whithin.voice.data.model.MediaFile) -> Unit,
    onVotePoll: (List<String>) -> Unit = {},
    onVideoNoteOpen: () -> Unit,
    contentColor: Color,
    metaColor: Color,
    showFooterMeta: Boolean,
) {
    val message = entry.message
    val isOwn = entry.isOwn
    val content =
        remember(message.messageIdValue, message.contentValue, message.encryptionVersionValue) {
            formatE2eMessageDisplayText(message)
        }
    val forwarded = message.forwardedMessageValue
    val isForwarded = forwarded != null
    val isPollMessage = !isForwarded && message.isPollMessage && message.pollValue != null
    val mediaPartitions =
        remember(message.messageIdValue, message.mediaFilesValue, isForwarded, isPollMessage) {
            val files = if (isForwarded || isPollMessage) emptyList() else message.mediaFilesValue
            Triple(
                files.filter {
                    it.contentType?.startsWith("image/") == true ||
                        it.contentType?.startsWith("video/") == true
                },
                files.filter { it.contentType?.startsWith("audio/") == true },
                files.filter { media ->
                    val type = media.contentType ?: ""
                    !type.startsWith("image/") &&
                        !type.startsWith("video/") &&
                        !type.startsWith("audio/")
                },
            )
        }
    val visualMedia = mediaPartitions.first
    val voiceMedia = mediaPartitions.second
    val fileMedia = mediaPartitions.third
    val forwardComment = if (isForwarded) content.trim() else content
    val hasCaption =
        if (isForwarded) {
            forwardComment.isNotBlank()
        } else {
            content.isNotBlank() && !isPollMessage
        }
    val singleVisualWithCaption =
        visualMedia.size == 1 &&
            hasCaption &&
            voiceMedia.isEmpty() &&
            fileMedia.isEmpty()
    val albumWithCaption =
        visualMedia.size >= 2 &&
            hasCaption &&
            voiceMedia.isEmpty() &&
            fileMedia.isEmpty()
    val headerTimeLabel = remember(message.createdAtValue) { formatDiscordMessageTimestamp(message.createdAtValue) }
    val shortTimeLabel = remember(message.createdAtValue) { formatChatTime(message.createdAtValue) }
    val openFromMessage =
        remember(message.messageIdValue) {
            { url: String ->
                buildViewerStateFromMessage(message, url)?.let(onOpenMediaViewer)
            }
        }

    val footerMeta = showFooterMeta

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .widthIn(max = mediaLayoutMaxWidth),
    ) {
        if (entry.showSender) {
            val sender = message.senderUsernameValue.ifBlank { "Unknown" }
            val nameColor = remember(sender) { discordUsernameColor(sender) }
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Start,
            ) {
                Text(
                    text = sender,
                    color = nameColor,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 17.sp,
                    animationKey = "sender-${message.messageIdValue}-$sender",
                )
                if (headerTimeLabel.isNotBlank()) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = headerTimeLabel,
                        color = DiscordTextSecondary,
                        fontSize = 12.sp,
                        animationKey = "time-${message.messageIdValue}-$headerTimeLabel",
                        minAnimatedLength = 3,
                    )
                }
                if (message.isEditedValue) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "ред.",
                        color = DiscordTextSecondary,
                        fontSize = 11.sp,
                        scrambleOnce = false,
                    )
                }
                if (isOwn) {
                    MessageStatusIndicator(
                        status = message.statusValue,
                        onLightBubble = true,
                        modifier = Modifier.padding(start = 4.dp),
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
        }

        message.repliedMessageValue?.let {
            DiscordReplySnippet(
                reply = it,
                accent = TelegramMessageUi.AccentBlue,
                textColor = contentColor,
            )
        }

        if (isForwarded) {
            ForwardedMessageSnippet(
                forwarded = forwarded!!,
                mediaLayoutMaxWidth = mediaLayoutMaxWidth,
                onImageClick = { url ->
                    buildViewerStateFromMediaListByUrl(
                        mediaFiles = forwarded.mediaFilesValue,
                        clickedUrl = url,
                        caption = forwarded.bodyValue,
                        senderUsername = forwarded.senderUsernameValue,
                    )?.let(onOpenMediaViewer)
                },
                onVideoClick = { url ->
                    buildViewerStateFromMediaListByUrl(
                        mediaFiles = forwarded.mediaFilesValue,
                        clickedUrl = url,
                        caption = forwarded.bodyValue,
                        senderUsername = forwarded.senderUsernameValue,
                    )?.let(onOpenMediaViewer)
                },
                onVideoNoteOpen = onVideoNoteOpen,
            )
        }

        if (!isForwarded && message.isStickerMessage) {
            message.stickerValue?.let { sticker ->
                StickerMedia(
                    filePath = sticker.filePathValue,
                    contentType = sticker.contentTypeValue,
                    contentDescription = "Стикер",
                    contentScale = ContentScale.Fit,
                    previewSizeDp = 160.dp,
                    modifier =
                        Modifier
                            .widthIn(max = 160.dp)
                            .heightIn(max = 160.dp),
                )
            }
        }

        if (isPollMessage) {
            message.pollValue?.let { poll ->
                PollMessageContent(
                    poll = poll,
                    onVote = onVotePoll,
                )
            }
        }

        if (visualMedia.isNotEmpty()) {
            val attachedCaption = (singleVisualWithCaption || albumWithCaption) && !isForwarded
            val mediaShape =
                if (attachedCaption) {
                    RoundedCornerShape(
                        topStart = TelegramMessageUi.MediaCornerRadius,
                        topEnd = TelegramMessageUi.MediaCornerRadius,
                        bottomStart = 0.dp,
                        bottomEnd = 0.dp,
                    )
                } else {
                    DiscordMediaRounding
                }
            var mediaWidthPx by remember(message.messageIdValue) { mutableIntStateOf(0) }
            val density = LocalDensity.current
            // Как текстовые сообщения: и свои, и чужие медиа слева.
            Column(horizontalAlignment = Alignment.Start) {
                Box(
                    modifier =
                        Modifier.onSizeChanged { size ->
                            if (size.width > 0) mediaWidthPx = size.width
                        },
                ) {
                    if (visualMedia.size >= 2) {
                        MessageMediaAlbumGrid(
                            mediaFiles = visualMedia,
                            layoutMaxWidth = mediaLayoutMaxWidth,
                            clipShape = mediaShape,
                            showTimeBadge = false,
                            timestamp = shortTimeLabel,
                            isOwn = isOwn,
                            status = message.statusValue,
                            onImageClick = { url -> openFromMessage(url) },
                            onVideoClick = { url -> openFromMessage(url) },
                        )
                    } else {
                        visualMedia.forEach { media ->
                            val url = buildMessageMediaUrl(media.filePath)
                            if (media.contentType?.startsWith("image/") == true) {
                                ImageMessageItem(
                                    mediaFile = media,
                                    timestamp = shortTimeLabel,
                                    showTimeBadge = false,
                                    clipShape = mediaShape,
                                    layoutMaxWidth = mediaLayoutMaxWidth,
                                    isOwn = isOwn,
                                    status = message.statusValue,
                                    onImageClick = { openFromMessage(url) },
                                )
                            } else if (media.contentType?.startsWith("video/") == true) {
                                VideoMessageItem(
                                    mediaFile = media,
                                    timestamp = shortTimeLabel,
                                    showTimeBadge = false,
                                    clipShape = mediaShape,
                                    layoutMaxWidth = mediaLayoutMaxWidth,
                                    isVideoNote = media.isVideoNoteValue,
                                    isOwn = isOwn,
                                    status = message.statusValue,
                                    onVideoNoteOpen = onVideoNoteOpen,
                                    onVideoClick = { openFromMessage(url) },
                                )
                            }
                        }
                    }
                }
                if (attachedCaption) {
                    val captionText = content
                    val captionWidth =
                        if (mediaWidthPx > 0) {
                            with(density) { mediaWidthPx.toDp() }
                        } else {
                            mediaLayoutMaxWidth
                        }
                    Column(
                        modifier =
                            Modifier
                                .width(captionWidth)
                                .clip(
                                    RoundedCornerShape(
                                        topStart = 0.dp,
                                        topEnd = 0.dp,
                                        bottomStart = TelegramMessageUi.MediaCornerRadius,
                                        bottomEnd = TelegramMessageUi.MediaCornerRadius,
                                    ),
                                )
                                .background(Color(0xFF2B2D31))
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                    ) {
                        LinkifiedMessageText(
                            text = captionText,
                            color = contentColor,
                            fontSize = 16.sp,
                            lineHeight = 22.sp,
                        )
                    }
                }
            }
            if (!attachedCaption && (hasCaption || voiceMedia.isNotEmpty() || fileMedia.isNotEmpty())) {
                Spacer(modifier = Modifier.height(6.dp))
            }
        }

        if (hasCaption && !singleVisualWithCaption && !albumWithCaption) {
            if (isForwarded && forwardComment.isNotBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
            }
            val captionText = if (isForwarded) forwardComment else content
            LinkifiedMessageText(
                text = captionText,
                color = contentColor,
                fontSize = 16.sp,
                lineHeight = 22.sp,
            )
            Spacer(modifier = Modifier.height(2.dp))
        }

        if (voiceMedia.isNotEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                voiceMedia.forEach { voice ->
                    VoiceMessageItem(
                        mediaFile = voice,
                        modifier = Modifier.fillMaxWidth(),
                        isOwn = isOwn,
                        lazyLoad = true,
                        preloadWaveform = false,
                        embedInBubble = false,
                    )
                }
            }
        }

        if (fileMedia.isNotEmpty()) {
            MessageFileGroup(files = fileMedia, onFileClick = onFileDownload)
        }

        // Время уже в шапке у имени; футер только для строк без showSender.
        val attachedCaptionFooter = (singleVisualWithCaption || albumWithCaption) && !isForwarded
        if (footerMeta && !attachedCaptionFooter) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 2.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (message.isEditedValue) {
                    Text(
                        text = "ред.",
                        color = metaColor,
                        fontSize = 11.sp,
                        scrambleOnce = false,
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                }
                if (shortTimeLabel.isNotBlank()) {
                    Text(
                        text = shortTimeLabel,
                        color = metaColor,
                        fontSize = 11.sp,
                        animationKey = "time-${message.messageIdValue}-$shortTimeLabel",
                        minAnimatedLength = 3,
                    )
                }
                if (isOwn) {
                    MessageStatusIndicator(
                        status = message.statusValue,
                        onLightBubble = false,
                        modifier = Modifier.padding(start = 3.dp),
                    )
                }
            }
        }
    }
}

@Composable
internal fun DateSeparatorChip(text: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
        ) {
            Text(
                text = text,
                color = DiscordTextSecondary,
                fontSize = 11.sp,
                animationKey = "date-$text",
            )
        }
    }
}

internal fun chatListItemKey(item: ChatListItem): String =
    when (item) {
        is ChatListItem.DateSeparator -> item.key
        is ChatListItem.MessageRow -> messageRowKey(item.entry.message)
    }

internal fun messageRowKey(message: Message): String {
    val messageId = message.messageIdValue.trim()
    return if (messageId.isNotBlank()) {
        messageId
    } else {
        "msg-${message.createdAtValue}-${message.senderIdValue}-${message.contentValue.hashCode()}"
    }
}

@Composable
internal fun ChatScrollToBottomFab(
    visible: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!visible) return
    SmallFloatingActionButton(
        onClick = onClick,
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
        shape = CircleShape,
    ) {
        Icon(
            Icons.Default.KeyboardArrowDown,
            contentDescription = "К последним сообщениям",
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun ChatMessagesLazyList(
    listItems: List<ChatListItem>,
    listState: LazyListState,
    isLoadingOlder: Boolean,
    hasMoreOlder: Boolean,
    selectionMode: Boolean,
    selectedMessageIds: Set<String>,
    currentUsername: String,
    currentUserId: String,
    currentChatId: String,
    savedMessagesChatId: String?,
    handlers: MessageRowEventHandlers,
    modifier: Modifier = Modifier,
) {
    val hasAvatarGutter =
        remember(listItems) {
            listItems.any { item ->
                item is ChatListItem.MessageRow && item.entry.showAvatarColumn
            }
        }
    val contentMax = rememberDiscordMediaMaxWidth(hasAvatarGutter)
    // JetChat: newest-first + reverseLayout=true → последние сообщения внизу.
    val visualItems = remember(listItems) { listItems.asReversed() }
    val listScrolling by remember {
        derivedStateOf { listState.isScrollInProgress }
    }
    var animationsAllowed by remember { mutableStateOf(true) }
    LaunchedEffect(listScrolling) {
        if (listScrolling) {
            animationsAllowed = false
            ChatAnimationPlayback.pauseAllTracked()
        } else {
            delay(160)
            animationsAllowed = true
        }
    }
    val swipeReply = rememberChatSwipeReplyState(listState)
    CompositionLocalProvider(
        LocalChatListScrolling provides listScrolling,
        LocalChatAnimationsAllowed provides animationsAllowed,
    ) {
        LazyColumn(
            state = listState,
            modifier =
                modifier
                    .fillMaxSize()
                    .clipToBounds()
                    .chatSwipeReplyOverlay(swipeReply),
            reverseLayout = true,
            contentPadding =
                PaddingValues(
                    horizontal = 10.dp,
                    vertical = 8.dp,
                ),
        ) {
            items(
                items = visualItems,
                key = { item -> chatListItemKey(item) },
                contentType = {
                    when (it) {
                        is ChatListItem.DateSeparator -> "date"
                        is ChatListItem.MessageRow -> it.entry.rowType
                    }
                },
            ) { item ->
                when (item) {
                    is ChatListItem.DateSeparator -> DateSeparatorChip(item.label)
                    is ChatListItem.MessageRow -> {
                        val messageId = item.entry.message.messageIdValue
                        MessageRow(
                            entry = item.entry,
                            currentUsername = currentUsername,
                            currentUserId = currentUserId,
                            currentChatId = currentChatId,
                            savedMessagesChatId = savedMessagesChatId,
                            selectionMode = selectionMode,
                            isSelected = selectionMode && messageId in selectedMessageIds,
                            contentMax = contentMax,
                            handlers = handlers,
                            swipeReply = swipeReply,
                        )
                    }
                }
            }
            if (isLoadingOlder || hasMoreOlder) {
                item(key = "older-messages-header") {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (isLoadingOlder) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = TelegramMessageUi.AccentBlue,
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Text(
                                text = "Потяните вверх для загрузки",
                                color = DiscordTextSecondary,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Один проход по сообщениям: даты/«свой-чужой»/ключ отправителя считаются
 * ровно один раз на сообщение (раньше — до 8 разборов `Instant.parse` на каждое
 * при каждом обновлении списка, что давало подвисания при приходе сообщений).
 */
internal fun buildChatListItems(
    messages: List<Message>,
    currentUsername: String,
    currentUserId: String,
    showSenderNames: Boolean,
    showAvatars: Boolean,
): List<ChatListItem> {
    if (messages.isEmpty()) return emptyList()
    val n = messages.size
    val epochs = LongArray(n)
    val dates = arrayOfNulls<LocalDate>(n)
    val own = BooleanArray(n)
    val callLog = BooleanArray(n)
    val senderKeys = arrayOfNulls<String>(n)

    for (i in 0 until n) {
        val message = messages[i]
        val parsed = MessageTimeCache.parse(message.createdAtValue)
        epochs[i] = parsed?.epochMillis ?: Long.MIN_VALUE
        dates[i] = parsed?.date
        own[i] = messageIsOwn(message, currentUsername, currentUserId)
        callLog[i] = message.isCallLogMessage
        senderKeys[i] = message.senderIdValue.trim().ifBlank { message.senderUsernameValue }
    }

    fun sameGroup(a: Int, b: Int): Boolean {
        if (callLog[a] || callLog[b]) return false
        if (own[a] != own[b]) return false
        if (!senderKeys[a].equals(senderKeys[b], ignoreCase = true)) return false
        val t1 = epochs[a]
        val t2 = epochs[b]
        if (t1 == Long.MIN_VALUE || t2 == Long.MIN_VALUE) return false
        return kotlin.math.abs(t2 - t1) <= MessageGroupWindowMs
    }

    val output = ArrayList<ChatListItem>(n + 16)
    var prevDate: LocalDate? = null

    for (index in 0 until n) {
        val message = messages[index]
        val currentDate = dates[index] ?: prevDate
        if (currentDate != null && currentDate != prevDate) {
            output += ChatListItem.DateSeparator(
                label = formatDateChip(currentDate),
                key = "date_$currentDate",
            )
            prevDate = currentDate
        }

        val groupedWithPrev =
            index > 0 && sameGroup(index - 1, index) && dates[index - 1] == currentDate
        val groupedWithNext =
            index + 1 < n && sameGroup(index, index + 1) && dates[index + 1] == currentDate
        val isFirstInGroup = !groupedWithPrev
        val isLastInGroup = !groupedWithNext
        val isCallLog = callLog[index]

        output += ChatListItem.MessageRow(
            MessageEntry(
                message = message,
                isOwn = own[index],
                showAvatar = showAvatars && !isCallLog,
                showAvatarColumn = showAvatars && !isCallLog,
                showSender = showSenderNames && !isCallLog,
                isFirstInGroup = isFirstInGroup,
                isLastInGroup = isLastInGroup,
                rowType = messageRowType(message, isFirstInGroup),
            ),
        )
    }
    return output
}

/** Разобранное время сообщения: один `Instant.parse` на строку, далее из кеша. */
internal class ParsedMessageTime(val epochMillis: Long, val date: LocalDate)

internal object MessageTimeCache {
    private val cache = android.util.LruCache<String, ParsedMessageTime>(8192)
    @Volatile private var zone: ZoneId = ZoneId.systemDefault()

    fun parse(value: String): ParsedMessageTime? {
        if (value.isBlank()) return null
        val currentZone = ZoneId.systemDefault()
        if (currentZone != zone) {
            synchronized(this) {
                if (currentZone != zone) {
                    cache.evictAll()
                    zone = currentZone
                }
            }
        }
        cache.get(value)?.let { return it }
        val instant =
            try {
                Instant.parse(value)
            } catch (_: Exception) {
                return null
            }
        val parsed =
            ParsedMessageTime(
                epochMillis = instant.toEpochMilli(),
                date = instant.atZone(currentZone).toLocalDate(),
            )
        cache.put(value, parsed)
        return parsed
    }
}

private val ChatTimeFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")
private val ChatDateTimeFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")
private val ChatDateChipFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM", Locale("ru"))

internal fun messageIsOwn(message: Message, currentUsername: String, currentUserId: String): Boolean {
    val senderId = message.senderIdValue.trim()
    return when {
        senderId.isNotBlank() && currentUserId.isNotBlank() ->
            senderId.equals(currentUserId, ignoreCase = true)
        else -> message.senderUsernameValue == currentUsername
    }
}

internal fun messageRowType(message: Message, isFirstInGroup: Boolean): String {
    val kind =
        when {
            message.isCallLogMessage -> "call"
            message.isPollMessage -> "poll"
            message.mediaFilesValue.any { it.contentType?.startsWith("audio/") == true } -> "voice"
            message.mediaFilesValue.any {
                it.contentType?.startsWith("image/") == true ||
                    it.contentType?.startsWith("video/") == true
            } -> "media"
            else -> "text"
        }
    return if (isFirstInGroup) "$kind-h" else "$kind-c"
}

internal fun sameVisualGroup(
    a: Message,
    b: Message,
    currentUsername: String,
    currentUserId: String,
): Boolean {
    if (a.isCallLogMessage || b.isCallLogMessage) return false
    if (messageIsOwn(a, currentUsername, currentUserId) != messageIsOwn(b, currentUsername, currentUserId)) {
        return false
    }
    val aId = a.senderIdValue.trim().ifBlank { a.senderUsernameValue }
    val bId = b.senderIdValue.trim().ifBlank { b.senderUsernameValue }
    if (!aId.equals(bId, ignoreCase = true)) return false
    val t1 = parseInstant(a.createdAtValue)?.toEpochMilli() ?: return false
    val t2 = parseInstant(b.createdAtValue)?.toEpochMilli() ?: return false
    return kotlin.math.abs(t2 - t1) <= MessageGroupWindowMs
}

internal fun parseMessageDate(value: String): LocalDate? = MessageTimeCache.parse(value)?.date

internal fun parseInstant(value: String): Instant? =
    MessageTimeCache.parse(value)?.let { Instant.ofEpochMilli(it.epochMillis) }

internal fun formatChatTime(value: String): String {
    val parsed = MessageTimeCache.parse(value)
    if (parsed != null) {
        return Instant.ofEpochMilli(parsed.epochMillis)
            .atZone(ZoneId.systemDefault())
            .format(ChatTimeFormatter)
    }
    return value.takeIf { it.length <= 5 } ?: value.substringAfterLast("T").substringBefore(".").take(5)
}

internal fun formatDateChip(date: LocalDate): String {
    val today = LocalDate.now()
    return when (date) {
        today -> "Сегодня"
        today.minusDays(1) -> "Вчера"
        else -> date.format(ChatDateChipFormatter)
    }
}
