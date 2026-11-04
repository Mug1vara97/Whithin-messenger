package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.view.ViewGroup
import android.view.Window
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsIgnoringVisibility
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsIgnoringVisibility
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SaveAlt
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.lerp
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.lerp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.whithin.voice.presentation.ui.media.MediaAspectCache
import com.whithin.voice.presentation.ui.media.MediaThumbnailBounds
import com.whithin.voice.presentation.ui.media.MediaViewerItem
import com.whithin.voice.presentation.ui.media.MediaViewerState
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import com.whithin.voice.presentation.ui.theme.updateWhithinSystemBars
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.coroutines.coroutineContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Telegram PhotoViewer constants.
private const val MAX_SCALE = 3f
private const val DOUBLE_TAP_SCALE = 3f
private const val PINCH_OVERSHOOT_MIN = 0.7f
private const val PINCH_OVERSHOOT_MAX = 3.6f
private const val DOUBLE_TAP_TIMEOUT_MS = 250L
private const val OPEN_DURATION_MS = 230
private const val CLOSE_DURATION_MS = 220
private const val DISMISS_VELOCITY = 1800f

private enum class ViewerPhase { Opening, Open, Closing }

/** Per-page zoom/pan state shared with the overlay so close animations start from what is on screen. */
@Stable
internal class ViewerPageState {
    val scale = Animatable(1f)
    val offset = Animatable(Offset.Zero, Offset.VectorConverter)
    var aspect by mutableFloatStateOf(0f)
    var container by mutableStateOf(IntSize.Zero)

    fun fitSize(): Size {
        val w = container.width.toFloat()
        val h = container.height.toFloat()
        if (w <= 0f || h <= 0f) return Size.Zero
        val a = if (aspect > 0f) aspect else w / h
        return if (w / h > a) Size(h * a, h) else Size(w, w / a)
    }

    fun fitRect(): Rect {
        val size = fitSize()
        val cx = container.width / 2f
        val cy = container.height / 2f
        return Rect(cx - size.width / 2f, cy - size.height / 2f, cx + size.width / 2f, cy + size.height / 2f)
    }

    /** Fit rect transformed by current zoom/pan. */
    fun visibleRect(): Rect {
        val fit = fitRect()
        val s = scale.value
        val o = offset.value
        val cx = container.width / 2f + o.x
        val cy = container.height / 2f + o.y
        val hw = fit.width * s / 2f
        val hh = fit.height * s / 2f
        return Rect(cx - hw, cy - hh, cx + hw, cy + hh)
    }

    fun maxOffset(forScale: Float = scale.value): Offset {
        val fit = fitSize()
        return Offset(
            max(0f, (fit.width * forScale - container.width) / 2f),
            max(0f, (fit.height * forScale - container.height) / 2f),
        )
    }

    fun clampOffset(value: Offset, forScale: Float = scale.value): Offset {
        val m = maxOffset(forScale)
        return Offset(value.x.coerceIn(-m.x, m.x), value.y.coerceIn(-m.y, m.y))
    }
}

/** Overlay-wide drag-to-dismiss state (Telegram: translate + shrink + fade background). */
@Stable
private class DismissState {
    val offset = Animatable(Offset.Zero, Offset.VectorConverter)
    var dragging by mutableStateOf(false)
    var containerHeight = 1f

    val fraction: Float get() = min(1f, abs(offset.value.y) / (containerHeight / 2f))
    val scale: Float get() = 1f - 0.25f * fraction
    val backgroundAlpha: Float get() = max(0.5f, 1f - fraction)
}

