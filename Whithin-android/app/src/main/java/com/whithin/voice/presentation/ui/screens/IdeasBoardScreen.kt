package com.whithin.voice.presentation.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import com.whithin.voice.data.model.IdeaBoardCard
import com.whithin.voice.presentation.ui.components.AppText as Text
import com.whithin.voice.presentation.ui.screens.ideasboard.IdeasBoardColors
import com.whithin.voice.presentation.ui.screens.ideasboard.IdeasBoardDimens
import com.whithin.voice.presentation.ui.screens.ideasboard.IdeasBoardFonts
import com.whithin.voice.presentation.ui.screens.ideasboard.IdeasBoardGridLayout
import com.whithin.voice.presentation.ui.screens.ideasboard.cutTitleRotation
import com.whithin.voice.presentation.ui.screens.ideasboard.cutTitleStyle
import com.whithin.voice.presentation.ui.screens.ideasboard.titleLetterRotation
import com.whithin.voice.presentation.ui.screens.ideasboard.titleLetterStyle
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.IdeaBoardSort
import com.whithin.voice.presentation.viewmodel.IdeasBoardViewModel
import com.whithin.voice.presentation.viewmodel.visibleCards
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.min

private val DateFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy", Locale("ru"))

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IdeasBoardScreen(
    serverId: String,
    chatId: String,
    channelName: String,
    userId: String,
    onBack: () -> Unit,
    viewModel: IdeasBoardViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsUiState()
    val snackbarHostState = remember { SnackbarHostState() }
    var deleteTarget by remember { mutableStateOf<IdeaBoardCard?>(null) }

    LaunchedEffect(serverId, chatId, userId) {
        if (userId.isNotBlank()) viewModel.initialize(userId)
    }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.consumeError()
        }
    }

    deleteTarget?.let { card ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            containerColor = IdeasBoardColors.CardPaper,
            titleContentColor = IdeasBoardColors.OuterBg,
            textContentColor = IdeasBoardColors.BodyInk,
            title = {
                Text(
                    "Удалить идею",
                    fontFamily = IdeasBoardFonts.Title,
                    fontWeight = FontWeight.Normal,
                )
            },
            text = {
                Text(
                    "Удалить «${card.titleValue}» с доски?",
                    fontFamily = IdeasBoardFonts.Body,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteCard(card)
                    deleteTarget = null
                }) {
                    Text("УДАЛИТЬ", color = IdeasBoardColors.StampRed, fontFamily = IdeasBoardFonts.Stamp)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) {
                    Text("ОТМЕНА", fontFamily = IdeasBoardFonts.Stamp)
                }
            },
        )
    }

    if (state.showCompose) {
        IdeaBoardComposeDialog(
            isEditing = state.editingCard != null,
            title = state.composeTitle,
            body = state.composeBody,
            tag = state.composeTag,
            sourceUrl = state.composeSourceUrl,
            isSaving = state.isSaving,
            onDismiss = viewModel::closeCompose,
            onTitleChange = viewModel::onComposeTitleChange,
            onBodyChange = viewModel::onComposeBodyChange,
            onTagChange = viewModel::onComposeTagChange,
            onSourceUrlChange = viewModel::onComposeSourceUrlChange,
            onSave = viewModel::saveCompose,
        )
    }

    state.selectedCard?.let { card ->
        IdeaBoardViewDialog(
            card = card,
            canManage = viewModel.canManageCard(card),
            onDismiss = { viewModel.selectCard(null) },
            onEdit = { viewModel.openEditForm(card) },
            onDelete = { deleteTarget = card },
        )
    }

    val visible = viewModel.visibleCards(state)
    val titleLetters = remember(channelName) {
        channelName.uppercase().replace("\\s+".toRegex(), "").take(12).toList()
            .ifEmpty { listOf('И', 'Д', 'Е', 'И') }
    }
    val configuration = LocalConfiguration.current
    val showHint = configuration.screenHeightDp >= 720

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(IdeasBoardColors.OuterBg)
            .navigationBarsPadding(),
    ) {
            IdeasBoardTopBar(
                channelName = channelName,
                onBack = onBack,
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                contentAlignment = Alignment.TopCenter,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .widthIn(max = IdeasBoardDimens.BoardMaxWidth),
                ) {
                    CorkBoardFrame(modifier = Modifier.fillMaxSize()) {
                        Column(modifier = Modifier.fillMaxSize()) {
                            CaseHeader(
                                titleLetters = titleLetters,
                                sort = state.sort,
                                unfiledOnly = state.unfiledOnly,
                                canCreate = state.canCreate,
                                showHint = showHint,
                                onSort = viewModel::setSort,
                                onToggleUnfiled = viewModel::toggleUnfiledOnly,
                                onCreate = viewModel::openCreateForm,
                            )

                        BoxWithConstraints(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                        ) {
                            val gridLayout = remember(maxWidth, maxHeight) {
                                computeGridLayout(maxWidth, maxHeight)
                            }
                            val totalPages = maxOf(
                                1,
                                (visible.size + gridLayout.cardsPerPage - 1) / gridLayout.cardsPerPage,
                            )
                            val safePage = state.currentPage.coerceIn(1, totalPages)
                            val pageCards = visible
                                .drop((safePage - 1) * gridLayout.cardsPerPage)
                                .take(gridLayout.cardsPerPage)

                            LaunchedEffect(state.sort, state.unfiledOnly, gridLayout.cols, gridLayout.rows) {
                                viewModel.setPage(1)
                            }

                            Column(modifier = Modifier.fillMaxSize()) {
                                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                                    when {
                                        state.isLoading && visible.isEmpty() -> {
                                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                                Text(
                                                    text = "Загрузка идей…",
                                                    color = IdeasBoardColors.MutedBrown,
                                                    fontFamily = IdeasBoardFonts.Body,
                                                    fontSize = 15.sp,
                                                )
                                            }
                                        }

                                        visible.isEmpty() -> {
                                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                                Text(
                                                    text = buildString {
                                                        append("Пока нет идей.")
                                                        if (state.canCreate) {
                                                            append(" Нажмите «+ ИДЕЯ», чтобы добавить первую.")
                                                        }
                                                    },
                                                    color = IdeasBoardColors.MutedBrown,
                                                    fontFamily = IdeasBoardFonts.Stamp,
                                                    fontSize = 14.sp,
                                                    letterSpacing = 0.08.sp,
                                                    modifier = Modifier.padding(32.dp),
                                                )
                                            }
                                        }

                                        else -> {
                                            LazyVerticalGrid(
                                                columns = GridCells.Fixed(gridLayout.cols),
                                                modifier = Modifier.fillMaxSize(),
                                                contentPadding = PaddingValues(0.dp),
                                                horizontalArrangement = Arrangement.spacedBy(IdeasBoardDimens.GridGapX),
                                                verticalArrangement = Arrangement.spacedBy(IdeasBoardDimens.GridGapY),
                                            ) {
                                                itemsIndexed(pageCards, key = { _, card -> card.cardIdValue }) { index, card ->
                                                    val rotation = card.rotationValue.takeIf { it != 0f }
                                                        ?: (((index * 37) % 9) - 4).toFloat()
                                                    IdeaExhibitCard(
                                                        card = card,
                                                        rotation = rotation,
                                                        maxHeight = gridLayout.cardMaxHeight,
                                                        canManage = viewModel.canManageCard(card),
                                                        onOpen = { viewModel.selectCard(card) },
                                                        onEdit = { viewModel.openEditForm(card) },
                                                        onToggleFiled = { viewModel.toggleFiled(card) },
                                                        onDelete = { deleteTarget = card },
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }

                                if (totalPages > 1) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(top = 8.dp),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        BoardCtrlButton(
                                            label = "← НАЗАД",
                                            active = false,
                                            enabled = safePage > 1,
                                            onClick = { viewModel.setPage(safePage - 1) },
                                        )
                                        Text(
                                            text = "СТРАНИЦА $safePage / $totalPages",
                                            color = IdeasBoardColors.MutedBrown,
                                            fontFamily = IdeasBoardFonts.Stamp,
                                            fontSize = 13.sp,
                                            letterSpacing = 1.2.sp,
                                            modifier = Modifier.padding(horizontal = 12.dp),
                                        )
                                        BoardCtrlButton(
                                            label = "ДАЛЕЕ →",
                                            active = false,
                                            enabled = safePage < totalPages,
                                            onClick = { viewModel.setPage(safePage + 1) },
                                        )
                                    }
                                }

                                Text(
                                    text = buildString {
                                        append("${visible.size} ИДЕЙ НА ДОСКЕ")
                                        if (totalPages > 1) append(" · СТР. $safePage/$totalPages")
                                    },
                                    color = IdeasBoardColors.MutedBrown,
                                    fontFamily = IdeasBoardFonts.Stamp,
                                    fontSize = 12.sp,
                                    letterSpacing = 2.sp,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 6.dp, bottom = 4.dp),
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                        }
                    }
                }
            }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun CorkBoardFrame(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .shadow(20.dp, clip = false)
            .border(IdeasBoardDimens.BoardBorder, IdeasBoardColors.BoardBorder)
            .background(IdeasBoardColors.BoardBg)
            .corkTexture()
            .padding(20.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .drawBehind {
                    var y = -size.height
                    while (y < size.height * 2) {
                        drawLine(
                            color = Color.Black.copy(alpha = 0.025f),
                            start = Offset(0f, y),
                            end = Offset(size.width, y + size.width * 0.5f),
                            strokeWidth = 1f,
                        )
                        y += 4f
                    }
                },
        )
        content()
    }
}

private fun Modifier.corkTexture(): Modifier = drawBehind {
    drawRect(IdeasBoardColors.BoardBg)
    val dot = Color.Black.copy(alpha = 0.06f)
    val spacing = 24f
    var y = 0f
    while (y < size.height) {
        var x = 0f
        while (x < size.width) {
            drawCircle(dot, radius = 2f, center = Offset(x + 5f, y + 7f))
            x += spacing
        }
        y += spacing * 0.8f
    }
}

@Composable
private fun IdeasBoardTopBar(
    channelName: String,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Назад",
                tint = IdeasBoardColors.Cream,
            )
        }
        Text(
            text = channelName.ifBlank { "Доска" },
            color = IdeasBoardColors.Cream,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CaseHeader(
    titleLetters: List<Char>,
    sort: IdeaBoardSort,
    unfiledOnly: Boolean,
    canCreate: Boolean,
    showHint: Boolean,
    onSort: (IdeaBoardSort) -> Unit,
    onToggleUnfiled: () -> Unit,
    onCreate: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "ДОСКА",
            color = IdeasBoardColors.StampRed,
            fontFamily = IdeasBoardFonts.Stamp,
            fontSize = 14.sp,
            letterSpacing = 2.sp,
            modifier = Modifier
                .rotate(-4f)
                .border(3.dp, IdeasBoardColors.StampRed)
                .padding(horizontal = 10.dp, vertical = 3.dp),
        )
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
            titleLetters.forEachIndexed { index, char ->
                val (bg, fg) = titleLetterStyle(index)
                Text(
                    text = char.toString(),
                    color = fg,
                    fontFamily = IdeasBoardFonts.Title,
                    fontWeight = FontWeight.Normal,
                    fontSize = 32.sp,
                    modifier = Modifier
                        .rotate(titleLetterRotation(index))
                        .background(bg)
                        .padding(horizontal = 2.dp)
                        .shadow(2.dp),
                )
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(top = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            BoardCtrlButton("СНАЧАЛА НОВЫЕ", sort == IdeaBoardSort.NEWEST) { onSort(IdeaBoardSort.NEWEST) }
            BoardCtrlButton("СТАРЫЕ", sort == IdeaBoardSort.OLDEST) { onSort(IdeaBoardSort.OLDEST) }
            BoardCtrlButton("ПО ТЕГУ", sort == IdeaBoardSort.TAG) { onSort(IdeaBoardSort.TAG) }
            BoardCtrlButton("ТОЛЬКО АКТИВНЫЕ", unfiledOnly, onClick = onToggleUnfiled)
            if (canCreate) {
                BoardCtrlButton("+ ИДЕЯ", active = true, inverted = true, onClick = onCreate)
            }
        }
        if (showHint) {
            Text(
                text = "нажмите на заголовок для заметок",
                color = IdeasBoardColors.MutedBrown.copy(alpha = 0.7f),
                fontFamily = IdeasBoardFonts.Stamp,
                fontSize = 11.sp,
                letterSpacing = 0.5.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun BoardCtrlButton(
    label: String,
    active: Boolean,
    enabled: Boolean = true,
    inverted: Boolean = false,
    onClick: () -> Unit,
) {
    val bg = when {
        inverted -> IdeasBoardColors.OuterBg
        active -> IdeasBoardColors.StampRed
        else -> IdeasBoardColors.Cream
    }
    val fg = when {
        inverted -> IdeasBoardColors.Cream
        active -> Color.White
        else -> IdeasBoardColors.OuterBg
    }
    Box(
        modifier = Modifier
            .shadow(2.dp)
            .background(bg)
            .border(1.dp, IdeasBoardColors.OuterBg)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = fg.copy(alpha = if (enabled) 1f else 0.45f),
            fontFamily = IdeasBoardFonts.Stamp,
            fontSize = 11.sp,
            letterSpacing = 0.8.sp,
            maxLines = 1,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IdeaExhibitCard(
    card: IdeaBoardCard,
    rotation: Float,
    maxHeight: androidx.compose.ui.unit.Dp,
    canManage: Boolean,
    onOpen: () -> Unit,
    onEdit: () -> Unit,
    onToggleFiled: () -> Unit,
    onDelete: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp)
            .rotate(rotation),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .shadow(
                    elevation = 4.dp,
                    shape = RoundedCornerShape(0.dp),
                    ambientColor = Color.Black.copy(alpha = 0.22f),
                    spotColor = Color.Black.copy(alpha = 0.14f),
                )
                .background(IdeasBoardColors.CardPaper)
                .then(
                    if (card.isFiledValue) {
                        Modifier.background(IdeasBoardColors.CardPaper.copy(alpha = 0.7f))
                    } else {
                        Modifier
                    },
                )
                .heightIn(max = maxHeight)
                .padding(horizontal = 10.dp, vertical = 9.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .drawBehind {
                        drawLine(
                            color = IdeasBoardColors.DashedMeta,
                            start = Offset(0f, size.height),
                            end = Offset(size.width, size.height),
                            strokeWidth = 1f,
                            pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(6f, 4f)),
                        )
                    }
                    .padding(bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = truncate(card.authorUsernameValue, 18),
                    color = IdeasBoardColors.MetaRed,
                    fontFamily = IdeasBoardFonts.Stamp,
                    fontSize = 9.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                card.tagValue?.let { tag ->
                    Text(
                        text = "#${truncate(tag, 14)}",
                        color = IdeasBoardColors.MetaRed,
                        fontFamily = IdeasBoardFonts.Stamp,
                        fontSize = 9.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(start = 4.dp),
                    )
                }
                Text(
                    text = formatDate(card.createdAtValue),
                    color = IdeasBoardColors.MetaRed,
                    fontFamily = IdeasBoardFonts.Stamp,
                    fontSize = 9.sp,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }

            FlowRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onOpen,
                    )
                    .padding(bottom = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                card.titleValue.forEachIndexed { index, char ->
                    if (char == ' ') {
                        Spacer(Modifier.width(3.dp))
                    } else {
                        val (bg, fg) = cutTitleStyle(index)
                        Text(
                            text = char.toString(),
                            color = fg,
                            fontFamily = IdeasBoardFonts.Title,
                            fontWeight = FontWeight.Normal,
                            fontSize = 15.sp,
                            modifier = Modifier
                                .rotate(cutTitleRotation(index))
                                .background(bg)
                                .padding(horizontal = 1.dp),
                        )
                    }
                }
            }

            if (card.bodyValue.isNotBlank()) {
                Text(
                    text = card.bodyValue,
                    color = IdeasBoardColors.BodyInk,
                    fontFamily = IdeasBoardFonts.Body,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (canManage) {
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    CardActionButton("РЕДАКТИРОВАТЬ", onEdit)
                    CardActionButton(
                        if (card.isFiledValue) "ВЕРНУТЬ" else "В АРХИВ",
                        onToggleFiled,
                    )
                    CardActionButton("УДАЛИТЬ", onDelete)
                }
            }
        }

        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = (-14).dp, y = (-2).dp)
                .size(IdeasBoardDimens.TapeWidth, IdeasBoardDimens.TapeHeight)
                .zIndex(1f)
                .rotate(8f)
                .shadow(1.dp)
                .background(IdeasBoardColors.Tape)
                .drawBehind {
                    drawLine(
                        color = Color.White.copy(alpha = 0.35f),
                        start = Offset(0f, 0f),
                        end = Offset(size.width, 0f),
                        strokeWidth = 1.5f,
                    )
                },
        )

        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = (-3).dp)
                .zIndex(2f)
                .size(IdeasBoardDimens.PinSize)
                .shadow(2.dp, CircleShape)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(IdeasBoardColors.PinHighlight, IdeasBoardColors.PinShadow),
                        center = Offset(0.35f, 0.3f),
                        radius = 1.2f,
                    ),
                ),
        )

        if (card.isFiledValue) {
            Box(
                Modifier
                    .matchParentSize()
                    .zIndex(3f)
                    .background(Color(0x28A08060)),
            )
        }
    }
}

