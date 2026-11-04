package com.whithin.voice.presentation.ui.components

import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Reply
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Свайп‑ответ как в Telegram (`ChatActivity.processTouchEvent` + `drawReplyButton`):
 *
 * - один трекер на весь список, а не `SwipeToDismissBox` с собственным
 *   `AnchoredDraggableState` в каждой строке;
 * - горизонтальный жест начинается только когда список не скроллится,
 *   сдвиг ≥ ~0.4 см и |dx| / 3 > dy;
 * - сдвиг ограничен 80dp, порог ответа 50dp с одиночным хаптиком;
 * - после отпускания строка возвращается за 180 мс с decelerate;
 * - индикатор рисуется поверх списка одним `drawWithContent`: появляется
 *   после 20dp, дуга прогресса на следующих 30dp, заливка после порога.
 *
 * Строка читает смещение только в `graphicsLayer` — без рекомпозиций.
 */
@Stable
class ChatSwipeReplyState internal constructor(
    density: Density,
    private val scope: CoroutineScope,
    private val listState: LazyListState,
    private val haptics: View?,
) {
    internal val maxOffsetPx = with(density) { 80.dp.toPx() }
    internal val replyThresholdPx = with(density) { 50.dp.toPx() }
    internal val indicatorShowPx = with(density) { 20.dp.toPx() }
    internal val indicatorFillPx = with(density) { 30.dp.toPx() }
    internal val startSlopPx = with(density) { 15.dp.toPx() }
    internal val indicatorRadiusPx = with(density) { 16.dp.toPx() }
    internal val indicatorStrokePx = with(density) { 1.5.dp.toPx() }
    internal val iconSizePx = with(density) { 18.dp.toPx() }

    /** Ключ строки, которая сейчас сдвинута (или возвращается на место). */
    var activeKey: String? by mutableStateOf(null)
        private set

    /** Строка под пальцем — «своё» сообщение (иконка идёт медленнее, как в Telegram). */
    internal var activeIsOwn: Boolean = false

    internal val offset = Animatable(0f)

    internal var listCoordinates: LayoutCoordinates? = null
    internal var activeRowCoordinates: LayoutCoordinates? = null

    private var settleJob: Job? = null
    private var hapticFired = false
    private var activeOnReply: (() -> Unit)? = null

    internal val isListScrolling: Boolean
        get() = listState.isScrollInProgress

    internal val isSettling: Boolean
        get() = settleJob?.isActive == true

    internal fun begin(key: String, isOwn: Boolean, rowCoordinates: LayoutCoordinates?, onReply: () -> Unit) {
        settleJob?.cancel()
        settleJob = null
        hapticFired = false
        activeIsOwn = isOwn
        activeRowCoordinates = rowCoordinates
        activeOnReply = onReply
        activeKey = key
        scope.launch { offset.snapTo(0f) }
    }

    internal fun drag(dx: Float) {
        val clamped = max(-maxOffsetPx, min(0f, dx))
        if (abs(clamped) >= replyThresholdPx) {
            if (!hapticFired) {
                hapticFired = true
                haptics?.performHapticFeedback(
                    HapticFeedbackConstants.KEYBOARD_TAP,
                    HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING,
                )
            }
        } else {
            hapticFired = false
        }
        scope.launch { offset.snapTo(clamped) }
    }

    internal fun release(cancelled: Boolean) {
        val key = activeKey ?: return
        val shouldReply = !cancelled && abs(offset.value) >= replyThresholdPx
        val onReply = activeOnReply
        settleJob =
            scope.launch {
                if (shouldReply) onReply?.invoke()
                offset.animateTo(
                    targetValue = 0f,
                    animationSpec = tween(durationMillis = 180, easing = LinearOutSlowInEasing),
                )
                if (activeKey == key) {
                    activeKey = null
                    activeRowCoordinates = null
                    activeOnReply = null
                }
            }
    }

    internal fun translationFor(key: String): Float =
        if (activeKey == key) offset.value else 0f
}

@Composable
fun rememberChatSwipeReplyState(listState: LazyListState): ChatSwipeReplyState {
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val view = LocalView.current
    return remember(listState, density) {
        ChatSwipeReplyState(density, scope, listState, view)
    }
}

/**
 * Вешается на корневой Box вокруг LazyColumn: запоминает координаты списка
 * и рисует индикатор ответа поверх контента.
 */
@Composable
fun Modifier.chatSwipeReplyOverlay(
    state: ChatSwipeReplyState,
    accent: Color = TelegramMessageUi.AccentBlue,
    onSurface: Color = Color.White,
): Modifier {
    val painter = rememberVectorPainter(Icons.Default.Reply)
    return this
        .onGloballyPositioned { state.listCoordinates = it }
        .drawWithContent {
            drawContent()
            drawReplyIndicator(state, painter, accent, onSurface)
        }
}