@OptIn(ExperimentalFoundationApi::class, ExperimentalLayoutApi::class, UnstableApi::class)
@Composable
fun MediaViewerOverlay(
    state: MediaViewerState,
    onDismiss: () -> Unit,
    onSaveToGallery: (MediaViewerItem) -> Unit,
    onDownload: (MediaViewerItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (state.items.isEmpty()) return

    val context = LocalContext.current
    val density = LocalDensity.current
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val themePreset = LocalAppThemePreset.current
    remember(context) { MediaAspectCache.ensureLoaded(context); Unit }

    // Как Telegram PhotoViewer: медиа edge-to-edge под прозрачными барами,
    // а action bar / seek pad'ятся IgnoringVisibility — иначе после hide() insets = 0
    // и крестик/таймлайн залезают в шапку/вырез.
    DisposableEffect(view, themePreset) {
        val activity = view.context.findActivity() as? ComponentActivity
        val window = activity?.window
        val controller = window?.let { WindowInsetsControllerCompat(it, view) }
        if (window != null) {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            window.statusBarColor = android.graphics.Color.TRANSPARENT
            window.navigationBarColor = android.graphics.Color.TRANSPARENT
            controller?.isAppearanceLightStatusBars = false
            controller?.isAppearanceLightNavigationBars = false
            controller?.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            // Прозрачные бары остаются «видимыми» — иначе statusBarsPadding даёт 0 и
            // chrome залезает в вырез/шапку телефона (Telegram ActionBar + statusBarHeight).
            controller?.show(WindowInsetsCompat.Type.systemBars())
        }
        onDispose {
            if (activity != null && !activity.isFinishing && !activity.isDestroyed) {
                activity.updateWhithinSystemBars(themePreset)
                WindowCompat.setDecorFitsSystemWindows(activity.window, false)
                WindowCompat.getInsetsController(activity.window, view)
                    .show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    val pagerState =
        rememberPagerState(
            initialPage = state.initialIndex.coerceIn(0, state.items.lastIndex),
            pageCount = { state.items.size },
        )
    val currentItem = state.items[pagerState.currentPage]

    var menuExpanded by remember { mutableStateOf(false) }
    var chromeVisible by remember { mutableStateOf(true) }
    var captionExpanded by remember(pagerState.currentPage) { mutableStateOf(false) }
    var videoPlaying by remember { mutableStateOf(false) }

    LaunchedEffect(chromeVisible, videoPlaying, pagerState.currentPage) {
        if (chromeVisible && videoPlaying) {
            delay(3500)
            chromeVisible = false
        }
    }

    var phase by remember { mutableStateOf(ViewerPhase.Opening) }
    val transition = remember { Animatable(0f) }
    var overlayOrigin by remember { mutableStateOf(Offset.Zero) }
    var overlaySize by remember { mutableStateOf(IntSize.Zero) }
    val dismiss = remember { DismissState() }
    val pageStates = remember { HashMap<Int, ViewerPageState>() }

    // Rects (overlay-local) for the open/close animation.
    var transitionFrom by remember { mutableStateOf<Rect?>(null) }
    var transitionTo by remember { mutableStateOf<Rect?>(null) }
    var transitionItem by remember { mutableStateOf(currentItem) }
    var transitionFade by remember { mutableStateOf(false) }

    fun itemAspect(item: MediaViewerItem): Float {
        val size = MediaAspectCache.get(item.url) ?: MediaAspectCache.get(item.thumbnailUrl)
        return if (size != null && size.width > 0 && size.height > 0) size.width.toFloat() / size.height else 0f
    }

    fun fullscreenFitRect(aspect: Float, fallback: Rect?): Rect {
        val w = overlaySize.width.toFloat()
        val h = overlaySize.height.toFloat()
        if (w <= 0f || h <= 0f) return Rect.Zero
        val a =
            when {
                aspect > 0f -> aspect
                fallback != null && fallback.height > 0f -> fallback.width / fallback.height
                else -> w / h
            }
        val size = if (w / h > a) Size(h * a, h) else Size(w, w / a)
        return Rect(Offset((w - size.width) / 2f, (h - size.height) / 2f), size)
    }

    fun thumbnailRectFor(item: MediaViewerItem): Rect? {
        val window = MediaThumbnailBounds.get(item.url) ?: return null
        val local = window.translate(-overlayOrigin)
        val bounds = Rect(Offset.Zero, Size(overlaySize.width.toFloat(), overlaySize.height.toFloat()))
        if (local.width < 4f || local.height < 4f) return null
        if (!local.overlaps(bounds)) return null
        return local
    }

    // Open animation — runs once the overlay knows its size.
    LaunchedEffect(overlaySize) {
        if (phase != ViewerPhase.Opening || overlaySize.width == 0 || transition.isRunning) return@LaunchedEffect
        val item = state.items[pagerState.currentPage]
        val from = thumbnailRectFor(item)
        transitionItem = item
        transitionFade = from == null
        transitionFrom = from ?: fullscreenFitRect(itemAspect(item), null).let { r ->
            // Fallback: scale up from the centre.
            val c = r.center
            Rect(c - Offset(r.width * 0.4f, r.height * 0.4f), Size(r.width * 0.8f, r.height * 0.8f))
        }
        transitionTo = fullscreenFitRect(itemAspect(item), from)
        transition.snapTo(0f)
        transition.animateTo(1f, tween(OPEN_DURATION_MS, easing = FastOutSlowInEasing))
        phase = ViewerPhase.Open
    }

    val closing = remember { arrayOf(false) }
    fun requestClose() {
        if (closing[0]) return
        closing[0] = true
        scope.launch {
            val page = pagerState.currentPage
            val item = state.items[page]
            val pageState = pageStates[page]
            // What is visible right now, including zoom/pan and the dismiss drag.
            val visible =
                pageState?.visibleRect()?.takeIf { it.width > 0f }
                    ?: fullscreenFitRect(itemAspect(item), null)
            val d = dismiss.offset.value
            val ds = dismiss.scale
            val center = Offset(overlaySize.width / 2f, overlaySize.height / 2f)
            val fromCenter = (visible.center - center) * ds + center + d
            val from = Rect(fromCenter - Offset(visible.width * ds / 2f, visible.height * ds / 2f), Size(visible.width * ds, visible.height * ds))
            val to = thumbnailRectFor(item)
            transitionItem = item
            transitionFade = to == null
            transitionFrom = from
            transitionTo =
                to ?: Rect(
                    from.center - Offset(from.width * 0.35f, from.height * 0.35f),
                    Size(from.width * 0.7f, from.height * 0.7f),
                )
            phase = ViewerPhase.Closing
            transition.snapTo(1f)
            transition.animateTo(0f, tween(CLOSE_DURATION_MS, easing = FastOutSlowInEasing))
            onDismiss()
        }
    }

    BackHandler { requestClose() }

    val chromeAlpha by
        animateFloatAsState(
            targetValue = if (chromeVisible && !dismiss.dragging && phase == ViewerPhase.Open) 1f else 0f,
            animationSpec = tween(180),
            label = "viewerChrome",
        )
    val backgroundAlpha =
        when (phase) {
            ViewerPhase.Opening -> transition.value
            ViewerPhase.Open -> dismiss.backgroundAlpha
            ViewerPhase.Closing -> transition.value * dismiss.backgroundAlpha
        }
    val pageInputEnabled = phase == ViewerPhase.Open

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .onGloballyPositioned { coords ->
                    val b = coords.boundsInWindow()
                    overlayOrigin = Offset(b.left, b.top)
                }
                .onSizeChanged {
                    overlaySize = it
                    dismiss.containerHeight = it.height.toFloat().coerceAtLeast(1f)
                }
                .drawBehind { drawRect(Color.Black.copy(alpha = backgroundAlpha.coerceIn(0f, 1f))) }
                // Swallow touches so nothing underneath reacts.
                .pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Final) } },
    ) {
        HorizontalPager(
            state = pagerState,
            beyondViewportPageCount = 1,
            userScrollEnabled = pageInputEnabled && (pageStates[pagerState.currentPage]?.scale?.value ?: 1f) <= 1.01f,
            modifier =
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        alpha = if (phase == ViewerPhase.Open) 1f else 0f
                        val s = dismiss.scale
                        scaleX = s
                        scaleY = s
                        translationX = dismiss.offset.value.x
                        translationY = dismiss.offset.value.y
                    },
        ) { page ->
            val item = state.items[page]
            val pageState = remember(item.url) { ViewerPageState().also { it.aspect = itemAspect(item) } }
            DisposableEffect(page, pageState) {
                pageStates[page] = pageState
                onDispose { if (pageStates[page] === pageState) pageStates.remove(page) }
            }
            val isCurrent = pagerState.currentPage == page
            // Reset zoom when the page scrolls away.
            LaunchedEffect(isCurrent) {
                if (!isCurrent && pageState.scale.value != 1f) {
                    pageState.scale.snapTo(1f)
                    pageState.offset.snapTo(Offset.Zero)
                }
            }
            if (item.isVideo) {
                MediaViewerVideoPage(
                    item = item,
                    pageState = pageState,
                    isActive = isCurrent && phase == ViewerPhase.Open,
                    inputEnabled = pageInputEnabled && isCurrent,
                    chromeVisible = chromeVisible,
                    chromeAlpha = chromeAlpha,
                    dismiss = dismiss,
                    onTap = { chromeVisible = !chromeVisible },
                    onPlayingChange = { playing -> if (isCurrent) videoPlaying = playing },
                    onDismissRequested = { requestClose() },
                )
            } else {
                MediaViewerImagePage(
                    item = item,
                    pageState = pageState,
                    inputEnabled = pageInputEnabled && isCurrent,
                    dismiss = dismiss,
                    onTap = { chromeVisible = !chromeVisible },
                    onDismissRequested = { requestClose() },
                )
            }
        }

        // Open / close transition layer (Telegram animates the crop rect from the thumbnail).
        if (phase != ViewerPhase.Open) {
            val from = transitionFrom
            val to = transitionTo
            if (from != null && to != null && overlaySize.width > 0) {
                val p = transition.value
                val rect = lerp(from, to, p)
                val cornerPx = with(density) { TelegramMessageUi.MediaCornerRadius.toPx() } * (1f - p)
                val layerAlpha = if (transitionFade) p else 1f
                Box(
                    modifier =
                        Modifier
                            .offset { IntOffset(rect.left.roundToInt(), rect.top.roundToInt()) }
                            .size(
                                with(density) { max(1f, rect.width).toDp() },
                                with(density) { max(1f, rect.height).toDp() },
                            )
                            .graphicsLayer { alpha = layerAlpha }
                            .clip(RoundedCornerShape(with(density) { cornerPx.toDp() }))
                            .background(Color(0xFF1C1C1E)),
                ) {
                    // Crop в начале (как превью в чате), ближе к Open — Fit как в PhotoViewer.
                    val scaleMode = if (p > 0.65f) ContentScale.Fit else ContentScale.Crop
                    val thumb = transitionItem.thumbnailUrl.ifBlank { if (transitionItem.isVideo) "" else transitionItem.url }
                    if (thumb.isNotBlank()) {
                        AsyncImage(
                            model = remember(thumb) { ImageRequest.Builder(context).data(thumb).crossfade(false).build() },
                            contentDescription = null,
                            contentScale = scaleMode,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    if (!transitionItem.isVideo) {
                        AsyncImage(
                            model = remember(transitionItem.url) { ImageRequest.Builder(context).data(transitionItem.url).crossfade(false).build() },
                            contentDescription = null,
                            contentScale = scaleMode,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
            }
        }

        // ---- Chrome: top bar ----
        if (chromeAlpha > 0.01f) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter)
                        .graphicsLayer { alpha = chromeAlpha }
                        .background(
                            Brush.verticalGradient(
                                0f to Color.Black.copy(alpha = 0.55f),
                                1f to Color.Transparent,
                            ),
                        )
                        .windowInsetsPadding(WindowInsets.statusBarsIgnoringVisibility),
            ) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { requestClose() }) {
                        Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Color.White)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = currentItem.senderUsername.ifBlank { "Медиа" },
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            scrambleOnce = false,
                        )
                        val dateLabel = remember(currentItem.createdAt) { formatViewerDate(currentItem.createdAt) }
                        if (dateLabel.isNotBlank()) {
                            Text(
                                text = dateLabel,
                                color = Color.White.copy(alpha = 0.7f),
                                fontSize = 13.sp,
                                scrambleOnce = false,
                            )
                        }
                    }
                    if (state.items.size > 1) {
                        Text(
                            text = "${pagerState.currentPage + 1} из ${state.items.size}",
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 14.sp,
                            modifier = Modifier.padding(end = 4.dp),
                            scrambleOnce = false,
                        )
                    }
                    IconButton(
                        onClick = {
                            shareViewerItem(context, currentItem)
                        },
                    ) {
                        Icon(Icons.Default.Share, contentDescription = "Поделиться", tint = Color.White)
                    }
                    Box {
                        IconButton(onClick = { menuExpanded = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Меню", tint = Color.White)
                        }
                        DropdownMenu(
                            expanded = menuExpanded,
                            onDismissRequest = { menuExpanded = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("Сохранить в галерею") },
                                leadingIcon = { Icon(Icons.Default.SaveAlt, contentDescription = null) },
                                onClick = {
                                    menuExpanded = false
                                    onSaveToGallery(currentItem)
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Скачать") },
                                leadingIcon = { Icon(Icons.Default.Download, contentDescription = null) },
                                onClick = {
                                    menuExpanded = false
                                    onDownload(currentItem)
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Поделиться") },
                                leadingIcon = { Icon(Icons.Default.Share, contentDescription = null) },
                                onClick = {
                                    menuExpanded = false
                                    shareViewerItem(context, currentItem)
                                },
                            )
                        }
                    }
                }
            }

            // ---- Chrome: caption ----
            if (currentItem.caption.isNotBlank()) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .graphicsLayer { alpha = chromeAlpha }
                            .background(
                                Brush.verticalGradient(
                                    0f to Color.Transparent,
                                    1f to Color.Black.copy(alpha = 0.7f),
                                ),
                            )
                            .windowInsetsPadding(WindowInsets.navigationBarsIgnoringVisibility)
                            .padding(
                                start = 16.dp,
                                end = 16.dp,
                                top = 24.dp,
                                bottom = if (currentItem.isVideo) 64.dp else 16.dp,
                            )
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                            ) { captionExpanded = !captionExpanded },
                ) {
                    Text(
                        text = currentItem.caption,
                        color = Color.White,
                        fontSize = 15.sp,
                        lineHeight = 20.sp,
                        maxLines = if (captionExpanded) Int.MAX_VALUE else 3,
                        overflow = TextOverflow.Ellipsis,
                        scrambleOnce = false,
                    )
                }
            }
        }
    }
}