@Composable
private fun CardActionButton(label: String, onClick: () -> Unit) {
    Text(
        text = label,
        color = IdeasBoardColors.ActionBorder,
        fontFamily = IdeasBoardFonts.Stamp,
        fontSize = 9.sp,
        letterSpacing = 0.5.sp,
        modifier = Modifier
            .border(1.dp, IdeasBoardColors.ActionBorder)
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
private fun IdeaBoardViewDialog(
    card: IdeaBoardCard,
    canManage: Boolean,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val context = LocalContext.current
    IdeaBoardCaseDialog(onDismiss = onDismiss, wide = true) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "×",
                color = IdeasBoardColors.MetaRed,
                fontFamily = IdeasBoardFonts.Title,
                fontSize = 26.sp,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .clickable(onClick = onDismiss)
                    .padding(4.dp),
            )
        }
        Text(
            text = "ДЕЛО № ${card.cardIdValue.take(8).uppercase()}",
            color = IdeasBoardColors.StampRed,
            fontFamily = IdeasBoardFonts.Stamp,
            fontSize = 11.sp,
            letterSpacing = 1.2.sp,
            modifier = Modifier
                .rotate(-2f)
                .border(2.dp, IdeasBoardColors.StampRed)
                .padding(horizontal = 8.dp, vertical = 3.dp),
        )
        Text(
            text = card.titleValue,
            color = IdeasBoardColors.OuterBg,
            fontFamily = IdeasBoardFonts.Title,
            fontWeight = FontWeight.Normal,
            fontSize = 24.sp,
            lineHeight = 28.sp,
            modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
        )
        IdeaNoteLine("Автор", card.authorUsernameValue)
        IdeaNoteLine("Дата", formatDate(card.createdAtValue))
        card.tagValue?.let { IdeaNoteLine("Тег", "#$it") }
        Text(
            text = card.bodyValue.ifBlank { "Без описания" },
            color = IdeasBoardColors.BodyInk,
            fontFamily = IdeasBoardFonts.Body,
            fontSize = 15.sp,
            lineHeight = 24.sp,
            modifier = Modifier.padding(vertical = 10.dp),
        )
        card.sourceUrlValue?.let { url ->
            BoardCtrlButton(
                label = "ОТКРЫТЬ ИСТОЧНИК",
                active = false,
                onClick = {
                    runCatching {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    }
                },
            )
        }
        if (canManage) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 8.dp),
            ) {
                BoardCtrlButton("РЕДАКТИРОВАТЬ", active = true, onClick = onEdit)
                BoardCtrlButton("УДАЛИТЬ", active = false, onClick = onDelete)
            }
        }
    }
}

