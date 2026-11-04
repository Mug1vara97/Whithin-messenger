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

@Composable
private fun ChatHeader(
    chatName: String,
    subtitle: String,
    subtitleAccent: Boolean,
    avatarUrl: String?,
    avatarColor: String?,
    avatarDecoration: String?,
    isSavedMessages: Boolean,
    isGroupChat: Boolean,
    presenceStatus: String?,
    onBackClick: () -> Unit,
    onTitleClick: () -> Unit,
    titleClickEnabled: Boolean,
    onCallClick: () -> Unit,
    isCallEnabled: Boolean,
    onSearchClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val parsedAvatarColor =
        avatarColor?.let {
            runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
        } ?: TelegramMessageUi.AccentBlue

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
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBackClick) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = DiscordText)
            }
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .clickable(enabled = titleClickEnabled, onClick = onTitleClick)
                        .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (isSavedMessages) {
                    Box(
                        modifier =
                            Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Bookmark,
                            contentDescription = "Избранное",
                            tint = DiscordTextSecondary,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                } else {
                    AvatarWithPresenceIndicator(
                        name = chatName,
                        avatarUrl = resolveAvatarUrl(avatarUrl),
                        avatarColor = parsedAvatarColor,
                        status = presenceStatus,
                        size = 40.dp,
                        showIndicator = !isGroupChat && !presenceStatus.isNullOrBlank(),
                        avatarDecoration = avatarDecoration,
                        animateDecoration = true,
                        displayInitial =
                            if (isGroupChat) {
                                "G"
                            } else {
                                chatName.firstOrNull()?.uppercase() ?: "U"
                            },
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = chatName,
                        color = DiscordText,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (subtitle.isNotBlank()) {
                        Text(
                            text = subtitle,
                            color = if (subtitleAccent) TelegramMessageUi.AccentBlue else DiscordTextSecondary,
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            scrambleOnce = false,
                        )
                    }
                }
            }
            IconButton(onClick = onSearchClick) {
                Icon(Icons.Default.Search, contentDescription = "Поиск", tint = DiscordText)
            }
            if (isCallEnabled) {
                IconButton(onClick = onCallClick) {
                    Icon(Icons.Default.Call, contentDescription = "Звонок", tint = TelegramMessageUi.AccentBlue)
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(0.5.dp)
                    .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
        )
    }
}