/**
 * Telegram-like gesture handling for a viewer page:
 * pinch zoom (1x–3x with rubber-band overshoot), pan while zoomed, double-tap zoom to 3x at
 * the tap point, single tap toggles chrome, vertical drag at 1x dismisses (threshold: height/6
 * or a fast fling).
 */
private fun Modifier.viewerPageGestures(
    pageState: ViewerPageState,
    dismiss: DismissState,
    enabled: Boolean,
    zoomEnabled: Boolean,
    onTap: () -> Unit,
    onDismissRequested: () -> Unit,
): Modifier =
    composed@ pointerInput(pageState, enabled, zoomEnabled) {
        if (!enabled) return@pointerInput
        val slop = viewConfiguration.touchSlop
        var lastTapTime = 0L
        var lastTapPos = Offset.Zero
        var pendingTap: Job? = null
        val scope = CoroutineScope(coroutineContext)

        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            var mode = 0 // 0 none, 1 pan, 2 dismiss, 3 zoom, 4 handed to pager
            var totalDrag = Offset.Zero
            var movedBeyondSlop = false
            val velocity = VelocityTracker()
            velocity.addPosition(down.uptimeMillis, down.position)

            while (true) {
                val event = awaitPointerEvent()
                val pressed = event.changes.filter { it.pressed }
                if (pressed.isEmpty()) break

                if (pressed.size >= 2 && zoomEnabled) {
                    mode = 3
                    movedBeyondSlop = true
                    val zoom = event.calculateZoom()
                    val pan = event.calculatePan()
                    val centroid = event.calculateCentroid()
                    val center = Offset(pageState.container.width / 2f, pageState.container.height / 2f)
                    val oldScale = pageState.scale.value
                    val newScale = (oldScale * zoom).coerceIn(PINCH_OVERSHOOT_MIN, PINCH_OVERSHOOT_MAX)
                    val effectiveZoom = newScale / oldScale
                    val o = pageState.offset.value
                    val rel = centroid - center
                    val newOffset = rel * (1f - effectiveZoom) + o * effectiveZoom + pan
                    scope.launch {
                        pageState.scale.snapTo(newScale)
                        pageState.offset.snapTo(newOffset)
                    }
                    event.changes.forEach { it.consume() }
                    continue
                }

                val change: PointerInputChange = pressed[0]
                val delta = change.positionChange()
                velocity.addPosition(change.uptimeMillis, change.position)
                totalDrag += delta

                if (mode == 3) {
                    // Second finger lifted: continue as a pan if zoomed.
                    mode = if (pageState.scale.value > 1.01f) 1 else 0
                    if (mode == 0) {
                        scope.launch { settleZoom(pageState) }
                        break
                    }
                }

                if (mode == 0 && !movedBeyondSlop && totalDrag.getDistance() > slop) {
                    movedBeyondSlop = true
                    mode =
                        when {
                            pageState.scale.value > 1.01f -> 1
                            abs(totalDrag.y) > abs(totalDrag.x) * 1.3f -> 2
                            else -> 4
                        }
                    if (mode == 2) dismiss.dragging = true
                }

                when (mode) {
                    1 -> {
                        val m = pageState.maxOffset()
                        val raw = pageState.offset.value + delta
                        // Rubber band outside bounds.
                        fun band(v: Float, limit: Float): Float =
                            if (abs(v) <= limit) v else limit * (if (v > 0) 1 else -1) + (v - limit * (if (v > 0) 1 else -1)) * 0.35f
                        val banded = Offset(band(raw.x, m.x), band(raw.y, m.y))
                        scope.launch { pageState.offset.snapTo(banded) }
                        change.consume()
                    }
                    2 -> {
                        val next = dismiss.offset.value + delta
                        scope.launch { dismiss.offset.snapTo(next) }
                        change.consume()
                    }
                    else -> Unit
                }
            }

            // Release
            when (mode) {
                0 -> {
                    if (!movedBeyondSlop) {
                        val now = System.currentTimeMillis()
                        val pos = down.position
                        if (now - lastTapTime < DOUBLE_TAP_TIMEOUT_MS && (pos - lastTapPos).getDistance() < slop * 4) {
                            pendingTap?.cancel()
                            pendingTap = null
                            lastTapTime = 0L
                            if (zoomEnabled) scope.launch { toggleDoubleTapZoom(pageState, pos) }
                        } else {
                            lastTapTime = now
                            lastTapPos = pos
                            pendingTap?.cancel()
                            pendingTap =
                                scope.launch {
                                    delay(DOUBLE_TAP_TIMEOUT_MS)
                                    onTap()
                                }
                        }
                    }
                }
                1, 3 -> scope.launch { settleZoom(pageState) }
                2 -> {
                    dismiss.dragging = false
                    val v = velocity.calculateVelocity()
                    val dy = dismiss.offset.value.y
                    val threshold = dismiss.containerHeight / 6f
                    if (abs(dy) > threshold || abs(v.y) > DISMISS_VELOCITY) {
                        onDismissRequested()
                    } else {
                        scope.launch {
                            dismiss.offset.animateTo(Offset.Zero, spring(stiffness = Spring.StiffnessMediumLow))
                        }
                    }
                }
                else -> Unit
            }
        }
    }