@Composable
private fun IdeaBoardComposeDialog(
    isEditing: Boolean,
    title: String,
    body: String,
    tag: String,
    sourceUrl: String,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onTitleChange: (String) -> Unit,
    onBodyChange: (String) -> Unit,
    onTagChange: (String) -> Unit,
    onSourceUrlChange: (String) -> Unit,
    onSave: () -> Unit,
) {
    IdeaBoardCaseDialog(onDismiss = onDismiss, wide = false) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "×",
                color = IdeasBoardColors.MetaRed,
                fontFamily = IdeasBoardFonts.Title,
                fontSize = 26.sp,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .clickable(onClick = onDismiss)
                    .padding(4.dp),
            )
        }
        Text(
            text = if (isEditing) "РЕДАКТИРОВАНИЕ" else "НОВАЯ ИДЕЯ",
            color = IdeasBoardColors.StampRed,
            fontFamily = IdeasBoardFonts.Stamp,
            fontSize = 11.sp,
            letterSpacing = 1.2.sp,
            modifier = Modifier
                .rotate(-2f)
                .border(2.dp, IdeasBoardColors.StampRed)
                .padding(horizontal = 8.dp, vertical = 3.dp),
        )
        Spacer(Modifier.height(16.dp))
        IdeaComposeField(value = title, onValueChange = onTitleChange, placeholder = "Заголовок", singleLine = true, enabled = !isSaving)
        IdeaComposeField(value = body, onValueChange = onBodyChange, placeholder = "Описание идеи", minLines = 5, enabled = !isSaving)
        IdeaComposeField(value = tag, onValueChange = onTagChange, placeholder = "Тег (необязательно)", singleLine = true, enabled = !isSaving)
        IdeaComposeField(value = sourceUrl, onValueChange = onSourceUrlChange, placeholder = "Ссылка (необязательно)", singleLine = true, enabled = !isSaving)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
            BoardCtrlButton(
                label = if (isSaving) "Сохранение…" else if (isEditing) "СОХРАНИТЬ" else "ЗАКРЕПИТЬ НА ДОСКЕ",
                active = true,
                enabled = !isSaving,
                onClick = onSave,
            )
            BoardCtrlButton("ОТМЕНА", active = false, enabled = !isSaving, onClick = onDismiss)
        }
    }
}

