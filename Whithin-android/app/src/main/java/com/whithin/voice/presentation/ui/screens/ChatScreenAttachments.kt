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
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PhotoCamera
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
import com.whithin.voice.presentation.ui.media.sizedImageRequest
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

internal data class AttachmentMediaItem(
    val uri: Uri,
    val mimeType: String,
    val dateAdded: Long,
) {
    val isVideo: Boolean get() = mimeType.startsWith("video/")
}

internal enum class AttachmentTab { Gallery, File, Music }

internal data class AttachmentFileItem(
    val uri: Uri,
    val name: String,
    val sizeBytes: Long,
    val mimeType: String,
)

internal fun mediaReadPermissions(): Array<String> =
    when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
            arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO,
            )
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        else -> emptyArray()
    }

internal fun hasMediaReadPermission(context: Context): Boolean {
    val permissions = mediaReadPermissions()
    return permissions.isEmpty() ||
        permissions.any {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }
}

internal suspend fun loadRecentGalleryMedia(context: Context): List<AttachmentMediaItem> =
    withContext(Dispatchers.IO) {
        val collection = MediaStore.Files.getContentUri("external")
        val projection =
            arrayOf(
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.Files.FileColumns.MIME_TYPE,
                MediaStore.Files.FileColumns.DATE_ADDED,
            )
        val selection =
            "${MediaStore.Files.FileColumns.MEDIA_TYPE}=? OR ${MediaStore.Files.FileColumns.MEDIA_TYPE}=?"
        val selectionArgs =
            arrayOf(
                MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(),
                MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString(),
            )
        val sortOrder = "${MediaStore.Files.FileColumns.DATE_ADDED} DESC"
        val items = mutableListOf<AttachmentMediaItem>()
        context.contentResolver.query(collection, projection, selection, selectionArgs, sortOrder)?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_ADDED)
            while (cursor.moveToNext() && items.size < 80) {
                val id = cursor.getLong(idCol)
                val mime = cursor.getString(mimeCol).orEmpty()
                if (!mime.startsWith("image/") && !mime.startsWith("video/")) continue
                items +=
                    AttachmentMediaItem(
                        uri = ContentUris.withAppendedId(collection, id),
                        mimeType = mime,
                        dateAdded = cursor.getLong(dateCol),
                    )
            }
        }
        items
    }

internal suspend fun loadRecentFiles(context: Context): List<AttachmentFileItem> =
    withContext(Dispatchers.IO) {
        val collection = MediaStore.Files.getContentUri("external")
        val projection =
            arrayOf(
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.SIZE,
                MediaStore.Files.FileColumns.MIME_TYPE,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.Files.FileColumns.DATE_ADDED,
            )
        val selection =
            "${MediaStore.Files.FileColumns.MEDIA_TYPE}!=? " +
                "AND ${MediaStore.Files.FileColumns.MEDIA_TYPE}!=? " +
                "AND ${MediaStore.Files.FileColumns.MEDIA_TYPE}!=? " +
                "AND ${MediaStore.Files.FileColumns.MIME_TYPE} IS NOT NULL " +
                "AND ${MediaStore.Files.FileColumns.MIME_TYPE} NOT LIKE 'audio/%'"
        val selectionArgs =
            arrayOf(
                MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(),
                MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString(),
                MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO.toString(),
            )
        val sortOrder = "${MediaStore.Files.FileColumns.DATE_ADDED} DESC"
        val items = mutableListOf<AttachmentFileItem>()
        context.contentResolver.query(collection, projection, selection, selectionArgs, sortOrder)?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
            while (cursor.moveToNext() && items.size < 30) {
                val mime = cursor.getString(mimeCol).orEmpty()
                val name = cursor.getString(nameCol).orEmpty().ifBlank { "Файл" }
                items +=
                    AttachmentFileItem(
                        uri = ContentUris.withAppendedId(collection, cursor.getLong(idCol)),
                        name = name,
                        sizeBytes = cursor.getLong(sizeCol).coerceAtLeast(0L),
                        mimeType = mime,
                    )
            }
        }
        items
    }

