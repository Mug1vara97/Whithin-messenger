package com.whithin.voice.presentation.ui.components

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Свайп вправо с любой точки — как раньше / как в Telegram.
 * Слушает Main pass после детей: вертикальный скролл LazyColumn не перехватываем.
 */
@Composable
fun SwipeBackContainer(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    dismissFraction: Float = 0.25f,
    underlay: @Composable () -> Unit = {},
    content: @Composable BoxScope.() -> Unit,
) {
    val density = LocalDensity.current
    val configuration = LocalConfiguration.current
    val viewConfiguration = LocalViewConfiguration.current
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val touchSlop = viewConfiguration.touchSlop
    val screenWidthPx = with(density) { configuration.screenWidthDp.dp.toPx() }
    val scope = rememberCoroutineScope()
    var dragOffset by remember { mutableFloatStateOf(0f) }

    val swipeModifier =
        Modifier.pointerInput(enabled, screenWidthPx, touchSlop) {
            if (!enabled) return@pointerInput

            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Main)

                var accepted = false
                var keyboardDismissed = false
                var totalDx = 0f
                var totalDy = 0f

                fun dismissKeyboardForSwipe() {
                    if (keyboardDismissed) return
                    keyboardDismissed = true
                    focusManager.clearFocus()
                    keyboardController?.hide()
                }

                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Main)
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break

                    if (!accepted && change.isConsumed) {
                        return@awaitEachGesture
                    }

                    if (!change.pressed) {
                        if (accepted) {
                            val current = dragOffset
                            scope.launch {
                                if (current >= screenWidthPx * dismissFraction) {
                                    animate(
                                        initialValue = current,
                                        targetValue = screenWidthPx,
                                        animationSpec = tween(180),
                                    ) { value, _ -> dragOffset = value }
                                    dragOffset = 0f
                                    onBack()
                                } else {
                                    animate(
                                        initialValue = current,
                                        targetValue = 0f,
                                        animationSpec = tween(220),
                                    ) { value, _ -> dragOffset = value }
                                }
                            }
                        }
                        break
                    }

                    val delta = change.positionChange()
                    if (!accepted) {
                        totalDx += delta.x
                        totalDy += delta.y
                        if (abs(totalDx) > touchSlop || abs(totalDy) > touchSlop) {
                            if (totalDx <= 0f || abs(totalDy) >= abs(totalDx)) {
                                return@awaitEachGesture
                            }
                            accepted = true
                            dismissKeyboardForSwipe()
                            dragOffset = totalDx.coerceAtLeast(0f)
                            change.consume()
                        }
                    } else {
                        dragOffset = (dragOffset + delta.x).coerceIn(0f, screenWidthPx)
                        change.consume()
                    }
                }
            }
        }

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .then(if (enabled) swipeModifier else Modifier),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            underlay()
        }

        val isDragging = dragOffset > 0f
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .offset { IntOffset(dragOffset.roundToInt(), 0) }
                    .then(
                        if (isDragging) {
                            Modifier.shadow(
                                elevation = 12.dp,
                                shape = RectangleShape,
                                clip = false,
                            )
                        } else {
                            Modifier
                        },
                    ),
        ) {
            content()
        }
    }
}