@Composable
private fun IdeaBoardCaseDialog(
    onDismiss: () -> Unit,
    wide: Boolean,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(IdeasBoardColors.Overlay)
                .clickable(onClick = onDismiss)
                .padding(horizontal = 20.dp, vertical = 24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = if (wide) 860.dp else 540.dp)
                    .fillMaxWidth()
                    .shadow(24.dp)
                    .background(IdeasBoardColors.CardPaper)
                    .border(1.dp, IdeasBoardColors.OuterBg)
                    .drawBehind {
                        val inset = 6.dp.toPx()
                        drawRect(
                            color = IdeasBoardColors.ModalFrame,
                            topLeft = Offset(inset, inset),
                            size = androidx.compose.ui.geometry.Size(
                                size.width - inset * 2,
                                size.height - inset * 2,
                            ),
                            style = Stroke(width = 1.dp.toPx()),
                        )
                    }
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = {},
                    )
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 24.dp),
                content = content,
            )
        }
    }
}

@Composable
private fun IdeaNoteLine(label: String, value: String) {
    Text(
        text = "$label: $value",
        color = IdeasBoardColors.OuterBg,
        fontFamily = IdeasBoardFonts.Body,
        fontSize = 14.sp,
        lineHeight = 22.sp,
        modifier = Modifier.padding(bottom = 4.dp),
    )
}

