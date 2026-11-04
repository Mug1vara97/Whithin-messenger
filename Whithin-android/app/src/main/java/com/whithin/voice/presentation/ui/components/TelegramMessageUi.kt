package com.whithin.voice.presentation.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import kotlin.math.max
import kotlin.math.min

/**
 * Layout limits and radii aligned with common messenger patterns (e.g. Telegram):
 * bubble width capped relative to screen, tall media height-capped while preserving aspect ratio.
 */
object TelegramMessageUi {
    val ChatBackground: Color
        @Composable get() = MaterialTheme.colorScheme.background

    val ChatHeaderBackground: Color
        @Composable get() = LocalAppThemePreset.current.serverListBackground

    /** Капсулы ввода и панели — поверхность чуть темнее/контрастнее фона чата. */
    val InputBackground: Color
        @Composable get() = MaterialTheme.colorScheme.surface

    val AccentBlue: Color
        @Composable get() = MaterialTheme.colorScheme.primary

    val OwnBubbleStart: Color
        @Composable get() = MaterialTheme.colorScheme.primary

    val OwnBubbleEnd: Color
        @Composable get() = lerp(MaterialTheme.colorScheme.primary, Color.Black, 0.18f)

    val PeerBubbleStart: Color
        @Composable get() = MaterialTheme.colorScheme.surface

    val PeerBubbleEnd: Color
        @Composable get() = LocalAppThemePreset.current.serverListBackground

    val MediaCornerRadius = 12.dp
    val CaptionCornerRadius = 12.dp
    val BubbleCornerRadius = 16.dp
    val BubbleTailRadius = 4.dp
    val GroupedMessageGap = 2.dp
    val UngroupedMessageGap = 8.dp
    val PeerAvatarSize = 32.dp
    /** Max width as a fraction of screen width (Telegram uses roughly 72–78%). */
    const val BubbleMaxWidthFraction = 0.78f
    /** Absolute ceiling so tablets do not use overly wide bubbles. */
    val BubbleMaxWidthCeiling = 300.dp
    /** Minimum media width — keeps room for the time / duration badge (Telegram: time width + 22dp). */
    val MediaMinWidth = 100.dp
    /** Gap between album cells. */
    val AlbumCellGap = 2.dp
    /** Inner radius used where an album cell touches a neighbour. */
    val AlbumInnerRadius = 3.dp
}

@Composable
fun rememberTelegramBubbleMaxWidth(): Dp {
    val screenDp = LocalConfiguration.current.screenWidthDp.dp
    return remember(screenDp) {
        min(
            TelegramMessageUi.BubbleMaxWidthCeiling.value,
            screenDp.value * TelegramMessageUi.BubbleMaxWidthFraction
        ).dp
    }
}

/**
 * Single photo / video size, ported from Telegram's `ChatMessageCell` (TYPE_PHOTO / TYPE_VIDEO):
 *
 * - landscape (w >= h): `photoWidth = availableWidth`
 * - portrait: `photoWidth = screenWidth * 0.7` (capped by availableWidth)
 * - `photoHeight = photoWidth + 100dp`
 * - scale by width; if taller than photoHeight → shrink by height;
 *   if shorter than 120dp → stretch to 120dp (cropping when needed)
 * - unknown size → 150dp square placeholder (Telegram) — we use a 4:3 card instead so the
 *   first-load jump is smaller
 * - width never below [minWidth] (room for the time / duration badge)
 */
fun telegramPhotoSizeDp(
    intrinsicW: Int,
    intrinsicH: Int,
    maxWidth: Dp,
    screenWidth: Dp,
    minWidth: Dp = TelegramMessageUi.MediaMinWidth,
): Pair<Dp, Dp> {
    val available = maxWidth.value
    if (intrinsicW <= 0 || intrinsicH <= 0) {
        val w = available
        val h = (w * 0.75f).coerceAtMost(available + 100f)
        return w.dp to h.dp
    }

    val photoWidth =
        if (intrinsicW >= intrinsicH) {
            available
        } else {
            min(screenWidth.value * 0.7f, available)
        }
    val photoHeight = photoWidth + 100f
    val minHeightDp = 120f

    val scale = intrinsicW / photoWidth
    var w = photoWidth
    var h = intrinsicH / scale
    if (h > photoHeight) {
        val scale2 = h / photoHeight
        h = photoHeight
        w /= scale2
    } else if (h < minHeightDp) {
        h = minHeightDp
        val hScale = intrinsicH / h
        if (intrinsicW / hScale < photoWidth) {
            w = intrinsicW / hScale
        }
    }
    if (w < minWidth.value) w = minWidth.value
    w = min(w, available)
    return w.dp to h.dp
}

/** Album max height: Telegram uses `max(parentWidth, displayHeight) * 0.5`. */
@Composable
fun rememberTelegramAlbumMaxHeight(): Dp {
    val cfg = LocalConfiguration.current
    return remember(cfg.screenWidthDp, cfg.screenHeightDp) {
        (max(cfg.screenWidthDp, cfg.screenHeightDp) * 0.5f).dp
    }
}