private fun DrawScope.drawReplyIndicator(
    state: ChatSwipeReplyState,
    painter: Painter,
    accent: Color,
    onSurface: Color,
) {
    state.activeKey ?: return
    val tx = state.offset.value
    if (tx >= 0f) return
    val listCoords = state.listCoordinates ?: return
    val rowCoords = state.activeRowCoordinates?.takeIf { it.isAttached } ?: return

    val visibility = ((-tx - state.indicatorShowPx) / (state.indicatorShowPx * 0.6f)).coerceIn(0f, 1f)
    if (visibility <= 0f) return
    val progress = ((-tx - state.indicatorShowPx) / state.indicatorFillPx).coerceIn(0f, 1f)
    val filled = progress >= 1f

    val rowCenter = listCoords.localPositionOf(rowCoords, Offset(0f, rowCoords.size.height / 2f))
    val cx = size.width + tx * (if (state.activeIsOwn) 0.5f else 1f)
    val cy = rowCenter.y
    val radius = state.indicatorRadiusPx * visibility

    if (filled) {
        drawCircle(color = accent, radius = radius, center = Offset(cx, cy))
    } else {
        drawCircle(
            color = accent.copy(alpha = 0.18f * visibility),
            radius = radius,
            center = Offset(cx, cy),
        )
        drawArc(
            color = accent.copy(alpha = visibility),
            startAngle = -90f,
            sweepAngle = 360f * progress,
            useCenter = false,
            topLeft = Offset(cx - radius, cy - radius),
            size = Size(radius * 2, radius * 2),
            style = Stroke(width = state.indicatorStrokePx),
        )
    }

    val iconSize = state.iconSizePx * visibility
    val iconTint = if (filled) onSurface else accent
    withTransform({ translate(cx - iconSize / 2f, cy - iconSize / 2f) }) {
        with(painter) {
            draw(
                size = Size(iconSize, iconSize),
                colorFilter = ColorFilter.tint(iconTint.copy(alpha = iconTint.alpha * visibility)),
            )
        }
    }
}

/**
 * Модификатор строки сообщения: жест свайпа + сдвиг содержимого.
 * Жест обрабатывается в [PointerEventPass.Initial], поэтому, как только он
 * распознан как горизонтальный, вертикальный скролл LazyColumn и long‑press
 * строки отменяются (аналог `ACTION_CANCEL` + `setCanScrollVertically(false)`).
 */
@Composable
fun Modifier.chatSwipeReplyRow(
    state: ChatSwipeReplyState,
    key: String,
    isOwn: Boolean,
    enabled: Boolean,
    onReply: () -> Unit,
): Modifier {
    val touchSlop = LocalViewConfiguration.current.touchSlop
    // Обычный holder, не MutableState: координаты обновляются каждый кадр скролла,
    // и лишние snapshot-записи тут ни к чему.
    val coordinatesHolder = remember(key) { RowCoordinatesHolder() }
    val base =
        this
            .onGloballyPositioned { coordinatesHolder.value = it }
            .graphicsLayer { translationX = state.translationFor(key) }
    if (!enabled) return base
    return base.pointerInput(state, key, onReply) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            if (state.isSettling) return@awaitEachGesture
            val pointerId = down.id
            var startX = down.position.x
            val startY = down.position.y
            var tracking = false
            var cancelled = false

            while (true) {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                val change = event.changes.firstOrNull { it.id == pointerId }
                if (change == null) {
                    cancelled = true
                    break
                }
                if (!change.pressed) break

                val dx = change.position.x - startX
                val dy = abs(change.position.y - startY)
                if (!tracking) {
                    // Вертикальное намерение — отдаём жест списку.
                    if (dy > touchSlop && abs(dx) < dy) break
                    if (change.isConsumed) break
                    if (!state.isListScrolling && dx <= -state.startSlopPx && abs(dx) / 3f > dy) {
                        tracking = true
                        startX = change.position.x
                        state.begin(key, isOwn, coordinatesHolder.value, onReply)
                        change.consume()
                    }
                    continue
                }

                change.consume()
                state.drag(change.position.x - startX)
            }

            if (tracking) state.release(cancelled = cancelled)
        }
    }
}

internal class RowCoordinatesHolder {
    var value: LayoutCoordinates? = null
}

/**
 * Совместимая обёртка для прежнего API. Теперь это просто Box: сам жест и сдвиг
 * задаются [chatSwipeReplyRow], индикатор — [chatSwipeReplyOverlay].
 */
@Composable
fun MessageRowSwipeReplyContainer(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier = modifier.fillMaxWidth()) {
        content()
    }
}
