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
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.gestures.ScrollableDefaults
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
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
import com.whithin.voice.presentation.ui.components.MessageRowSwipeReplyContainer
import com.whithin.voice.presentation.ui.components.ChatVoicePresenceBar
import com.whithin.voice.presentation.ui.components.formatTypingLabel
import com.whithin.voice.presentation.ui.components.buildChatVoiceParticipants
import com.whithin.voice.presentation.notifications.PushNotificationTitles
import com.whithin.voice.presentation.ui.components.ChatMessagesSkeleton
import com.whithin.voice.presentation.ui.components.ProvideTextScramble
import com.whithin.voice.presentation.ui.components.ImageMessageItem
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
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal enum class ComposerMicSlot { Voice, VideoNote }

@Composable
internal fun EditPreview(
    message: Message,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .composerPillSurface()
                .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .width(3.dp)
                    .height(36.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(TelegramMessageUi.AccentBlue),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Редактирование",
                color = TelegramMessageUi.AccentBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                scrambleOnce = false,
            )
            Text(
                text = message.contentValue,
                color = DiscordText.copy(alpha = 0.9f),
                fontSize = 12.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                scrambleOnce = false,
            )
        }
        IconButton(onClick = onCancel) {
            Icon(Icons.Default.Close, contentDescription = "Отменить редактирование", tint = DiscordTextSecondary)
        }
    }
}

@Composable
internal fun ReplyPreview(
    message: Message,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .composerPillSurface()
                .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .width(3.dp)
                    .height(36.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(TelegramMessageUi.AccentBlue),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Ответ: ${message.senderUsernameValue.ifEmpty { "Unknown" }}",
                color = TelegramMessageUi.AccentBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                animationKey = "reply-preview-${message.messageIdValue}",
            )
            Text(
                text = message.contentValue.ifBlank { "Медиа сообщение" },
                color = DiscordText.copy(alpha = 0.9f),
                fontSize = 12.sp,
                maxLines = 1,
                animationKey = "reply-body-${message.messageIdValue}-${message.contentValue}",
            )
        }
        IconButton(onClick = onCancel) {
            Icon(Icons.Default.Close, contentDescription = "Cancel reply", tint = DiscordTextSecondary)
        }
    }
}

internal fun Modifier.composerOrbGesturesTelegram(
    enabled: Boolean,
    cancelPx: Float,
    lockPx: Float,
    micSlot: ComposerMicSlot,
    onToggleMicSlot: () -> Unit,
    voiceSession: VoiceRecordingSession,
    videoSession: VideoNoteRecordingSession,
    onTryStartVoiceRecording: () -> Boolean,
    onTryStartVideoRecording: () -> Boolean,
    onLockedFromSwipe: () -> Unit,
    onDragProgress: (cancelProgress: Float, lockProgress: Float) -> Unit = { _, _ -> },
    onDragEnd: () -> Unit = {},
): Modifier =
    pointerInput(enabled, cancelPx, lockPx, micSlot, voiceSession, videoSession) {
        if (!enabled) return@pointerInput
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            val longPressed = awaitLongPressOrCancellation(down.id)
            if (longPressed == null) {
                onToggleMicSlot()
                return@awaitEachGesture
            }
            val started =
                when (micSlot) {
                    ComposerMicSlot.Voice -> onTryStartVoiceRecording()
                    ComposerMicSlot.VideoNote -> onTryStartVideoRecording()
                }
            if (!started) return@awaitEachGesture

            val recordingSession: RecordingComposerSession =
                when (micSlot) {
                    ComposerMicSlot.Voice -> voiceSession
                    ComposerMicSlot.VideoNote -> videoSession
                }
            var lockedLocally = false
            var totalX = 0f
            var totalY = 0f
            onDragProgress(0f, 0f)
            try {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Main)
                    val change = event.changes.find { it.id == down.id } ?: continue
                    if (change.changedToUpIgnoreConsumed()) {
                        if (!lockedLocally && recordingSession.isRecording) {
                            recordingSession.stop(send = true)
                        }
                        change.consume()
                        break
                    }
                    val dragAmt = change.positionChange()
                    if (dragAmt != Offset.Zero) {
                        totalX += dragAmt.x
                        totalY += dragAmt.y
                        val cancelP = ((-totalX) / cancelPx).coerceIn(0f, 1f)
                        val lockP = ((-totalY) / lockPx).coerceIn(0f, 1f)
                        onDragProgress(cancelP, lockP)
                        if (totalX < -cancelPx) {
                            if (recordingSession.isRecording) {
                                recordingSession.stop(send = false)
                            }
                            change.consume()
                            break
                        }
                        if (totalY < -lockPx && !lockedLocally) {
                            lockedLocally = true
                            onLockedFromSwipe()
                        }
                    }
                    change.consume()
                }
            } finally {
                onDragEnd()
            }
        }
    }