private suspend fun settleZoom(pageState: ViewerPageState) {
    val target = pageState.scale.value.coerceIn(1f, MAX_SCALE)
    val targetOffset = if (target <= 1f) Offset.Zero else pageState.clampOffset(pageState.offset.value, target)
    kotlinx.coroutines.coroutineScope {
        launch { pageState.scale.animateTo(target, spring(stiffness = Spring.StiffnessMedium)) }
        launch { pageState.offset.animateTo(targetOffset, spring(stiffness = Spring.StiffnessMedium)) }
    }
}

private suspend fun toggleDoubleTapZoom(pageState: ViewerPageState, tap: Offset) {
    val center = Offset(pageState.container.width / 2f, pageState.container.height / 2f)
    kotlinx.coroutines.coroutineScope {
        if (pageState.scale.value > 1.01f) {
            launch { pageState.scale.animateTo(1f, tween(220, easing = LinearOutSlowInEasing)) }
            launch { pageState.offset.animateTo(Offset.Zero, tween(220, easing = LinearOutSlowInEasing)) }
        } else {
            val target = DOUBLE_TAP_SCALE
            val rel = tap - center
            val desired = rel * (1f - target)
            val clamped = pageState.clampOffset(desired, target)
            launch { pageState.scale.animateTo(target, tween(220, easing = LinearOutSlowInEasing)) }
            launch { pageState.offset.animateTo(clamped, tween(220, easing = LinearOutSlowInEasing)) }
        }
    }
}