@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatScreen(
    chatId: String,
    chatName: String,
    enableVoiceCall: Boolean = true,
    onBack: () -> Unit,
    onCallClick: (String, String, String) -> Unit,
    onExpandVoiceCall: () -> Unit = {},
    chatViewModel: ChatViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel(),
    stickerViewModel: StickerViewModel = hiltViewModel(),
    voiceRoomViewModel: VoiceRoomViewModel =
        hiltViewModel(LocalContext.current as ComponentActivity),
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val chatDensity = LocalDensity.current
    val scope = rememberCoroutineScope()
    val chatState by chatViewModel.uiState.collectAsUiState()
    val chatMessages by chatViewModel.messages.collectAsUiState()
    val selectionBundle by chatViewModel.selectionState.collectAsUiState()
    val authState by authViewModel.uiState.collectAsUiState()
    val voiceCallState by voiceRoomViewModel.uiState.collectAsUiState()
    val voicePresenceByChat by chatViewModel.voiceChannelParticipantsByChat.collectAsUiState()
    val chatDetail by chatViewModel.chatDetailInfo.collectAsUiState()
    val chatsList by chatViewModel.chats.collectAsUiState()
    val chatParticipants by chatViewModel.chatParticipants.collectAsUiState()
    val typingByChat by chatViewModel.typingUsersByChat.collectAsUiState()
    val typingUsers = typingByChat[chatId].orEmpty()
    val isSavedMessagesChat =
        remember(chatId, chatsList) {
            chatId.equals(chatViewModel.savedMessagesChatId, ignoreCase = true) ||
                chatsList.any {
                    it.chatIdValue.equals(chatId, ignoreCase = true) &&
                        (it.isSavedMessagesValue || it.usernameValue.equals("Избранное", ignoreCase = true))
                }
        }
    val canCreatePoll =
        remember(chatId, chatDetail, chatsList, isSavedMessagesChat) {
            if (isSavedMessagesChat) return@remember false
            val safeDetail =
                chatDetail?.takeIf { it.chatIdValue.equals(chatId, ignoreCase = true) }
            val chatFromList =
                chatsList.find { it.chatIdValue.equals(chatId, ignoreCase = true) }
            val isServerChat = isServerChannelChatType(safeDetail?.type)
            val isGroupChat =
                safeDetail?.isGroupValue == true || chatFromList?.isGroupChatValue == true
            val isDirectChat = !isGroupChat && !isServerChat
            !isDirectChat && (isGroupChat || isServerChat)
        }
    LaunchedEffect(canCreatePoll) {
        if (!canCreatePoll) {
            chatViewModel.setShowCreatePoll(false)
        }
    }
    val headerChatName =
        remember(chatId, chatName, chatDetail, chatsList, isSavedMessagesChat) {
            if (isSavedMessagesChat) {
                "Избранное"
            } else {
                val safeDetail =
                    chatDetail?.takeIf { it.chatIdValue.equals(chatId, ignoreCase = true) }
                PushNotificationTitles.resolve(chatId, chatName, safeDetail, chatsList)
            }
        }
    val chatFromList =
        remember(chatId, chatsList) {
            chatsList.find { it.chatIdValue.equals(chatId, ignoreCase = true) }
        }
    val safeChatDetail =
        remember(chatId, chatDetail) {
            chatDetail?.takeIf { it.chatIdValue.equals(chatId, ignoreCase = true) }
        }
    val isGroupChatUi =
        remember(chatId, safeChatDetail, chatFromList, isSavedMessagesChat) {
            if (isSavedMessagesChat) {
                false
            } else {
                safeChatDetail?.isGroupValue == true ||
                    chatFromList?.isGroupChatValue == true ||
                    isServerChannelChatType(safeChatDetail?.type)
            }
        }
    // Сброс позиции при смене чата — иначе остаётся скролл от предыдущего.
    val listState = remember(chatId) { LazyListState() }
    val snackbarHostState = remember { SnackbarHostState() }
    val stickerState by stickerViewModel.uiState.collectAsUiState()
    val focusManager = LocalFocusManager.current

    var messageText by remember(chatId) { mutableStateOf(ChatComposerDrafts.get(chatId)) }
    var showMessageSearch by remember(chatId) { mutableStateOf(false) }
    var messageSearchQuery by remember(chatId) { mutableStateOf("") }
    var showExpressionPanel by remember { mutableStateOf(false) }
    var expressionPanelTab by remember { mutableStateOf(ExpressionPanelTab.EMOJI) }
    var voiceLocked by remember { mutableStateOf(false) }
    var composerMicSlot by remember { mutableStateOf(ComposerMicSlot.Voice) }
    var hiddenVideoPreview by remember { mutableStateOf<PreviewView?>(null) }
    var pendingMediaQueue by remember { mutableStateOf<List<PendingMediaSend>>(emptyList()) }
    var pendingImageEditUri by remember { mutableStateOf<Uri?>(null) }
    var pendingVideoEditUri by remember { mutableStateOf<Uri?>(null) }
    var pendingVideoSpatialCrop by remember { mutableStateOf<VideoSpatialCrop?>(null) }

    fun openMediaBatchForSend(uris: List<Uri>) {
        Log.d("ChatScreen", "openMediaBatchForSend: ${uris.size} uri(s)")
        val sendable = filterBatchSendableUris(context, uris)
        if (sendable.isEmpty()) {
            Log.w("ChatScreen", "openMediaBatchForSend: no sendable uris after filter")
            scope.launch {
                snackbarHostState.showSnackbar("Не удалось подготовить файлы к отправке")
            }
            return
        }
        pendingMediaQueue = sendable.map { resolvePendingMediaSend(context, it) }
        pendingVideoSpatialCrop = null
    }

    fun openMediaForSend(uri: Uri) {
        openMediaBatchForSend(listOf(uri))
    }

    fun clearPendingMediaSend() {
        pendingMediaQueue = emptyList()
        pendingImageEditUri = null
        pendingVideoEditUri = null
        pendingVideoSpatialCrop = null
    }

    val voiceSession =
        remember(chatId, context) {
            VoiceRecordingSession(
                context,
                onRecordingComplete = { audioFile ->
                    chatViewModel.uploadVoiceMessage(chatId, audioFile, context)
                },
                onRecordingCancel = {},
            )
        }

    val videoNoteSession =
        remember(chatId, context) {
            VideoNoteRecordingSession(
                context,
                ContextCompat.getMainExecutor(context),
                onRecordingComplete = { file ->
                    chatViewModel.uploadMedia(
                        chatId,
                        Uri.fromFile(file),
                        context,
                        caption = null,
                        isVideoNote = true,
                    )
                },
                onRecordingCancel = {},
            )
        }

    LaunchedEffect(
        voiceSession.isRecording,
        videoNoteSession.isRecording,
        videoNoteSession.lensSwitchInProgress,
    ) {
        if (!voiceSession.isRecording &&
            !videoNoteSession.isRecording &&
            !videoNoteSession.lensSwitchInProgress
        ) {
            voiceLocked = false
        }
    }

    LaunchedEffect(hiddenVideoPreview, lifecycleOwner, videoNoteSession.useFrontCamera) {
        val pv = hiddenVideoPreview ?: return@LaunchedEffect
        if (videoNoteSession.lensSwitchInProgress) {
            return@LaunchedEffect
        }
        withContext(Dispatchers.Main) {
            videoNoteSession.bindCamera(lifecycleOwner, pv)
        }
    }
    var mediaViewerState by remember { mutableStateOf<MediaViewerState?>(null) }
    /** null = нет ожидания; true/false — с дозвоном или без после выдачи микрофона */
    var pendingNotifyAfterMic by remember { mutableStateOf<Boolean?>(null) }
    var showVoiceCallChoiceDialog by remember { mutableStateOf(false) }
    var showChatInfo by remember { mutableStateOf(false) }
    var showDeleteSelectedConfirm by remember { mutableStateOf(false) }
    var isCreatingPoll by remember { mutableStateOf(false) }

    val username = authState.user?.visibleName().orEmpty()
    val userId = authState.user?.id ?: ""
    val typingLabel =
        remember(typingUsers, userId) {
            formatTypingLabel(typingUsers.filter { it.userId.isNotBlank() && it.userId != userId })
        }
    val headerSubtitle =
        remember(
            isSavedMessagesChat,
            isGroupChatUi,
            typingLabel,
            chatParticipants,
            chatFromList?.userStatusValue,
            chatFromList?.lastSeenValue,
            userId,
        ) {
            when {
                !typingLabel.isNullOrBlank() -> typingLabel
                isSavedMessagesChat -> "Сохранённые сообщения"
                isGroupChatUi -> formatMemberCountLabel(chatParticipants.size)
                else -> {
                    val peer = chatParticipants.firstOrNull { participant ->
                        val id = participant.userIdValue.trim()
                        id.isNotBlank() && !id.equals(userId, ignoreCase = true)
                    }
                    formatPresenceLabel(
                        chatFromList?.userStatusValue ?: peer?.userStatusValue,
                        chatFromList?.lastSeenValue ?: peer?.lastSeen,
                    )
                }
            }
        }
    val headerSubtitleAccent = !typingLabel.isNullOrBlank()
    val editingMessage = chatState.editingMessage

    LaunchedEffect(userId) {
        stickerViewModel.setCurrentUserId(userId)
    }

    LaunchedEffect(showExpressionPanel) {
        if (showExpressionPanel) {
            focusManager.clearFocus()
            stickerViewModel.loadPacks()
            stickerViewModel.preloadPanelContent()
        } else {
            stickerViewModel.onPanelClosed()
        }
    }

    LaunchedEffect(editingMessage?.messageIdValue) {
        if (editingMessage != null) {
            messageText = editingMessage.contentValue
        }
    }

    LaunchedEffect(chatId, messageText, editingMessage?.messageIdValue) {
        if (editingMessage == null) {
            ChatComposerDrafts.set(chatId, messageText)
        }
    }

    val recordAudioPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val withNotify = pendingNotifyAfterMic
        pendingNotifyAfterMic = null
        if (granted && withNotify != null && userId.isNotEmpty()) {
            if (withNotify) {
                chatViewModel.notifyOutgoingVoiceCall(chatId, username, userId)
            }
            onCallClick(chatId, chatName, userId)
        } else if (!granted && withNotify != null) {
            scope.launch {
                snackbarHostState.showSnackbar("Для звонка нужен доступ к микрофону")
            }
        }
    }

    val voiceRecordingPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            val started = voiceSession.start()
            if (!started) {
                scope.launch {
                    snackbarHostState.showSnackbar("Не удалось начать запись")
                }
            }
        } else {
            scope.launch {
                snackbarHostState.showSnackbar("Нужно разрешение на микрофон для голосовых сообщений")
            }
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (!granted) {
            scope.launch {
                snackbarHostState.showSnackbar("Нужна камера для видеокружка")
            }
        }
    }

    fun tryStartVoiceRecording(): Boolean {
        if (voiceSession.isRecording) return true
        val granted =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO,
            ) == PackageManager.PERMISSION_GRANTED
        return if (granted) {
            val started = voiceSession.start()
            if (!started) {
                scope.launch {
                    snackbarHostState.showSnackbar("Не удалось начать запись")
                }
            }
            started
        } else {
            voiceRecordingPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            false
        }
    }

    fun tryStartVideoRecording(): Boolean {
        if (videoNoteSession.isRecording) return true
        val cam =
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        if (!cam) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            return false
        }
        val mic =
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        if (!mic) {
            voiceRecordingPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            return false
        }
        if (!videoNoteSession.cameraBindReady) {
            scope.launch {
                snackbarHostState.showSnackbar("Подождите, камера подключается…")
            }
            return false
        }
        val started = videoNoteSession.startRecording()
        if (!started) {
            scope.launch {
                snackbarHostState.showSnackbar(
                    videoNoteSession.bindError ?: "Не удалось начать запись видео",
                )
            }
        }
        return started
    }

    fun proceedToVoiceCall(withNotifyCallee: Boolean) {
        showVoiceCallChoiceDialog = false
        if (userId.isEmpty() || chatId.isBlank()) return
        ChatCallSignalingState.beginOutgoing(chatId, withNotifyCallee)
        val hasMic =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO,
            ) == PackageManager.PERMISSION_GRANTED
        if (hasMic) {
            if (withNotifyCallee) {
                chatViewModel.notifyOutgoingVoiceCall(chatId, username, userId)
                OutgoingCallRingtone.start(context)
            }
            onCallClick(chatId, chatName, userId)
        } else {
            pendingNotifyAfterMic = withNotifyCallee
            recordAudioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    fun joinExistingVoiceCall() {
        proceedToVoiceCall(withNotifyCallee = false)
    }
    val messages =
        remember(chatId, chatMessages) {
            chatMessages.filter { message ->
                val messageChatId = message.chatIdValue.trim()
                messageChatId.isBlank() || messageChatId.equals(chatId, ignoreCase = true)
            }
        }
    val listItems = remember(chatId, messages, username, userId) {
        buildChatListItems(
            messages = messages,
            currentUsername = username,
            currentUserId = userId,
            showSenderNames = true,
            showAvatars = true,
        )
    }
    val savedMessagesChatId = chatViewModel.savedMessagesChatId
    val pinnedMessages = chatState.pinnedMessages
    val activePinnedMessage = chatViewModel.currentPinnedMessage()
    val activePinnedPreview = remember(activePinnedMessage?.messageIdValue, activePinnedMessage?.contentValue) {
        getPinnedMessagePreview(activePinnedMessage)
    }
    val selectedMessageIds = selectionBundle.second
    val selectionMode = selectionBundle.first
    val deletableSelectedCount =
        remember(selectedMessageIds, messages, username) {
            messages.count {
                it.messageIdValue in selectedMessageIds &&
                    chatViewModel.canDeleteMessage(it, username)
            }
        }

    LaunchedEffect(chatId) {
        chatViewModel.clearSelectionMode()
        chatViewModel.setPinnedBarIndex(0)
    }

    val isLoadingOlder = chatState.isLoadingOlder
    val hasMoreOlder = chatState.hasMoreOlder

    fun scrollToMessageId(messageId: String) {
        if (messageId.isBlank()) return
        val itemIndex =
            listItems.indexOfFirst { item ->
                item is ChatListItem.MessageRow && item.entry.message.messageIdValue == messageId
            }
        if (itemIndex < 0) return
        val reversedIndex = listItems.lastIndex - itemIndex
        scope.launch { listState.animateScrollToItem(reversedIndex) }
    }

    val (messageSearchResults, isMessageSearching) =
        rememberChatMessageSearch(messages = messages, query = messageSearchQuery)

    fun closeMessageSearch() {
        showMessageSearch = false
        messageSearchQuery = ""
        focusManager.clearFocus()
    }

    val onVideoNoteOpen: () -> Unit =
        remember(listState, chatDensity, scope) {
            {
                scope.launch {
                    listState.animateScrollBy(-with(chatDensity) { 120.dp.toPx() })
                }
            }
        }
    val messageRowHandlers =
        rememberMessageRowEventHandlers(
            chatViewModel = chatViewModel,
            context = context,
            scope = scope,
            snackbarHostState = snackbarHostState,
            onOpenMediaViewer = { mediaViewerState = it },
            onVideoNoteOpen = onVideoNoteOpen,
        )

    val voiceBarParticipants =
        remember(chatId, userId, username, voiceCallState, voicePresenceByChat) {
            buildChatVoiceParticipants(
                chatId = chatId,
                userId = userId,
                userName = username,
                voiceCallState = voiceCallState,
                presenceParticipants = voicePresenceByChat[chatId].orEmpty(),
            )
        }
    val isUserInThisVoiceCall =
        voiceCallState.isConnected && voiceCallState.sessionRoomId == chatId

    val getMultipleContentLauncher =
        rememberLauncherForActivityResult(
            contract =
                object : ActivityResultContracts.OpenMultipleDocuments() {
                    override fun createIntent(context: android.content.Context, input: Array<String>): Intent {
                        return super.createIntent(context, input).apply {
                            putExtra(Intent.EXTRA_LOCAL_ONLY, true)
                            addCategory(Intent.CATEGORY_OPENABLE)
                        }
                    }
                },
        ) { uris ->
            if (uris.isNotEmpty()) {
                Log.d("ChatScreen", "System file picker returned ${uris.size} uri(s)")
                uris.forEach { uri ->
                    runCatching {
                        context.contentResolver.takePersistableUriPermission(
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION,
                        )
                    }
                }
                openMediaBatchForSend(uris)
            }
        }
    var showAttachmentPicker by remember { mutableStateOf(false) }
    var attachmentTab by remember { mutableStateOf(AttachmentTab.Gallery) }
    var attachmentSelection by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var attachmentCaption by remember { mutableStateOf("") }
    LaunchedEffect(showAttachmentPicker) {
        if (!showAttachmentPicker) {
            attachmentSelection = emptyList()
            attachmentCaption = ""
        }
    }
    fun toggleAttachmentSelection(uri: Uri) {
        val wasSelected = uri in attachmentSelection
        val next = toggleBatchSelection(attachmentSelection, uri)
        if (next.size == attachmentSelection.size && !wasSelected) {
            scope.launch {
                snackbarHostState.showSnackbar("Можно выбрать не больше $MAX_BATCH_MEDIA_COUNT файлов")
            }
        }
        attachmentSelection = next
    }
    fun sendBatchSelectionDirectly(uris: List<Uri>, caption: String?) {
        val sendable = filterBatchSendableUris(context, uris)
        if (sendable.isEmpty()) {
            Log.w(
                "ChatScreen",
                "sendBatchSelectionDirectly: no sendable uris from ${uris.size} selected: $uris",
            )
            val message =
                if (uris.isEmpty()) {
                    "Не выбраны файлы для отправки"
                } else {
                    "Голосовые сообщения нельзя отправить вместе с файлами"
                }
            scope.launch {
                snackbarHostState.showSnackbar(message)
            }
            return
        }
        Log.d("ChatScreen", "sendBatchSelectionDirectly: uploading ${sendable.size} file(s)")
        chatViewModel.uploadMediaBatch(
            chatId = chatId,
            fileUris = sendable,
            context = context,
            caption = caption,
        )
    }
    fun sendGallerySelection() {
        val uris = attachmentSelection
        if (uris.isEmpty()) return
        showAttachmentPicker = false
        val caption = attachmentCaption.trim().takeIf { it.isNotBlank() }
        attachmentSelection = emptyList()
        attachmentCaption = ""
        val sendable = uris.distinct().take(MAX_BATCH_MEDIA_COUNT)
        Log.d("ChatScreen", "sendGallerySelection: uploading ${sendable.size} gallery item(s)")
        chatViewModel.uploadMediaBatch(
            chatId = chatId,
            fileUris = sendable,
            context = context,
            caption = caption,
        )
    }
    fun sendFileSelection() {
        val uris = attachmentSelection
        if (uris.isEmpty()) return
        showAttachmentPicker = false
        attachmentSelection = emptyList()
        attachmentCaption = ""
        sendBatchSelectionDirectly(uris, caption = null)
    }
    var attachmentMediaItems by remember { mutableStateOf<List<AttachmentMediaItem>>(emptyList()) }
    var attachmentRecentFiles by remember { mutableStateOf<List<AttachmentFileItem>>(emptyList()) }
    var attachmentRecentMusic by remember { mutableStateOf<List<AttachmentFileItem>>(emptyList()) }
    var attachmentMediaLoading by remember { mutableStateOf(false) }
    var attachmentFilesLoading by remember { mutableStateOf(false) }
    var attachmentMusicLoading by remember { mutableStateOf(false) }
    fun loadAttachmentMedia() {
        attachmentMediaLoading = true
        scope.launch {
            attachmentMediaItems =
                runCatching { loadRecentGalleryMedia(context) }
                    .getOrElse {
                        snackbarHostState.showSnackbar("Не удалось открыть галерею")
                        emptyList()
                    }
            attachmentMediaLoading = false
        }
    }
    fun loadAttachmentFiles() {
        attachmentFilesLoading = true
        scope.launch {
            attachmentRecentFiles =
                runCatching { loadRecentFiles(context) }
                    .getOrElse {
                        snackbarHostState.showSnackbar("Не удалось открыть недавние файлы")
                        emptyList()
                    }
            attachmentFilesLoading = false
        }
    }
    fun loadAttachmentMusic() {
        attachmentMusicLoading = true
        scope.launch {
            attachmentRecentMusic =
                runCatching { loadRecentMusic(context) }
                    .getOrElse {
                        snackbarHostState.showSnackbar("Не удалось открыть музыку")
                        emptyList()
                    }
            attachmentMusicLoading = false
        }
    }
    val mediaPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            if (grants.values.any { it }) {
                loadAttachmentMedia()
                loadAttachmentFiles()
                loadAttachmentMusic()
            } else {
                attachmentMediaLoading = false
                attachmentFilesLoading = false
                attachmentMusicLoading = false
                scope.launch {
                    snackbarHostState.showSnackbar("Нужен доступ к фото и видео")
                }
            }
        }
    val attachmentCameraLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
            bitmap ?: return@rememberLauncherForActivityResult
            scope.launch {
                val uri = saveCameraBitmapToCache(context, bitmap)
                openMediaForSend(uri)
            }
        }
    val attachmentCameraPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                showAttachmentPicker = false
                attachmentCameraLauncher.launch(null)
            } else {
                scope.launch {
                    snackbarHostState.showSnackbar("Нужен доступ к камере")
                }
            }
        }

    val screenEnterNonce = remember { mutableIntStateOf(0) }

    DisposableEffect(chatId) {
        screenEnterNonce.intValue++
        ActiveChatState.activeChatId = chatId
        chatViewModel.watchVoicePresence(chatId)
        onDispose {
            chatViewModel.onChatScreenClosed(chatId)
            if (ActiveChatState.activeChatId == chatId) {
                ActiveChatState.activeChatId = null
            }
            voiceSession.disposeAbandon()
            videoNoteSession.disposeAbandon()
        }
    }

    LaunchedEffect(chatId, screenEnterNonce.intValue, username, userId) {
        if (username.isNotEmpty() && userId.isNotEmpty()) {
            chatViewModel.loadMessages(chatId, username, userId)
        }
    }

    LaunchedEffect(chatState.error) {
        val message = chatState.error ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        chatViewModel.clearError()
    }

    // Как в JetChat: «у низа» = firstVisibleItemIndex == 0 (reverseLayout).
    val jumpThresholdPx =
        with(chatDensity) { 56.dp.toPx() }
    val stickToBottom by remember {
        derivedStateOf {
            val total = listState.layoutInfo.totalItemsCount
            if (total == 0) return@derivedStateOf true
            listState.firstVisibleItemIndex == 0 &&
                listState.firstVisibleItemScrollOffset <= jumpThresholdPx
        }
    }

    LaunchedEffect(chatId) {
        // Грузим историю только когда скролл остановился — иначе вставки во время флинга дают лаги.
        snapshotFlow {
            val info = listState.layoutInfo
            val lastVisible = info.visibleItemsInfo.lastOrNull()?.index ?: -1
            val nearOldest =
                info.totalItemsCount > 0 &&
                    lastVisible >= 0 &&
                    lastVisible >= info.totalItemsCount - 3
            nearOldest && !listState.isScrollInProgress
        }
            .distinctUntilChanged()
            .collect { shouldLoad ->
                if (shouldLoad) {
                    chatViewModel.loadOlderMessages(chatId)
                }
            }
    }

    val lastListItemKey =
        remember(listItems) {
            when (val last = listItems.lastOrNull()) {
                is ChatListItem.DateSeparator -> last.key
                is ChatListItem.MessageRow -> last.entry.message.messageIdValue
                null -> ""
            }
        }

    // Как в JetChat: reverseLayout стартует с index 0 (низ).
    // Автоскролл — только когда появилось новое последнее сообщение и пользователь у низа.
    var previousLastKey by remember(chatId) { mutableStateOf("") }
    LaunchedEffect(lastListItemKey) {
        val key = lastListItemKey
        if (key.isEmpty()) return@LaunchedEffect
        val hadPrevious = previousLastKey.isNotEmpty()
        val isNewTail = hadPrevious && key != previousLastKey
        previousLastKey = key
        if (isNewTail && stickToBottom) {
            listState.scrollToItem(0)
        }
    }

    fun scrollToLatestMessage(animated: Boolean = false) {
        if (listItems.isEmpty()) return
        scope.launch {
            // animateScrollToItem через длинную ленту компонует ВСЕ промежуточные
            // элементы → лаг «вниз к последнему» во всех чатах. Анимируем только рядом.
            val farFromBottom = listState.firstVisibleItemIndex > 8
            if (animated && !farFromBottom) {
                listState.animateScrollToItem(0)
            } else {
                listState.scrollToItem(0)
            }
        }
    }

    val imeInsets = WindowInsets.ime
    var keyboardVisible by remember { mutableStateOf(false) }
    LaunchedEffect(imeInsets, chatDensity) {
        snapshotFlow { imeInsets.getBottom(chatDensity) > 0 }
            .distinctUntilChanged()
            .collect { keyboardVisible = it }
    }

    BackHandler(enabled = showChatInfo) { showChatInfo = false }
    val showForward = chatState.forwardMessage != null
    BackHandler(enabled = showMessageSearch) { closeMessageSearch() }
    BackHandler(enabled = showForward) { chatViewModel.cancelForwardMessage() }
    BackHandler(enabled = selectionMode && !showChatInfo && !showForward && !showMessageSearch) {
        chatViewModel.clearSelectionMode()
    }
    BackHandler(
        enabled =
            editingMessage != null &&
                !showChatInfo &&
                !selectionMode &&
                !showForward &&
                !showMessageSearch,
    ) {
        chatViewModel.clearEditingMessage()
        messageText = ""
    }
    SwipeBackContainer(
        onBack = onBack,
        enabled = !showChatInfo && !showForward && !showMessageSearch,
    ) {
        Scaffold(
            containerColor = TelegramMessageUi.ChatBackground,
            // Нижний отступ и цвет — у ChatComposer (фон чата под navigation bar)
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        ) { padding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .background(TelegramMessageUi.ChatBackground),
            ) {
            Box(modifier = Modifier.fillMaxSize()) {
                Column(modifier = Modifier.fillMaxSize()) {
                if (showMessageSearch) {
                    ChatMessageSearchField(
                        query = messageSearchQuery,
                        onQueryChange = { messageSearchQuery = it },
                        onClose = { closeMessageSearch() },
                    )
                    ChatMessageSearchResults(
                        query = messageSearchQuery,
                        results = messageSearchResults,
                        isSearching = isMessageSearching,
                        timeLabel = { formatChatTime(it.createdAtValue) },
                        onResultClick = { message ->
                            scrollToMessageId(message.messageIdValue)
                            closeMessageSearch()
                        },
                    )
                } else {
                    ChatHeader(
                        chatName = headerChatName,
                        subtitle = headerSubtitle,
                        subtitleAccent = headerSubtitleAccent,
                        avatarUrl = safeChatDetail?.displayAvatarPath() ?: chatFromList?.avatarUrlValue,
                        avatarColor = safeChatDetail?.displayAvatarColor() ?: chatFromList?.avatarColorValue,
                        avatarDecoration = chatFromList?.avatarDecorationValue,
                        isSavedMessages = isSavedMessagesChat,
                        isGroupChat = isGroupChatUi,
                        presenceStatus = if (isGroupChatUi || isSavedMessagesChat) null else chatFromList?.userStatusValue,
                        onBackClick = onBack,
                        onTitleClick = { showChatInfo = true },
                        titleClickEnabled = chatId.isNotBlank(),
                        onCallClick = {
                            if (userId.isEmpty() || chatId.isBlank()) return@ChatHeader
                            showVoiceCallChoiceDialog = true
                        },
                        isCallEnabled =
                            !isSavedMessagesChat &&
                                enableVoiceCall &&
                                userId.isNotEmpty() &&
                                chatId.isNotBlank() &&
                                voiceBarParticipants.isEmpty(),
                        onSearchClick = {
                            showExpressionPanel = false
                            showMessageSearch = true
                        },
                    )
                }

                if (!chatState.isLoading && pinnedMessages.isNotEmpty()) {
                    PinnedMessagesBar(
                        pinnedMessages = pinnedMessages,
                        activeIndex = chatState.pinnedBarIndex.coerceIn(0, pinnedMessages.lastIndex),
                        preview = activePinnedPreview,
                        onClick = {
                            activePinnedMessage?.messageIdValue?.let(::scrollToMessageId)
                            if (pinnedMessages.size > 1) {
                                chatViewModel.cyclePinnedBar()
                            }
                        },
                    )
                }

                if (enableVoiceCall) {
                    ChatVoicePresenceBar(
                        participants = voiceBarParticipants,
                        isUserInCall = isUserInThisVoiceCall,
                        currentUserId = userId,
                        onJoinClick = {
                            if (userId.isNotEmpty() && chatId.isNotBlank()) {
                                joinExistingVoiceCall()
                            }
                        },
                        onOpenClick = {
                            if (voiceCallState.isMinimized) {
                                voiceRoomViewModel.expandCall()
                            }
                            onExpandVoiceCall()
                        },
                    )
                }

                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .imePadding(),
                ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .clipToBounds()
                        .background(TelegramMessageUi.ChatBackground),
                ) {
                    val showConnectingStrip =
                        !chatState.isConnected && chatState.error == null && chatMessages.isEmpty()
                    if (showConnectingStrip) {
                        LinearProgressIndicator(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(2.dp),
                            color = TelegramMessageUi.AccentBlue
                        )
                    }

                    when {
                        chatState.error != null && listItems.isEmpty() -> {
                            Column(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.Center,
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = chatState.error ?: "Ошибка загрузки",
                                    color = MaterialTheme.colorScheme.error,
                                    fontSize = 16.sp
                                )
                            }
                        }

                        listItems.isEmpty() -> {
                            if (chatState.isLoading || !chatState.isConnected) {
                                ChatMessagesSkeleton(modifier = Modifier.fillMaxSize())
                            } else {
                                Column(
                                    modifier = Modifier.fillMaxSize().padding(horizontal = 32.dp),
                                    verticalArrangement = Arrangement.Center,
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Text(
                                        text = "Начните общение",
                                        color = DiscordText,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "Напишите сообщение или отправьте фото",
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 14.sp,
                                    )
                                }
                            }
                        }

                        else -> {
                            ProvideTextScramble(enabled = false) {
                            Box(modifier = Modifier.fillMaxSize().clipToBounds()) {
                                ChatMessagesLazyList(
                                    listItems = listItems,
                                    listState = listState,
                                    isLoadingOlder = isLoadingOlder,
                                    hasMoreOlder = hasMoreOlder,
                                    selectionMode = selectionMode,
                                    selectedMessageIds = selectedMessageIds,
                                    currentUsername = username,
                                    currentUserId = userId,
                                    currentChatId = chatId,
                                    savedMessagesChatId = savedMessagesChatId,
                                    handlers = messageRowHandlers,
                                )
                                ChatScrollToBottomFab(
                                    visible = !stickToBottom && listItems.isNotEmpty(),
                                    onClick = { scrollToLatestMessage(animated = true) },
                                    modifier =
                                        Modifier
                                            .align(Alignment.BottomEnd)
                                            .padding(end = 12.dp, bottom = 12.dp),
                                )
                            }
                            }
                        }
                    }

                    VideoNoteRecordingOverlay(
                        composerMicSlot = composerMicSlot,
                        videoNoteSession = videoNoteSession,
                        onPreviewView = { hiddenVideoPreview = it },
                        modifier = Modifier.matchParentSize(),
                    )
                }

                if (selectionMode) {
                    MessageSelectionBar(
                        selectedCount = selectedMessageIds.size,
                        canForward = selectedMessageIds.isNotEmpty(),
                        canDelete = deletableSelectedCount > 0,
                        onCancel = { chatViewModel.clearSelectionMode() },
                        onForward = {
                            chatViewModel.startForwardSelectedMessages()
                        },
                        onDelete = { showDeleteSelectedConfirm = true },
                    )
                } else {
                ChatComposer(
                    messageText = messageText,
                    replyToMessage = chatState.replyToMessage,
                    editingMessage = editingMessage,
                    enabled = !chatState.isLoading,
                    voiceRecordingSession = voiceSession,
                    videoNoteRecordingSession = videoNoteSession,
                    composerMicSlot = composerMicSlot,
                    onToggleComposerMicSlot = {
                        val nextSlot =
                            if (composerMicSlot == ComposerMicSlot.Voice) {
                                videoNoteSession.resetToFrontCamera()
                                ComposerMicSlot.VideoNote
                            } else {
                                ComposerMicSlot.Voice
                            }
                        composerMicSlot = nextSlot
                    },
                    voiceLocked = voiceLocked,
                    onVoiceLockedChange = { voiceLocked = it },
                    onMessageTextChange = {
                        messageText = it
                        chatViewModel.onComposerTextChanged(chatId, it)
                    },
                    onAttachClick = {
                        attachmentTab = AttachmentTab.Gallery
                        showAttachmentPicker = true
                        if (hasMediaReadPermission(context)) {
                            loadAttachmentMedia()
                            loadAttachmentFiles()
                        } else {
                            attachmentMediaLoading = true
                            mediaPermissionLauncher.launch(mediaReadPermissions())
                        }
                    },
                    onExpressionPickerClick = {
                        showAttachmentPicker = false
                        focusManager.clearFocus()
                        showExpressionPanel = !showExpressionPanel
                    },
                    expressionPickerActive = showExpressionPanel,
                    onSendClick = {
                        val text = messageText.trim()
                        if (text.isNotEmpty()) {
                            val editing = chatState.editingMessage
                            if (editing != null) {
                                chatViewModel.editMessage(editing, text) { result ->
                                    result
                                        .onSuccess {
                                            messageText = ""
                                            ChatComposerDrafts.clear(chatId)
                                            scrollToLatestMessage(animated = true)
                                            scope.launch {
                                                snackbarHostState.showSnackbar("Сообщение изменено")
                                            }
                                        }
                                        .onFailure { e ->
                                            scope.launch {
                                                snackbarHostState.showSnackbar(
                                                    e.message ?: "Не удалось изменить сообщение",
                                                )
                                            }
                                        }
                                }
                            } else {
                                chatViewModel.stopTyping(chatId)
                                chatViewModel.sendMessage(chatId, text)
                                messageText = ""
                                ChatComposerDrafts.clear(chatId)
                                scrollToLatestMessage(animated = true)
                            }
                        }
                    },
                    onTryStartVoiceRecording = { tryStartVoiceRecording() },
                    onTryStartVideoRecording = { tryStartVideoRecording() },
                    onCancelReply = { chatViewModel.clearReplyMessage() },
                    onCancelEdit = {
                        chatViewModel.clearEditingMessage()
                        messageText = ""
                    },
                    onComposerFocus = {
                        // JetChat: не прыгаем вниз при фокусе, если читаете историю.
                        if (stickToBottom) {
                            scrollToLatestMessage(animated = true)
                        }
                    },
                    keyboardVisible = keyboardVisible,
                )
                }
            }
            }

            if (showChatInfo) {
                SwipeBackContainer(onBack = { showChatInfo = false }) {
                    ChatInfoModal(
                        visible = true,
                        modifier = Modifier.fillMaxSize(),
                        onDismiss = { showChatInfo = false },
                        chatId = chatId,
                        chatTitleFallback = headerChatName,
                        chatViewModel = chatViewModel,
                        onDeletedChatExit = {
                            showChatInfo = false
                            onBack()
                        },
                        onOpenChat = { showChatInfo = false },
                        onCallClick = {
                            showChatInfo = false
                            showVoiceCallChoiceDialog = true
                        },
                        enableCall =
                            !isSavedMessagesChat &&
                                enableVoiceCall &&
                                userId.isNotEmpty() &&
                                chatId.isNotBlank() &&
                                voiceBarParticipants.isEmpty(),
                        isSavedMessagesOverride = isSavedMessagesChat,
                        currentUserId = userId,
                    )
                }
            }

            if (showForward) {
                SwipeBackContainer(onBack = { chatViewModel.cancelForwardMessage() }) {
                    ForwardMessageScreen(
                        currentChatId = chatId,
                        userId = userId,
                        chatViewModel = chatViewModel,
                        onBack = { chatViewModel.cancelForwardMessage() },
                        onShowMessage = { message ->
                            scope.launch {
                                snackbarHostState.showSnackbar(message)
                            }
                        },
                    )
                }
            }

            if (showVoiceCallChoiceDialog) {
                AlertDialog(
                    onDismissRequest = { showVoiceCallChoiceDialog = false },
                    title = { Text("Голосовой звонок") },
                    text = {
                        Text(
                            "С дозвоном — собеседник получит уведомление и входящий звонок (push), как на сайте. Без дозвона — вы просто подключаетесь к голосовой комнате чата.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    },
                    confirmButton = {
                        TextButton(onClick = { proceedToVoiceCall(withNotifyCallee = true) }) {
                            Text("С дозвоном")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { proceedToVoiceCall(withNotifyCallee = false) }) {
                            Text("Без дозвона")
                        }
                    },
                )
            }

            if (showExpressionPanel) {
                StickerPickerSheet(
                    state = stickerState,
                    recentStickers = stickerViewModel.recentStickers(),
                    selectedStickers = stickerViewModel.stickersForSelectedPack(),
                    cacheManager = stickerViewModel.cacheManager(),
                    initialTab = expressionPanelTab,
                    onDismiss = {
                        stickerViewModel.onPanelClosed()
                        showExpressionPanel = false
                    },
                    onSelectPack = stickerViewModel::selectPack,
                    onStickerClick = { sticker ->
                        chatViewModel.sendSticker(chatId, sticker.idValue)
                        stickerViewModel.onPanelClosed()
                        showExpressionPanel = false
                    },
                    onEmojiClick = { emoji ->
                        messageText += emoji
                        chatViewModel.onComposerTextChanged(chatId, messageText)
                    },
                    onTabChange = { expressionPanelTab = it },
                    onClearRecent = stickerViewModel::clearRecent,
                    onOpenCatalog = stickerViewModel::openCatalog,
                    onCloseCatalog = stickerViewModel::closeCatalog,
                    onInstallPack = { packId ->
                        stickerViewModel.installPack(packId) { result ->
                            scope.launch {
                                result
                                    .onSuccess { snackbarHostState.showSnackbar("Стикерпак добавлен") }
                                    .onFailure { e ->
                                        snackbarHostState.showSnackbar(
                                            e.message ?: "Не удалось добавить стикерпак",
                                        )
                                    }
                            }
                        }
                    },
                    onUploadPack = { title, uri ->
                        stickerViewModel.uploadPack(title, uri) { result ->
                            scope.launch {
                                result
                                    .onSuccess { snackbarHostState.showSnackbar("Стикерпак загружен") }
                                    .onFailure { e ->
                                        snackbarHostState.showSnackbar(
                                            e.message ?: "Не удалось загрузить стикерпак",
                                        )
                                    }
                            }
                        }
                    },
                    onDeletePack = {
                        stickerViewModel.deleteSelectedPack { result ->
                            scope.launch {
                                result
                                    .onSuccess { snackbarHostState.showSnackbar("Стикерпак удалён") }
                                    .onFailure { e ->
                                        snackbarHostState.showSnackbar(
                                            e.message ?: "Не удалось удалить стикерпак",
                                        )
                                    }
                            }
                        }
                    },
                    onPanelClosed = stickerViewModel::onPanelClosed,
                )
            }

            if (showAttachmentPicker) {
                AttachmentPickerSheet(
                    selectedTab = attachmentTab,
                    mediaItems = attachmentMediaItems,
                    recentFiles = attachmentRecentFiles,
                    recentMusic = attachmentRecentMusic,
                    isLoading = attachmentMediaLoading,
                    filesLoading = attachmentFilesLoading,
                    musicLoading = attachmentMusicLoading,
                    selectedUris = attachmentSelection,
                    galleryCaption = attachmentCaption,
                    onGalleryCaptionChange = { attachmentCaption = it },
                    onDismiss = { showAttachmentPicker = false },
                    onTabSelected = { tab ->
                        attachmentTab = tab
                        when (tab) {
                            AttachmentTab.File ->
                                if (attachmentRecentFiles.isEmpty()) loadAttachmentFiles()
                            AttachmentTab.Music ->
                                if (attachmentRecentMusic.isEmpty()) loadAttachmentMusic()
                            AttachmentTab.Gallery -> Unit
                        }
                    },
                    onCameraClick = {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                            PackageManager.PERMISSION_GRANTED
                        ) {
                            showAttachmentPicker = false
                            attachmentCameraLauncher.launch(null)
                        } else {
                            attachmentCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    onPickSingleMedia = { uri ->
                        showAttachmentPicker = false
                        attachmentSelection = emptyList()
                        attachmentCaption = ""
                        openMediaForSend(uri)
                    },
                    onToggleMedia = { uri -> toggleAttachmentSelection(uri) },
                    onPickSingleFile = { uri ->
                        showAttachmentPicker = false
                        attachmentSelection = emptyList()
                        attachmentCaption = ""
                        openMediaForSend(uri)
                    },
                    onToggleFile = { uri -> toggleAttachmentSelection(uri) },
                    onSendGallerySelection = { sendGallerySelection() },
                    onSendFileSelection = { sendFileSelection() },
                    onPickFile = {
                        showAttachmentPicker = false
                        getMultipleContentLauncher.launch(arrayOf("*/*"))
                    },
                    onPickMusic = {
                        showAttachmentPicker = false
                        getMultipleContentLauncher.launch(arrayOf("audio/*"))
                    },
                    onPollClick = {
                        showAttachmentPicker = false
                        chatViewModel.setShowCreatePoll(true)
                    },
                    canCreatePoll = canCreatePoll,
                )
            }

            if (canCreatePoll) {
            CreatePollSheet(
                visible = chatState.showCreatePoll,
                isSubmitting = isCreatingPoll,
                onDismiss = { chatViewModel.setShowCreatePoll(false) },
                onSubmit = { question, options, allowMultiple, isAnonymous ->
                    isCreatingPoll = true
                    chatViewModel.createPoll(
                        chatId = chatId,
                        question = question,
                        options = options,
                        allowMultiple = allowMultiple,
                        isAnonymous = isAnonymous,
                    ) { result ->
                        isCreatingPoll = false
                        scope.launch {
                            result
                                .onSuccess { snackbarHostState.showSnackbar("Опрос создан") }
                                .onFailure { e ->
                                    snackbarHostState.showSnackbar(e.message ?: "Не удалось создать опрос")
                                }
                        }
                    }
                },
            )
            }

            if (showDeleteSelectedConfirm) {
                AlertDialog(
                    onDismissRequest = { showDeleteSelectedConfirm = false },
                    title = { Text("Удалить сообщения") },
                    text = {
                        Text(
                            if (deletableSelectedCount == 1) {
                                "Удалить выбранное сообщение?"
                            } else {
                                "Удалить $deletableSelectedCount сообщений?"
                            },
                        )
                    },
                    confirmButton = {
                        TextButton(
                            onClick = {
                                showDeleteSelectedConfirm = false
                                chatViewModel.deleteSelectedMessages { result ->
                                    scope.launch {
                                        result
                                            .onSuccess { count ->
                                                snackbarHostState.showSnackbar(
                                                    if (count == 1) {
                                                        "Сообщение удалено"
                                                    } else {
                                                        "Удалено сообщений: $count"
                                                    },
                                                )
                                            }
                                            .onFailure { e ->
                                                snackbarHostState.showSnackbar(
                                                    e.message ?: "Не удалось удалить сообщения",
                                                )
                                            }
                                    }
                                }
                            },
                        ) {
                            Text("Удалить")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showDeleteSelectedConfirm = false }) {
                            Text("Отмена")
                        }
                    },
                )
            }

            mediaViewerState?.let { viewerState ->
                MediaViewerOverlay(
                    state = viewerState,
                    onDismiss = { mediaViewerState = null },
                    onSaveToGallery = { item ->
                        chatViewModel.saveMediaToGallery(context, item)
                    },
                    onDownload = { item ->
                        chatViewModel.downloadViewerItem(context, item)
                    },
                )
            }

            when {
                pendingImageEditUri != null -> {
                    ImageEditOverlay(
                        imageUri = pendingImageEditUri!!,
                        onCancel = { pendingImageEditUri = null },
                        onDone = { editedUri ->
                            pendingImageEditUri = null
                            pendingMediaQueue =
                                listOf(resolveEditedImageSend(editedUri))
                        },
                    )
                }
                pendingVideoEditUri != null -> {
                    VideoEditOverlay(
                        videoUri = pendingVideoEditUri!!,
                        onCancel = { pendingVideoEditUri = null },
                        onDone = { crop ->
                            pendingVideoSpatialCrop = crop
                            pendingVideoEditUri = null
                        },
                    )
                }
                pendingMediaQueue.size == 1 -> {
                    val pending = pendingMediaQueue.first()
                    MediaSendOverlay(
                        pending = pending,
                        chatTitle = headerChatName,
                        onDismiss = { clearPendingMediaSend() },
                        onEditImage = { pendingImageEditUri = pending.uri },
                        onEditVideo = { pendingVideoEditUri = pending.uri },
                        videoSpatialCrop = pendingVideoSpatialCrop,
                        onSend = { caption, fileUri ->
                            Log.d("ChatScreen", "MediaSendOverlay onSend: uri=$fileUri")
                            chatViewModel.uploadMedia(
                                chatId = chatId,
                                fileUri = fileUri,
                                context = context,
                                caption = caption.takeIf { it.isNotBlank() },
                                isVideoNote = pending.isVideoNote,
                            )
                            clearPendingMediaSend()
                        },
                    )
                }
                pendingMediaQueue.size > 1 -> {
                    MultiMediaSendOverlay(
                        items = pendingMediaQueue,
                        chatTitle = headerChatName,
                        onDismiss = { clearPendingMediaSend() },
                        onSend = { caption ->
                            chatViewModel.uploadMediaBatch(
                                chatId = chatId,
                                fileUris = pendingMediaQueue.map { it.uri },
                                context = context,
                                caption = caption.takeIf { it.isNotBlank() },
                            )
                            clearPendingMediaSend()
                        },
                    )
                }
            }
        }
        }
    }
    }
}

private fun formatMemberCountLabel(count: Int): String {
    if (count <= 0) return "Групповой чат"
    val mod10 = count % 10
    val mod100 = count % 100
    val noun =
        when {
            mod10 == 1 && mod100 != 11 -> "участник"
            mod10 in 2..4 && mod100 !in 12..14 -> "участника"
            else -> "участников"
        }
    return "$count $noun"
}


private fun isServerChannelChatType(type: String?): Boolean {
    val normalized = type?.trim().orEmpty()
    if (normalized.isBlank()) return false
    return normalized.equals("TextChannel", ignoreCase = true) ||
        normalized.equals("VoiceChannel", ignoreCase = true) ||
        normalized.equals("IdeasBoard", ignoreCase = true) ||
        normalized.equals("News", ignoreCase = true) ||
        normalized.equals("NewsChannel", ignoreCase = true)
}