@Composable
private fun IdeaComposeField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    singleLine: Boolean = false,
    minLines: Int = 1,
    enabled: Boolean,
) {
    val shape = RoundedCornerShape(0.dp)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        singleLine = singleLine,
        textStyle = TextStyle(
            color = IdeasBoardColors.OuterBg,
            fontFamily = IdeasBoardFonts.Body,
            fontSize = 14.sp,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp)
            .heightIn(min = if (minLines > 1) 120.dp else 40.dp)
            .background(IdeasBoardColors.InputBg, shape)
            .border(1.dp, IdeasBoardColors.OuterBg, shape)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        decorationBox = { inner ->
            Box {
                if (value.isEmpty()) {
                    Text(placeholder, color = IdeasBoardColors.MutedBrown.copy(alpha = 0.6f), fontFamily = IdeasBoardFonts.Body, fontSize = 14.sp)
                }
                inner()
            }
        },
    )
}

private fun computeGridLayout(
    width: androidx.compose.ui.unit.Dp,
    height: androidx.compose.ui.unit.Dp,
): IdeasBoardGridLayout {
    val gapX = IdeasBoardDimens.GridGapX
    val gapY = IdeasBoardDimens.GridGapY
    val minCard = IdeasBoardDimens.MinCardWidth
    val cols = ((width + gapX) / (minCard + gapX)).toInt().coerceIn(1, 4)
    val estHeight = 150.dp
    val rowsByHeight = ((height + gapY) / (estHeight + gapY)).toInt()
    val rows = when {
        height >= 260.dp -> maxOf(2, min(3, rowsByHeight))
        else -> maxOf(1, min(3, rowsByHeight))
    }
    val rawMaxHeight = maxOf(120.dp, (height - gapY * (rows - 1)) / rows - 12.dp)
    val cardMaxHeight = minOf(IdeasBoardDimens.MaxCardHeight, rawMaxHeight)
    return IdeasBoardGridLayout(cols, rows, cardMaxHeight)
}

private fun truncate(value: String, max: Int): String {
    if (value.length <= max) return value
    return value.take(max - 1) + "…"
}

private fun formatDate(raw: String?): String {
    if (raw.isNullOrBlank()) return ""
    return runCatching {
        DateFormatter.format(Instant.parse(raw).atZone(ZoneId.systemDefault()))
    }.getOrDefault("")
}