@Composable
private fun MediaViewerImagePage(
    item: MediaViewerItem,
    pageState: ViewerPageState,
    inputEnabled: Boolean,
    dismiss: DismissState,
    onTap: () -> Unit,
    onDismissRequested: () -> Unit,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    var fullLoaded by remember(item.url) { mutableStateOf(false) }
    var failed by remember(item.url) { mutableStateOf(false) }

    val fullRequest =
        remember(item.url) {
            ImageRequest.Builder(context)
                .data(item.url)
                .crossfade(false)
                .listener(
                    onSuccess = { _, result ->
                        val d = result.drawable
                        if (d.intrinsicWidth > 0 && d.intrinsicHeight > 0) {
                            MediaAspectCache.put(item.url, d.intrinsicWidth, d.intrinsicHeight)
                            pageState.aspect = d.intrinsicWidth.toFloat() / d.intrinsicHeight
                        }
                        fullLoaded = true
                    },
                    onError = { _, _ -> failed = true },
                )
                .build()
        }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .onSizeChanged { pageState.container = it }
                .viewerPageGestures(
                    pageState = pageState,
                    dismiss = dismiss,
                    enabled = inputEnabled,
                    zoomEnabled = true,
                    onTap = onTap,
                    onDismissRequested = onDismissRequested,
                ),
        contentAlignment = Alignment.Center,
    ) {
        val fit = pageState.fitSize()
        val fitW = with(density) { max(1f, fit.width).toDp() }
        val fitH = with(density) { max(1f, fit.height).toDp() }
        Box(
            modifier =
                Modifier
                    .size(fitW, fitH)
                    .graphicsLayer {
                        val s = pageState.scale.value
                        scaleX = s
                        scaleY = s
                        translationX = pageState.offset.value.x
                        translationY = pageState.offset.value.y
                    },
        ) {
            if (!fullLoaded && item.thumbnailUrl.isNotBlank()) {
                AsyncImage(
                    model = remember(item.thumbnailUrl) { ImageRequest.Builder(context).data(item.thumbnailUrl).crossfade(false).build() },
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            AsyncImage(
                model = fullRequest,
                contentDescription = item.fileName,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
        }
        if (!fullLoaded && !failed) {
            CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 2.5.dp,
                modifier = Modifier.size(36.dp),
            )
        }
        if (failed) {
            Text("Не удалось загрузить", color = Color.White.copy(alpha = 0.7f), scrambleOnce = false)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class, UnstableApi::class)
@Composable
private fun MediaViewerVideoPage(
    item: MediaViewerItem,
    pageState: ViewerPageState,
    isActive: Boolean,
    inputEnabled: Boolean,
    chromeVisible: Boolean,
    chromeAlpha: Float,
    dismiss: DismissState,
    onTap: () -> Unit,
    onPlayingChange: (Boolean) -> Unit = {},
    onDismissRequested: () -> Unit,
) {
    val context = LocalContext.current
    val player =
        remember(item.url) {
            ExoPlayer.Builder(context)
                .setRenderersFactory(
                    DefaultRenderersFactory(context)
                        .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER),
                )
                .build()
                .apply {
                    setMediaItem(MediaItem.fromUri(item.url))
                    prepare()
                }
        }

    var isPlaying by remember(item.url) { mutableStateOf(false) }
    var isBuffering by remember(item.url) { mutableStateOf(true) }
    var durationMs by remember(item.url) { mutableLongStateOf(0L) }
    var positionMs by remember(item.url) { mutableLongStateOf(0L) }
    var scrubbing by remember(item.url) { mutableStateOf(false) }
    var scrubValue by remember(item.url) { mutableFloatStateOf(0f) }
    var ended by remember(item.url) { mutableStateOf(false) }

    DisposableEffect(player) {
        val listener =
            object : Player.Listener {
                override fun onIsPlayingChanged(playing: Boolean) {
                    isPlaying = playing
                    onPlayingChange(playing)
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    isBuffering = playbackState == Player.STATE_BUFFERING
                    if (playbackState == Player.STATE_READY) {
                        val d = player.duration
                        if (d != C.TIME_UNSET) durationMs = d
                        ended = false
                    }
                    if (playbackState == Player.STATE_ENDED) {
                        ended = true
                        isPlaying = false
                    }
                }

                override fun onVideoSizeChanged(videoSize: androidx.media3.common.VideoSize) {
                    if (videoSize.width > 0 && videoSize.height > 0) {
                        val aspect = videoSize.width.toFloat() * videoSize.pixelWidthHeightRatio / videoSize.height
                        pageState.aspect = aspect
                        MediaAspectCache.put(item.url, videoSize.width, videoSize.height)
                    }
                }
            }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(isActive, player) {
        if (isActive) {
            player.playWhenReady = true
        } else {
            player.pause()
        }
    }

    LaunchedEffect(isPlaying, scrubbing) {
        while (isPlaying && !scrubbing) {
            positionMs = player.currentPosition
            delay(200)
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .onSizeChanged { pageState.container = it }
                .viewerPageGestures(
                    pageState = pageState,
                    dismiss = dismiss,
                    enabled = inputEnabled,
                    zoomEnabled = false,
                    onTap = onTap,
                    onDismissRequested = onDismissRequested,
                ),
        contentAlignment = Alignment.Center,
    ) {
        val density = LocalDensity.current
        // Как у фото в PhotoViewer: letterbox по aspect, не растягивать на весь экран.
        val fit = pageState.fitSize()
        val fitW = with(density) { max(1f, fit.width).toDp() }
        val fitH = with(density) { max(1f, fit.height).toDp() }
        val playerModifier =
            if (item.isVideoNote) {
                val sidePx = min(pageState.container.width, pageState.container.height).toFloat()
                val noteSize =
                    if (sidePx > 0f) with(density) { (sidePx * 0.72f).toDp() } else 280.dp
                Modifier
                    .size(noteSize)
                    .clip(CircleShape)
                    .background(Color.Black)
            } else {
                Modifier.size(fitW, fitH)
            }
        Box(modifier = playerModifier, contentAlignment = Alignment.Center) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        this.player = player
                        useController = false
                        resizeMode =
                            if (item.isVideoNote) {
                                AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                            } else {
                                AspectRatioFrameLayout.RESIZE_MODE_FIT
                            }
                        setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                        layoutParams =
                            ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT,
                            )
                    }
                },
                update = { view -> view.player = player },
                modifier = Modifier.fillMaxSize(),
            )

            // Poster until the first frame arrives.
            if (isBuffering && positionMs == 0L && item.thumbnailUrl.isNotBlank()) {
                AsyncImage(
                    model =
                        remember(item.thumbnailUrl) {
                            ImageRequest.Builder(context).data(item.thumbnailUrl).crossfade(false).build()
                        },
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        if (isBuffering) {
            CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 2.5.dp,
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .size(44.dp),
            )
        } else if (chromeVisible || !isPlaying) {
            // Big centre play/pause (Telegram shows it while paused or when chrome is visible).
            Box(
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .graphicsLayer { alpha = if (isPlaying) chromeAlpha else 1f }
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(Color(0x66000000))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) {
                            if (ended) {
                                player.seekTo(0)
                                player.play()
                            } else if (isPlaying) {
                                player.pause()
                            } else {
                                player.play()
                            }
                        },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(38.dp),
                )
            }
        }

        // Bottom seek bar.
        if (chromeAlpha > 0.01f) {
            Row(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .graphicsLayer { alpha = chromeAlpha }
                        .background(
                            Brush.verticalGradient(
                                0f to Color.Transparent,
                                1f to Color.Black.copy(alpha = 0.6f),
                            ),
                        )
                        .windowInsetsPadding(WindowInsets.navigationBarsIgnoringVisibility)
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                IconButton(
                    onClick = {
                        if (ended) {
                            player.seekTo(0)
                            player.play()
                        } else if (isPlaying) {
                            player.pause()
                        } else {
                            player.play()
                        }
                    },
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                    )
                }
                val shownPosition = if (scrubbing) (scrubValue * durationMs).toLong() else positionMs
                Text(
                    text = formatPlayerTime(shownPosition),
                    color = Color.White,
                    fontSize = 12.sp,
                    scrambleOnce = false,
                )
                Slider(
                    value =
                        if (scrubbing) {
                            scrubValue
                        } else if (durationMs > 0) {
                            (positionMs.toFloat() / durationMs).coerceIn(0f, 1f)
                        } else {
                            0f
                        },
                    onValueChange = {
                        scrubbing = true
                        scrubValue = it
                    },
                    onValueChangeFinished = {
                        if (durationMs > 0) {
                            val target = (scrubValue * durationMs).toLong()
                            player.seekTo(target)
                            positionMs = target
                        }
                        scrubbing = false
                    },
                    colors =
                        SliderDefaults.colors(
                            thumbColor = Color.White,
                            activeTrackColor = Color.White,
                            inactiveTrackColor = Color.White.copy(alpha = 0.3f),
                        ),
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatPlayerTime(durationMs),
                    color = Color.White,
                    fontSize = 12.sp,
                    scrambleOnce = false,
                )
                Spacer(modifier = Modifier.width(4.dp))
            }
        }
    }
}

private fun formatPlayerTime(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) {
        String.format(Locale.US, "%d:%02d:%02d", h, m, s)
    } else {
        String.format(Locale.US, "%d:%02d", m, s)
    }
}

private fun shareViewerItem(context: Context, item: MediaViewerItem) {
    val send =
        Intent(Intent.ACTION_SEND).apply {
            type = if (item.isVideo) "text/plain" else "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, item.fileName.ifBlank { "Whithin" })
            putExtra(
                Intent.EXTRA_TEXT,
                buildString {
                    if (item.caption.isNotBlank()) {
                        append(item.caption)
                        append('\n')
                    }
                    append(item.url)
                },
            )
        }
    context.startActivity(Intent.createChooser(send, "Поделиться"))
}

private fun Context.findActivity(): Activity? {
    var ctx: Context = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

private fun Context.findActivityWindow(): Window? = findActivity()?.window

private fun formatViewerDate(raw: String): String {
    if (raw.isBlank()) return ""
    return runCatching {
        val zdt = Instant.parse(raw).atZone(ZoneId.systemDefault())
        zdt.format(
            DateTimeFormatter.ofPattern("d MMMM yyyy 'в' HH:mm", Locale("ru")),
        )
    }.getOrDefault(raw.take(16))
}