@Composable
internal fun ChatComposer(
    messageText: String,
    replyToMessage: Message?,
    editingMessage: Message?,
    enabled: Boolean,
    voiceRecordingSession: VoiceRecordingSession,
    videoNoteRecordingSession: VideoNoteRecordingSession,
    composerMicSlot: ComposerMicSlot,
    onToggleComposerMicSlot: () -> Unit,
    /** Явная подписка на запись — примитив надёжно перевешивает UI (инпут скрыть). */
    voiceLocked: Boolean,
    onVoiceLockedChange: (Boolean) -> Unit,
    onMessageTextChange: (String) -> Unit,
    onAttachClick: () -> Unit,
    onExpressionPickerClick: () -> Unit = {},
    expressionPickerActive: Boolean = false,
    onSendClick: () -> Unit,
    /** Старт записи после долгого нажатия; false — например запросили разрешение. */
    onTryStartVoiceRecording: () -> Boolean,
    onTryStartVideoRecording: () -> Boolean,
    onCancelReply: () -> Unit,
    onCancelEdit: () -> Unit,
    onComposerFocus: () -> Unit = {},
    keyboardVisible: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val isComposerRecording =
        voiceRecordingSession.isRecording ||
            videoNoteRecordingSession.isRecording ||
            videoNoteRecordingSession.lensSwitchInProgress
    if (isComposerRecording) {
        val fxSession =
            if (voiceRecordingSession.isRecording) {
                voiceRecordingSession
            } else {
                videoNoteRecordingSession
            }
        VoiceRecordingSessionEffects(fxSession)
    }
    val composerIconTint = MaterialTheme.colorScheme.onSurfaceVariant
    val isEditing = editingMessage != null
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(TelegramMessageUi.ChatBackground),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .then(if (!keyboardVisible) Modifier.navigationBarsPadding() else Modifier)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
        val density = LocalDensity.current
        val focusManager = LocalFocusManager.current
        val cancelPx = remember(density) { with(density) { 88.dp.toPx() } }
        val lockPx = remember(density) { with(density) { 56.dp.toPx() } }
        var holdCancelProgress by remember { mutableFloatStateOf(0f) }
        var holdLockProgress by remember { mutableFloatStateOf(0f) }
        LaunchedEffect(isComposerRecording) {
            if (isComposerRecording) focusManager.clearFocus()
            if (!isComposerRecording) {
                holdCancelProgress = 0f
                holdLockProgress = 0f
            }
        }
        if (isEditing) {
            EditPreview(message = editingMessage!!, onCancel = onCancelEdit)
        } else if (replyToMessage != null) {
            ReplyPreview(message = replyToMessage, onCancel = onCancelReply)
        }
        val showRecordingSend = isComposerRecording && voiceLocked
        val showVoiceMicOrb =
            !isEditing &&
                messageText.isBlank() &&
                !showRecordingSend
        val activeRecordingSession: RecordingComposerSession =
            when {
                voiceRecordingSession.isRecording -> voiceRecordingSession
                videoNoteRecordingSession.isRecording ||
                    videoNoteRecordingSession.lensSwitchInProgress -> videoNoteRecordingSession
                else -> voiceRecordingSession
            }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(ComposerRowGap),
        ) {
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(
                            min = VoiceComposerBarHeightDp,
                            max = ComposerInputMaxHeightDp,
                        )
                        .composerPillSurface(),
            ) {
                when {
                    isComposerRecording && voiceLocked -> {
                        VoiceRecordingLockedBar(
                            activeRecordingSession,
                            Modifier.fillMaxWidth(),
                        )
                    }
                    isComposerRecording && !voiceLocked -> {
                        VoiceRecordingHoldBar(
                            session = activeRecordingSession,
                            cancelProgress = holdCancelProgress,
                            lockProgress = holdLockProgress,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    else -> {
                        val composerExpanded = messageText.contains('\n') || messageText.length > 48
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = if (composerExpanded) 6.dp else 0.dp),
                            verticalAlignment = if (composerExpanded) Alignment.Bottom else Alignment.CenterVertically,
                        ) {
                            if (!isEditing) {
                                IconButton(
                                    onClick = onExpressionPickerClick,
                                    modifier = Modifier.size(44.dp),
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Interests,
                                        contentDescription = "Эмодзи и стикеры",
                                        tint =
                                            if (expressionPickerActive) {
                                                TelegramMessageUi.AccentBlue
                                            } else {
                                                composerIconTint
                                            },
                                        modifier = Modifier.size(24.dp),
                                    )
                                }
                            }

                            TextField(
                                value = messageText,
                                onValueChange = onMessageTextChange,
                                modifier =
                                    Modifier
                                        .weight(1f)
                                        .heightIn(
                                            min = 36.dp,
                                            max = ComposerInputMaxHeightDp - 12.dp,
                                        )
                                        .onPreviewKeyEvent { event ->
                                            if (
                                                event.type == KeyEventType.KeyDown &&
                                                event.key == Key.Enter &&
                                                !event.isShiftPressed &&
                                                messageText.isNotBlank() &&
                                                !isComposerRecording
                                            ) {
                                                onSendClick()
                                                true
                                            } else {
                                                false
                                            }
                                        }
                                        .onFocusChanged { if (it.isFocused) onComposerFocus() },
                                placeholder = {
                                    Text(
                                        if (isEditing) "Редактирование сообщения" else "Сообщение",
                                        color = DiscordTextSecondary,
                                    )
                                },
                                shape = RoundedCornerShape(ComposerPillCornerRadius),
                                colors =
                                    TextFieldDefaults.colors(
                                        focusedContainerColor = Color.Transparent,
                                        unfocusedContainerColor = Color.Transparent,
                                        disabledContainerColor = Color.Transparent,
                                        focusedIndicatorColor = Color.Transparent,
                                        unfocusedIndicatorColor = Color.Transparent,
                                        disabledIndicatorColor = Color.Transparent,
                                        cursorColor = TelegramMessageUi.AccentBlue,
                                        focusedTextColor = DiscordText,
                                        unfocusedTextColor = DiscordText,
                                    ),
                                keyboardOptions =
                                    KeyboardOptions(
                                        imeAction = ImeAction.Send,
                                        capitalization = KeyboardCapitalization.Sentences,
                                    ),
                                keyboardActions =
                                    KeyboardActions(
                                        onSend = {
                                            if (messageText.isNotBlank() && !isComposerRecording) {
                                                onSendClick()
                                                focusManager.clearFocus()
                                            }
                                        },
                                    ),
                                maxLines = ComposerMessageMaxLines,
                            )

                            if (!isEditing) {
                                IconButton(
                                    onClick = onAttachClick,
                                    modifier = Modifier.size(44.dp),
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AttachFile,
                                        contentDescription = "Прикрепить",
                                        tint = composerIconTint,
                                        modifier = Modifier.size(24.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }

            when {
                messageText.isNotBlank() && !isComposerRecording -> {
                    ComposerActionButton(
                        icon = Icons.Default.Send,
                        contentDescription = "Отправить",
                        enabled = enabled,
                        onClick = onSendClick,
                    )
                }
                showRecordingSend -> {
                    Box(
                        modifier = Modifier.size(ComposerActionButtonSize),
                        contentAlignment = Alignment.Center,
                    ) {
                        ComposerRecordingSendOrb(
                            session = activeRecordingSession,
                            modifier =
                                Modifier
                                    .align(Alignment.Center)
                                    .requiredSize(ComposerHoldOrbOuterDp),
                        )
                        ComposerRecordingPauseFab(
                            session = activeRecordingSession,
                            modifier =
                                Modifier
                                    .align(Alignment.TopCenter)
                                    .offset(y = -ComposerPauseFabOffsetY),
                        )
                    }
                }
                showVoiceMicOrb -> {
                    val holdRecording = isComposerRecording && !voiceLocked
                    val micDesc =
                        if (isComposerRecording) {
                            "Запись: отпустите для отправки"
                        } else if (composerMicSlot == ComposerMicSlot.VideoNote) {
                            "Короткое нажатие — микрофон · Зажмите для видеокружка"
                        } else {
                            "Короткое нажатие — видеокружок · Зажмите для голосового"
                        }
                    val orbVoiceLevel by animateFloatAsState(
                        targetValue = activeRecordingSession.voiceLevelSmoothed.coerceIn(0f, 1f),
                        animationSpec = tween(45, easing = LinearEasing),
                        label = "voiceMicOrbLevel",
                    )
                    val centerIcon =
                        if (composerMicSlot == ComposerMicSlot.VideoNote) {
                            Icons.Filled.Videocam
                        } else {
                            Icons.Default.Mic
                        }
                    Box(
                        modifier =
                            Modifier
                                // Слот layout как у кнопки; волны рисуются requiredSize поверх чата.
                                .size(ComposerActionButtonSize)
                                .composerOrbGesturesTelegram(
                                    enabled = enabled,
                                    cancelPx = cancelPx,
                                    lockPx = lockPx,
                                    micSlot = composerMicSlot,
                                    onToggleMicSlot = onToggleComposerMicSlot,
                                    voiceSession = voiceRecordingSession,
                                    videoSession = videoNoteRecordingSession,
                                    onTryStartVoiceRecording = onTryStartVoiceRecording,
                                    onTryStartVideoRecording = onTryStartVideoRecording,
                                    onLockedFromSwipe = { onVoiceLockedChange(true) },
                                    onDragProgress = { cancel, lock ->
                                        holdCancelProgress = cancel
                                        holdLockProgress = lock
                                    },
                                    onDragEnd = {
                                        holdCancelProgress = 0f
                                        holdLockProgress = 0f
                                    },
                                ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (holdRecording) {
                            ComposerHoldActionOrb(
                                voiceLevel = orbVoiceLevel,
                                centerIcon = centerIcon,
                                centerContentDescription = micDesc,
                                modifier = Modifier.requiredSize(ComposerHoldOrbOuterDp),
                            )
                        } else {
                            ComposerActionButton(
                                icon = centerIcon,
                                contentDescription = micDesc,
                                enabled = enabled,
                                modifier = Modifier.fillMaxSize(),
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
internal fun VideoNoteRecordingOverlay(
    composerMicSlot: ComposerMicSlot,
    videoNoteSession: VideoNoteRecordingSession,
    onPreviewView: (PreviewView) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (composerMicSlot != ComposerMicSlot.VideoNote && !videoNoteSession.cameraBindReady) return

    val cfg = LocalConfiguration.current
    val videoCircleDp =
        (cfg.screenWidthDp.coerceAtMost(cfg.screenHeightDp) * 0.72f).dp
    val recordingVideo =
        videoNoteSession.isRecording || videoNoteSession.lensSwitchInProgress

    Box(modifier = modifier) {
        if (recordingVideo) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.52f)),
            )
        }
        Box(
            modifier =
                Modifier
                    .align(
                        if (recordingVideo) {
                            Alignment.Center
                        } else {
                            Alignment.TopStart
                        },
                    )
                    .then(
                        if (recordingVideo) {
                            Modifier
                                .size(videoCircleDp)
                                .clip(CircleShape)
                                .background(Color.Black)
                        } else {
                            Modifier.size(8.dp).alpha(0.02f)
                        },
                    ),
        ) {
            AndroidView(
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                    }
                },
                update = onPreviewView,
                modifier = Modifier.fillMaxSize(),
            )
        }
        if (recordingVideo) {
            val maxDeci = VideoNoteRecordingSession.MAX_DURATION_DECISECONDS
            val progress =
                (videoNoteSession.elapsedDeciseconds.toFloat() / maxDeci.toFloat())
                    .coerceIn(0f, 1f)
            Canvas(
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .size(videoCircleDp),
            ) {
                val stroke = 4.dp.toPx()
                val inset = stroke * 0.5f
                drawArc(
                    color = Color.White.copy(alpha = 0.9f),
                    startAngle = -90f,
                    sweepAngle = 360f * progress,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = Size(size.width - stroke, size.height - stroke),
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
        }
        if (recordingVideo) {
            val flipBusy = videoNoteSession.lensSwitchInProgress
            Row(
                modifier =
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = 14.dp, bottom = 88.dp)
                        .height(VoiceComposerBarHeightDp)
                        .composerPillSurface()
                        .clickable(enabled = !flipBusy) { videoNoteSession.toggleCameraFacing() }
                        .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Filled.FlipCameraAndroid,
                    contentDescription =
                        if (flipBusy) {
                            "Смена камеры…"
                        } else {
                            "Переключить камеру"
                        },
                    tint =
                        if (flipBusy) {
                            Color.White.copy(alpha = 0.45f)
                        } else {
                            Color.White
                        },
                    modifier = Modifier.size(22.dp),
                )
            }
        }
    }
}