/** Недавняя музыка / аудио — вкладка как в Telegram ChatAttachAlert. */
internal suspend fun loadRecentMusic(context: Context): List<AttachmentFileItem> =
    withContext(Dispatchers.IO) {
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection =
            arrayOf(
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.MIME_TYPE,
                MediaStore.Audio.Media.DATE_ADDED,
            )
        val sortOrder = "${MediaStore.Audio.Media.DATE_ADDED} DESC"
        val items = mutableListOf<AttachmentFileItem>()
        context.contentResolver.query(collection, projection, null, null, sortOrder)?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
            while (cursor.moveToNext() && items.size < 40) {
                val name = cursor.getString(nameCol).orEmpty().ifBlank { "Аудио" }
                items +=
                    AttachmentFileItem(
                        uri = ContentUris.withAppendedId(collection, cursor.getLong(idCol)),
                        name = name,
                        sizeBytes = cursor.getLong(sizeCol).coerceAtLeast(0L),
                        mimeType = cursor.getString(mimeCol).orEmpty().ifBlank { "audio/*" },
                    )
            }
        }
        items
    }

internal suspend fun saveCameraBitmapToCache(
    context: Context,
    bitmap: Bitmap,
): Uri =
    withContext(Dispatchers.IO) {
        val file = File(context.cacheDir, "camera_attach_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)
        }
        Uri.fromFile(file)
    }

internal fun formatFileSize(bytes: Long): String {
    if (bytes < 1024L) return "$bytes Б"
    val kb = bytes / 1024.0
    if (kb < 1024.0) return String.format(Locale.getDefault(), "%.1f КБ", kb)
    val mb = kb / 1024.0
    return String.format(Locale.getDefault(), "%.1f МБ", mb)
}

internal fun batchSelectionLabel(count: Int): String {
    val mod10 = count % 10
    val mod100 = count % 100
    val noun =
        when {
            mod10 == 1 && mod100 != 11 -> "файл"
            mod10 in 2..4 && mod100 !in 12..14 -> "файла"
            else -> "файлов"
        }
    return "$count $noun выбрано"
}

internal fun toggleBatchSelection(current: List<Uri>, uri: Uri): List<Uri> {
    return if (uri in current) {
        current.filterNot { it == uri }
    } else if (current.size >= MAX_BATCH_MEDIA_COUNT) {
        current
    } else {
        current + uri
    }
}

internal fun batchPhotosSelectionLabel(count: Int): String {
    val mod10 = count % 10
    val mod100 = count % 100
    val (verb, noun) =
        when {
            mod10 == 1 && mod100 != 11 -> "Выбрана" to "фотография"
            mod10 in 2..4 && mod100 !in 12..14 -> "Выбраны" to "фотографии"
            else -> "Выбрано" to "фотографий"
        }
    return "$verb $count $noun"
}

