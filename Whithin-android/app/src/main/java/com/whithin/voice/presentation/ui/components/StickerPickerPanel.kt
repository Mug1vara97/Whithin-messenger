package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import android.graphics.drawable.ColorDrawable
import coil.compose.AsyncImage
import com.whithin.voice.data.local.StickerCacheManager
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.data.model.STICKER_RECENT_PACK_ID
import com.whithin.voice.data.model.Sticker
import com.whithin.voice.data.model.StickerPack
import com.whithin.voice.data.model.stickerImageUrl
import com.whithin.voice.data.model.stickerIsVideo
import com.whithin.voice.presentation.viewmodel.StickerUiState
import com.whithin.voice.presentation.ui.theme.DiscordOutline

private val StickerGridHeight = 260.dp

@Composable
fun StickerPickerSheet(
    state: StickerUiState,
    recentStickers: List<Sticker>,
    selectedStickers: List<Sticker>,
    cacheManager: StickerCacheManager,
    onDismiss: () -> Unit,
    onSelectPack: (String) -> Unit,
    onStickerClick: (Sticker) -> Unit,
    onClearRecent: () -> Unit,
    onOpenCatalog: () -> Unit,
    onCloseCatalog: () -> Unit,
    onInstallPack: (String) -> Unit,
    onUploadPack: (String, Uri) -> Unit,
    onDeletePack: () -> Unit,
    onPanelClosed: () -> Unit,
    onEmojiClick: (String) -> Unit = {},
    onTabChange: (ExpressionPanelTab) -> Unit = {},
    initialTab: ExpressionPanelTab = ExpressionPanelTab.STICKERS,
    modifier: Modifier = Modifier,
) {
    DisposableEffect(Unit) {
        onDispose { onPanelClosed() }
    }

    var showUploadDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var packTitle by remember { mutableStateOf("") }
    var pendingArchiveUri by remember { mutableStateOf<Uri?>(null) }
    var previewSticker by remember { mutableStateOf<Sticker?>(null) }
    var selectedTab by remember(initialTab) { mutableStateOf(initialTab) }
    val isEmojiTab = selectedTab == ExpressionPanelTab.EMOJI

    LaunchedEffect(initialTab) {
        selectedTab = initialTab
    }

    val archiveLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) {
                pendingArchiveUri = uri
                showUploadDialog = true
            }
        }

    val selectedPackId = state.selectedPackId ?: STICKER_RECENT_PACK_ID
    val showingRecent = selectedPackId == STICKER_RECENT_PACK_ID
    val gridItems = if (showingRecent) recentStickers else selectedStickers
    ChatBottomSheet(
        onDismiss = {
            previewSticker = null
            onDismiss()
        },
        modifier = modifier,
    ) {
                if (isEmojiTab) {
                    EmojiPickerContent(
                        onEmojiClick = onEmojiClick,
                        modifier = Modifier.fillMaxWidth(),
                    )
                } else {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(horizontal = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    item {
                        StickerPackChip(selected = false, onClick = onOpenCatalog) {
                            Icon(Icons.Default.Add, contentDescription = "Добавить пак", tint = Color.White, modifier = Modifier.size(22.dp))
                        }
                    }
                    item {
                        StickerPackChip(selected = showingRecent, onClick = { onSelectPack(STICKER_RECENT_PACK_ID) }) {
                            Icon(Icons.Default.History, contentDescription = "Недавние", tint = Color.White, modifier = Modifier.size(22.dp))
                        }
                    }
                    if (state.canUploadPacks) {
                        item {
                            AdminCreatePackChip(onClick = { archiveLauncher.launch(arrayOf("application/zip")) })
                        }
                    }
                    items(state.packs, key = { it.idValue }) { pack ->
                        val cover = pack.coverImagePathValue
                        StickerPackChip(
                            selected = !showingRecent && pack.idValue == selectedPackId,
                            onClick = { onSelectPack(pack.idValue) },
                        ) {
                            if (!cover.isNullOrBlank()) {
                                if (stickerIsVideo(null, cover)) {
                                    Icon(Icons.Filled.Videocam, contentDescription = pack.titleValue, tint = Color.White, modifier = Modifier.size(22.dp))
                                } else {
                                    val context = LocalContext.current
                                    val coverPx = with(LocalDensity.current) { 36.dp.roundToPx() }
                                    val coverUrl = stickerImageUrl(cover)
                                    val coverRequest =
                                        remember(coverUrl, coverPx) {
                                            sizedImageRequest(context, coverUrl, coverPx)
                                        }
                                    AsyncImage(
                                        model = coverRequest,
                                        contentDescription = pack.titleValue,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize(),
                                    )
                                }
                            } else {
                                Icon(Icons.Outlined.EmojiEmotions, contentDescription = pack.titleValue, tint = Color.White)
                            }
                        }
                    }
                }

                Spacer(Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = if (showingRecent) "Недавние" else state.packs.firstOrNull { it.idValue == selectedPackId }?.titleValue ?: "Стикеры",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    if (showingRecent && recentStickers.isNotEmpty()) {
                        IconButton(onClick = onClearRecent, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Очистить недавние", tint = Color.White.copy(alpha = 0.7f))
                        }
                    }
                    if (state.canUploadPacks && !showingRecent && selectedPackId.isNotBlank()) {
                        IconButton(onClick = { showDeleteDialog = true }, enabled = !state.isDeleting, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Delete, contentDescription = "Удалить стикерпак", tint = Color(0xFFE57373))
                        }
                    }
                }

                when {
                    state.isLoading || state.isUploading || state.isDeleting -> {
                        Box(Modifier.fillMaxWidth().height(StickerGridHeight), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = TelegramMessageUi.AccentBlue)
                        }
                    }
                    !showingRecent && state.packs.isEmpty() -> {
                        Box(Modifier.fillMaxWidth().height(StickerGridHeight), contentAlignment = Alignment.Center) {
                            Text(
                                "Нажмите +, чтобы добавить стикерпак",
                                color = Color.White.copy(alpha = 0.45f),
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(horizontal = 24.dp),
                            )
                        }
                    }
                    showingRecent && recentStickers.isEmpty() -> {
                        Box(Modifier.fillMaxWidth().height(StickerGridHeight), contentAlignment = Alignment.Center) {
                            Text("Недавних стикеров пока нет", color = Color.White.copy(alpha = 0.45f), fontSize = 14.sp)
                        }
                    }
                    !showingRecent && gridItems.isEmpty() -> {
                        Box(Modifier.fillMaxWidth().height(StickerGridHeight), contentAlignment = Alignment.Center) {
                            Text("В этом паке пока нет стикеров", color = Color.White.copy(alpha = 0.45f), fontSize = 14.sp)
                        }
                    }
                    else -> {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(5),
                            modifier = Modifier.fillMaxWidth().height(StickerGridHeight),
                            contentPadding = PaddingValues(horizontal = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            items(gridItems, key = { it.idValue }) { sticker ->
                                StickerGridCell(
                                    sticker = sticker,
                                    cacheManager = cacheManager,
                                    onClick = { onStickerClick(sticker) },
                                    onLongClick = { previewSticker = sticker },
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(8.dp))
                }
                ExpressionPanelBottomTabs(
                    selectedTab = selectedTab,
                    onTabSelected = { tab ->
                        selectedTab = tab
                        onTabChange(tab)
                    },
                    modifier = Modifier.padding(horizontal = 10.dp),
                )
    }

    previewSticker?.let { sticker ->
        Dialog(
            onDismissRequest = { previewSticker = null },
            properties =
                DialogProperties(
                    usePlatformDefaultWidth = false,
                    decorFitsSystemWindows = false,
                    dismissOnBackPress = true,
                    dismissOnClickOutside = true,
                ),
        ) {
            val dialogView = LocalView.current
            SideEffect {
                val window = (dialogView.parent as? DialogWindowProvider)?.window
                window?.setBackgroundDrawable(ColorDrawable(android.graphics.Color.TRANSPARENT))
                window?.setDimAmount(0f)
            }
            StickerLongPressPreviewOverlay(
                sticker = sticker,
                cacheManager = cacheManager,
                onDismiss = { previewSticker = null },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }

    if (state.showCatalog) {
        StickerCatalogDialog(
            packs = state.availablePacks,
            isLoading = state.isCatalogLoading,
            isInstalling = state.isInstalling,
            onDismiss = onCloseCatalog,
            onInstall = onInstallPack,
        )
    }

    if (showUploadDialog) {
        AlertDialog(
            onDismissRequest = {
                showUploadDialog = false
                packTitle = ""
                pendingArchiveUri = null
            },
            title = { Text("Новый стикерпак") },
            text = {
                TextField(
                    value = packTitle,
                    onValueChange = { packTitle = it },
                    placeholder = { Text("Название пака") },
                    singleLine = true,
                    colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val uri = pendingArchiveUri
                        val title = packTitle.trim()
                        if (uri != null && title.isNotBlank()) {
                            onUploadPack(title, uri)
                            showUploadDialog = false
                            packTitle = ""
                            pendingArchiveUri = null
                        }
                    },
                    enabled = packTitle.isNotBlank() && pendingArchiveUri != null,
                ) { Text("Загрузить") }
            },
            dismissButton = {
                TextButton(onClick = { showUploadDialog = false; packTitle = ""; pendingArchiveUri = null }) {
                    Text("Отмена")
                }
            },
        )
    }

    if (showDeleteDialog) {
        val packTitleToDelete = state.packs.firstOrNull { it.idValue == selectedPackId }?.titleValue ?: "этот пак"
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Удалить стикерпак?") },
            text = {
                Text(
                    "Пак «$packTitleToDelete» будет удалён из базы вместе со всеми стикерами.",
                    color = Color.White.copy(alpha = 0.82f),
                )
            },
            confirmButton = {
                TextButton(onClick = { showDeleteDialog = false; onDeletePack() }) {
                    Text("Удалить", color = Color(0xFFE57373))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("Отмена") }
            },
        )
    }
}

@Composable
private fun StickerCatalogDialog(
    packs: List<StickerPack>,
    isLoading: Boolean,
    isInstalling: Boolean,
    onDismiss: () -> Unit,
    onInstall: (String) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Добавить стикерпак") },
        text = {
            when {
                isLoading -> {
                    Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = TelegramMessageUi.AccentBlue)
                    }
                }
                packs.isEmpty() -> {
                    Text("Нет доступных стикерпаков", color = Color.White.copy(alpha = 0.7f))
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().height(320.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(packs, key = { it.idValue }) { pack ->
                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(MaterialTheme.colorScheme.surface)
                                        .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    modifier = Modifier.size(44.dp).clip(CircleShape).background(MaterialTheme.colorScheme.background),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    val cover = pack.coverImagePathValue
                                    if (!cover.isNullOrBlank() && !stickerIsVideo(null, cover)) {
                                        val context = LocalContext.current
                                        val coverPx = with(LocalDensity.current) { 44.dp.roundToPx() }
                                        val coverUrl = stickerImageUrl(cover)
                                        val coverRequest =
                                            remember(coverUrl, coverPx) {
                                                sizedImageRequest(context, coverUrl, coverPx)
                                            }
                                        AsyncImage(
                                            model = coverRequest,
                                            contentDescription = pack.titleValue,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize(),
                                        )
                                    } else {
                                        Icon(Icons.Outlined.EmojiEmotions, contentDescription = null, tint = Color.White)
                                    }
                                }
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(pack.titleValue, color = Color.White, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("${pack.stickersValue.size} стикеров", color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
                                }
                                TextButton(onClick = { onInstall(pack.idValue) }, enabled = !isInstalling) {
                                    Text("Добавить")
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Закрыть") }
        },
    )
}

@Composable
private fun AdminCreatePackChip(onClick: () -> Unit) {
    Column(
        modifier =
            Modifier
                .width(58.dp)
                .clip(RoundedCornerShape(14.dp))
                .border(1.5.dp, DiscordOutline, RoundedCornerShape(14.dp))
                .clickable(onClick = onClick)
                .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.EmojiEmotions, contentDescription = null, tint = Color.White.copy(alpha = 0.85f), modifier = Modifier.size(22.dp))
            Icon(Icons.Default.Add, contentDescription = null, tint = TelegramMessageUi.AccentBlue, modifier = Modifier.size(12.dp).align(Alignment.BottomEnd))
        }
        Spacer(Modifier.height(2.dp))
        Text("Создать", color = Color.White.copy(alpha = 0.78f), fontSize = 10.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun StickerPackChip(
    selected: Boolean,
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (selected) TelegramMessageUi.AccentBlue.copy(alpha = 0.28f) else MaterialTheme.colorScheme.surface)
                .clickable(onClick = onClick)
                .padding(6.dp),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}