@Composable
internal fun AttachmentPickerSheet(
    selectedTab: AttachmentTab,
    mediaItems: List<AttachmentMediaItem>,
    recentFiles: List<AttachmentFileItem>,
    recentMusic: List<AttachmentFileItem> = emptyList(),
    isLoading: Boolean,
    filesLoading: Boolean,
    musicLoading: Boolean = false,
    selectedUris: List<Uri>,
    galleryCaption: String,
    onGalleryCaptionChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onTabSelected: (AttachmentTab) -> Unit,
    onCameraClick: () -> Unit,
    onPickSingleMedia: (Uri) -> Unit,
    onToggleMedia: (Uri) -> Unit,
    onPickSingleFile: (Uri) -> Unit,
    onToggleFile: (Uri) -> Unit,
    onSendGallerySelection: () -> Unit,
    onSendFileSelection: () -> Unit,
    onPickFile: () -> Unit,
    onPickMusic: () -> Unit = onPickFile,
    onPollClick: () -> Unit = {},
    canCreatePoll: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val galleryHasSelection = selectedTab == AttachmentTab.Gallery && selectedUris.isNotEmpty()
    val listHasSelection =
        (selectedTab == AttachmentTab.File || selectedTab == AttachmentTab.Music) &&
            selectedUris.isNotEmpty()

    ChatBottomSheet(onDismiss = onDismiss, modifier = modifier) {
                if (galleryHasSelection) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = batchPhotosSelectionLabel(selectedUris.size),
                            color = DiscordText,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Icon(
                            Icons.Default.KeyboardArrowRight,
                            contentDescription = null,
                            tint = DiscordTextSecondary,
                        )
                    }
                }
                if (listHasSelection) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = batchSelectionLabel(selectedUris.size),
                            color = DiscordText,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        IconButton(onClick = onSendFileSelection) {
                            Icon(
                                Icons.Default.Send,
                                contentDescription = "Отправить выбранное",
                                tint = TelegramMessageUi.AccentBlue,
                                modifier = Modifier.size(26.dp),
                            )
                        }
                    }
                }
                when (selectedTab) {
                    AttachmentTab.File ->
                        AttachmentFileTabContent(
                            recentFiles = recentFiles,
                            isLoading = filesLoading,
                            selectedUris = selectedUris,
                            onPickFile = onPickFile,
                            onPickSingleFile = onPickSingleFile,
                            onToggleFile = onToggleFile,
                        )
                    AttachmentTab.Music ->
                        AttachmentMusicTabContent(
                            recentMusic = recentMusic,
                            isLoading = musicLoading,
                            selectedUris = selectedUris,
                            onPickMusic = onPickMusic,
                            onPickSingle = onPickSingleFile,
                            onToggle = onToggleFile,
                        )
                    AttachmentTab.Gallery ->
                        AttachmentGalleryTabContent(
                            mediaItems = mediaItems,
                            isLoading = isLoading,
                            selectedUris = selectedUris,
                            onCameraClick = onCameraClick,
                            onPickSingle = onPickSingleMedia,
                            onToggleMedia = onToggleMedia,
                        )
                }

                if (galleryHasSelection) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextField(
                            value = galleryCaption,
                            onValueChange = onGalleryCaptionChange,
                            modifier = Modifier.weight(1f),
                            placeholder = {
                                Text("Добавить подпись…", color = DiscordTextSecondary)
                            },
                            singleLine = false,
                            maxLines = 2,
                            shape = RoundedCornerShape(24.dp),
                            colors =
                                TextFieldDefaults.colors(
                                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                                    disabledContainerColor = MaterialTheme.colorScheme.surface,
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                    disabledIndicatorColor = Color.Transparent,
                                    cursorColor = TelegramMessageUi.AccentBlue,
                                    focusedTextColor = DiscordText,
                                    unfocusedTextColor = DiscordText,
                                ),
                        )
                        Box(modifier = Modifier.padding(start = 8.dp)) {
                            FloatingActionButton(
                                onClick = onSendGallerySelection,
                                containerColor = TelegramMessageUi.AccentBlue,
                                contentColor = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(48.dp),
                            ) {
                                Icon(Icons.Default.Send, contentDescription = "Отправить")
                            }
                            Box(
                                modifier =
                                    Modifier
                                        .align(Alignment.TopStart)
                                        .offset(x = (-4).dp, y = (-4).dp)
                                        .size(22.dp)
                                        .clip(CircleShape)
                                        .background(TelegramMessageUi.AccentBlue)
                                        .border(2.dp, MaterialTheme.colorScheme.background, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = "${selectedUris.size}",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                // Нижний ряд кнопок как в Telegram ChatAttachAlert.
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 6.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    AttachmentAction(
                        label = "Галерея",
                        icon = Icons.Filled.Image,
                        accent = Color(0xFF64B5F6),
                        selected = selectedTab == AttachmentTab.Gallery,
                        onClick = { onTabSelected(AttachmentTab.Gallery) },
                    )
                    AttachmentAction(
                        label = "Файл",
                        icon = Icons.Filled.Folder,
                        accent = Color(0xFF81C784),
                        selected = selectedTab == AttachmentTab.File,
                        onClick = { onTabSelected(AttachmentTab.File) },
                    )
                    AttachmentAction(
                        label = "Музыка",
                        icon = Icons.Filled.MusicNote,
                        accent = Color(0xFFFFB74D),
                        selected = selectedTab == AttachmentTab.Music,
                        onClick = { onTabSelected(AttachmentTab.Music) },
                    )
                    if (canCreatePoll) {
                        AttachmentAction(
                            label = "Опрос",
                            icon = Icons.Outlined.Poll,
                            accent = Color(0xFFBA68C8),
                            selected = false,
                            onClick = onPollClick,
                        )
                    }
                }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun AttachmentGalleryTabContent(
    mediaItems: List<AttachmentMediaItem>,
    isLoading: Boolean,
    selectedUris: List<Uri>,
    onCameraClick: () -> Unit,
    onPickSingle: (Uri) -> Unit,
    onToggleMedia: (Uri) -> Unit,
) {
    val selectionIndexByUri =
        remember(selectedUris) {
            selectedUris.withIndex().associate { (index, uri) -> uri to index }
        }
    when {
        isLoading -> {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(420.dp),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = TelegramMessageUi.AccentBlue)
            }
        }
        mediaItems.isEmpty() -> {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Недавние",
                        color = DiscordText,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.Default.KeyboardArrowDown,
                        contentDescription = null,
                        tint = DiscordTextSecondary,
                    )
                }
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(420.dp),
                    contentPadding = PaddingValues(horizontal = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    item { CameraPickerTile(onClick = onCameraClick) }
                }
            }
        }
        else -> {
            // Как ChatAttachAlertPhotoLayout: заголовок альбома + плотная сетка.
            val inMultiSelect = selectedUris.isNotEmpty()
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Недавние",
                        color = DiscordText,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.Default.KeyboardArrowDown,
                        contentDescription = null,
                        tint = DiscordTextSecondary,
                    )
                }
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(420.dp),
                    contentPadding = PaddingValues(horizontal = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    item { CameraPickerTile(onClick = onCameraClick) }
                    items(
                        items = mediaItems,
                        key = { it.uri.toString() },
                    ) { item ->
                        val selectionIndex = selectionIndexByUri[item.uri] ?: -1
                        val isSelected = selectionIndex >= 0
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .height(124.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(Color.Black.copy(alpha = 0.22f)),
                        ) {
                            GalleryMediaThumbnail(item = item)
                            if (isSelected) {
                                Box(
                                    modifier =
                                        Modifier
                                            .fillMaxSize()
                                            .background(Color.Black.copy(alpha = 0.32f)),
                                )
                            }
                            Box(
                                modifier =
                                    Modifier
                                        .fillMaxSize()
                                        .combinedClickable(
                                            onClick = {
                                                if (inMultiSelect || isSelected) {
                                                    onToggleMedia(item.uri)
                                                } else {
                                                    onPickSingle(item.uri)
                                                }
                                            },
                                            onLongClick = { onToggleMedia(item.uri) },
                                        ),
                            )
                            Box(
                                modifier =
                                    Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(6.dp)
                                        .size(26.dp)
                                        .clip(CircleShape)
                                        .then(
                                            if (isSelected) {
                                                Modifier.background(TelegramMessageUi.AccentBlue)
                                            } else {
                                                Modifier
                                                    .background(Color.Black.copy(alpha = 0.28f))
                                                    .border(1.5.dp, Color.White.copy(alpha = 0.85f), CircleShape)
                                            },
                                        )
                                        .clickable(
                                            interactionSource = remember { MutableInteractionSource() },
                                            indication = null,
                                            onClick = { onToggleMedia(item.uri) },
                                        ),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (isSelected) {
                                    Text(
                                        text = "${selectionIndex + 1}",
                                        color = Color.White,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }
                            if (item.isVideo) {
                                Box(
                                    modifier =
                                        Modifier
                                            .align(Alignment.BottomStart)
                                            .padding(6.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(Color.Black.copy(alpha = 0.55f))
                                            .padding(horizontal = 5.dp, vertical = 2.dp),
                                ) {
                                    Text("Видео", color = Color.White, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun AttachmentFileTabContent(
    recentFiles: List<AttachmentFileItem>,
    isLoading: Boolean,
    selectedUris: List<Uri>,
    onPickFile: () -> Unit,
    onPickSingleFile: (Uri) -> Unit,
    onToggleFile: (Uri) -> Unit,
) {
    val selectedUriSet = remember(selectedUris) { selectedUris.toSet() }
    val selectionIndexByUri =
        remember(selectedUris) {
            selectedUris.withIndex().associate { (index, uri) -> uri to index }
        }
    LazyColumn(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(420.dp),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        item {
            // Как ChatAttachAlertDocumentLayout: список источников без лишней «карточки».
            Column(modifier = Modifier.fillMaxWidth()) {
                AttachmentSourceRow(
                    title = "Внутреннее хранилище",
                    subtitle = "Системный файловый менеджер",
                    icon = Icons.Filled.Folder,
                    accent = Color(0xFF81C784),
                    onClick = onPickFile,
                )
                AttachmentSourceRow(
                    title = "Галерея",
                    subtitle = "Фото и видео без сжатия",
                    icon = Icons.Filled.Image,
                    accent = Color(0xFF64B5F6),
                    onClick = onPickFile,
                )
                AttachmentSourceRow(
                    title = "Музыка",
                    subtitle = "Аудиофайлы с устройства",
                    icon = Icons.Filled.MusicNote,
                    accent = Color(0xFFFFB74D),
                    onClick = onPickFile,
                )
            }
        }
        item {
            Text(
                text = "Недавние файлы",
                color = TelegramMessageUi.AccentBlue,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 8.dp, top = 2.dp),
            )
        }
        if (isLoading) {
            item {
                Box(Modifier.fillMaxWidth().height(90.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = TelegramMessageUi.AccentBlue)
                }
            }
        } else if (recentFiles.isEmpty()) {
            item {
                Text(
                    text = "Недавние файлы не найдены",
                    color = DiscordTextSecondary,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(start = 8.dp, bottom = 24.dp),
                )
            }
        } else {
            items(
                items = recentFiles,
                key = { it.uri.toString() },
            ) { file ->
                AttachmentRecentFileRow(
                    file = file,
                    isSelected = file.uri in selectedUriSet,
                    selectionIndex = selectionIndexByUri[file.uri] ?: -1,
                    onClick = { onPickSingleFile(file.uri) },
                    onLongClick = { onToggleFile(file.uri) },
                )
            }
        }
    }
}

@Composable
internal fun AttachmentMusicTabContent(
    recentMusic: List<AttachmentFileItem>,
    isLoading: Boolean,
    selectedUris: List<Uri>,
    onPickMusic: () -> Unit,
    onPickSingle: (Uri) -> Unit,
    onToggle: (Uri) -> Unit,
) {
    val selectedUriSet = remember(selectedUris) { selectedUris.toSet() }
    val selectionIndexByUri =
        remember(selectedUris) {
            selectedUris.withIndex().associate { (index, uri) -> uri to index }
        }
    LazyColumn(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(420.dp),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        item {
            AttachmentSourceRow(
                title = "Выбрать музыку",
                subtitle = "Открыть файловый менеджер",
                icon = Icons.Filled.MusicNote,
                accent = Color(0xFFFFB74D),
                onClick = onPickMusic,
            )
        }
        item {
            Text(
                text = "Недавние аудио",
                color = TelegramMessageUi.AccentBlue,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 8.dp, top = 2.dp),
            )
        }
        if (isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth().height(90.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = TelegramMessageUi.AccentBlue)
                }
            }
        } else if (recentMusic.isEmpty()) {
            item {
                Text(
                    text = "Аудиофайлы не найдены",
                    color = DiscordTextSecondary,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(start = 8.dp, bottom = 24.dp),
                )
            }
        } else {
            items(
                items = recentMusic,
                key = { it.uri.toString() },
            ) { file ->
                AttachmentRecentFileRow(
                    file = file,
                    isSelected = file.uri in selectedUriSet,
                    selectionIndex = selectionIndexByUri[file.uri] ?: -1,
                    onClick = { onPickSingle(file.uri) },
                    onLongClick = { onToggle(file.uri) },
                )
            }
        }
    }
}

@Composable
internal fun AttachmentSourceRow(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector = Icons.Default.AttachFile,
    accent: Color = TelegramMessageUi.AccentBlue,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(accent.copy(alpha = 0.22f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(24.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(title, color = DiscordText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = DiscordTextSecondary, fontSize = 13.sp)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun AttachmentRecentFileRow(
    file: AttachmentFileItem,
    isSelected: Boolean,
    selectionIndex: Int,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(
                    if (isSelected) {
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                    } else {
                        Color.Transparent
                    },
                )
                .combinedClickable(
                    onClick = onClick,
                    onLongClick = onLongClick,
                )
                .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFE9C75B)),
            contentAlignment = Alignment.Center,
        ) {
            Text(file.name.substringAfterLast('.', "?").take(3), color = Color.White, fontSize = 12.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = file.name,
                color = DiscordText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(formatFileSize(file.sizeBytes), color = DiscordTextSecondary, fontSize = 13.sp)
        }
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(TelegramMessageUi.AccentBlue),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "${selectionIndex + 1}",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
internal fun CameraPickerTile(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(124.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Color(0xFF1C1F24))
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.PhotoCamera,
            contentDescription = "Камера",
            tint = Color.White,
            modifier = Modifier.size(32.dp),
        )
    }
}

@Composable
internal fun GalleryMediaThumbnail(item: AttachmentMediaItem) {
    val context = LocalContext.current
    val thumbPx = with(LocalDensity.current) { 112.dp.roundToPx() }
    var videoFrame by remember(item.uri) { mutableStateOf<Bitmap?>(null) }

    LaunchedEffect(item.uri, item.isVideo) {
        if (!item.isVideo) return@LaunchedEffect
        videoFrame =
            withContext(Dispatchers.IO) {
                runCatching {
                    val retriever = MediaMetadataRetriever()
                    try {
                        retriever.setDataSource(context, item.uri)
                        retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                    } finally {
                        runCatching { retriever.release() }
                    }
                }.getOrNull()
            }
    }

    val frame = videoFrame
    if (item.isVideo && frame != null) {
        Image(
            bitmap = frame.asImageBitmap(),
            contentDescription = "Видео",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
    } else {
        val request =
            remember(item.uri, thumbPx) {
                sizedImageRequest(context, item.uri, thumbPx)
            }
        AsyncImage(
            model = request,
            contentDescription = if (item.isVideo) "Видео" else "Фото",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable
internal fun AttachmentAction(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Color = TelegramMessageUi.AccentBlue,
) {
    Column(
        modifier =
            Modifier
                .clip(RoundedCornerShape(14.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 6.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(
                        if (selected) accent else accent.copy(alpha = 0.18f),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (selected) Color.White else accent,
                modifier = Modifier.size(26.dp),
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            color = if (selected) DiscordText else DiscordTextSecondary,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
        )
    }
}
