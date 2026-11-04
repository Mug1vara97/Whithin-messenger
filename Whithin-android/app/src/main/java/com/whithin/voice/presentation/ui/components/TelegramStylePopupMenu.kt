package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.presentation.ui.components.AppText as Text

import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

private val MenuWidthMin = 200.dp
private val MenuWidthMax = 260.dp

/** Фон попапа сообщений Telegram (тёмная тема). */
private val TelegramPopupBg = Color(0xFF1C1C1E)
private val TelegramPopupDivider = Color(0xFF2C2C2E)

data class TelegramPopupMenuEntry(
    val icon: ImageVector,
    val title: String,
    val subtitle: String? = null,
    val badge: String? = null,
    val isDanger: Boolean = false,
    val showDividerBefore: Boolean = false,
    val enabled: Boolean = true,
    val onClick: () -> Unit,
)

/**
 * Полноэкранный вариант (якорь в углу) — для шапки / списков.
 */
@Composable
fun TelegramStylePopupMenu(
    visible: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    anchor: Alignment = Alignment.TopEnd,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (!visible) return

    Dialog(
        onDismissRequest = onDismiss,
        properties =
            DialogProperties(
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.32f))
                        .clickable(onClick = onDismiss),
            )
            TelegramPopupCard(
                modifier =
                    modifier
                        .align(anchor)
                        .statusBarsPadding()
                        .padding(top = 8.dp, end = 10.dp),
                content = content,
            )
        }
    }
}

@Composable
fun TelegramStylePopupMenu(
    visible: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    anchor: Alignment = Alignment.TopEnd,
    items: List<TelegramPopupMenuEntry>,
) {
    TelegramStylePopupMenu(
        visible = visible,
        onDismiss = onDismiss,
        modifier = modifier,
        anchor = anchor,
    ) {
        TelegramPopupMenuItems(items = items, onDismiss = onDismiss)
    }
}

/**
 * Попап у сообщения — как ActionBarPopupWindow / ChatScrimPopup в Telegram:
 * тёмная карточка со скруглением, иконки справа, лёгкий scrim.
 */
@Composable
fun TelegramMessagePopupMenu(
    visible: Boolean,
    onDismiss: () -> Unit,
    items: List<TelegramPopupMenuEntry>,
    modifier: Modifier = Modifier,
) {
    if (!visible) return

    Popup(
        alignment = Alignment.TopEnd,
        offset = IntOffset(0, 0),
        onDismissRequest = onDismiss,
        properties =
            PopupProperties(
                focusable = true,
                dismissOnBackPress = true,
                dismissOnClickOutside = true,
                clippingEnabled = false,
            ),
    ) {
        TelegramPopupCard(modifier = modifier.padding(end = 8.dp, top = 4.dp)) {
            TelegramPopupMenuItems(items = items, onDismiss = onDismiss)
        }
    }
}

@Composable
private fun TelegramPopupCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier =
            modifier
                .wrapContentWidth()
                .widthIn(min = MenuWidthMin, max = MenuWidthMax)
                .shadow(18.dp, RoundedCornerShape(14.dp), clip = false),
        shape = RoundedCornerShape(14.dp),
        color = TelegramPopupBg,
        shadowElevation = 0.dp,
        tonalElevation = 0.dp,
    ) {
        Column(
            modifier =
                Modifier
                    .widthIn(min = MenuWidthMin, max = MenuWidthMax)
                    .padding(vertical = 6.dp),
            content = content,
        )
    }
}

@Composable
private fun ColumnScope.TelegramPopupMenuItems(
    items: List<TelegramPopupMenuEntry>,
    onDismiss: () -> Unit,
) {
    items.forEach { item ->
        if (item.showDividerBefore) {
            HorizontalDivider(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                color = TelegramPopupDivider,
                thickness = 0.5.dp,
            )
        }
        TelegramPopupMenuItem(
            icon = item.icon,
            title = item.title,
            subtitle = item.subtitle,
            badge = item.badge,
            isDanger = item.isDanger,
            enabled = item.enabled,
            onClick = {
                onDismiss()
                item.onClick()
            },
        )
    }
}

@Composable
fun TelegramPopupMenuItem(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    badge: String? = null,
    isDanger: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    val textColor =
        when {
            !enabled -> DiscordTextSecondary.copy(alpha = 0.45f)
            isDanger -> Color(0xFFFF453A)
            else -> Color.White
        }
    val hasSubtitle = !subtitle.isNullOrBlank()

    // Telegram: текст слева, иконка справа.
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 16.dp, vertical = if (hasSubtitle) 10.dp else 12.dp),
        verticalAlignment = if (hasSubtitle) Alignment.Top else Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                color = textColor,
                fontSize = 16.sp,
                fontWeight = FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            subtitle?.takeIf { it.isNotBlank() }?.let { subtitleText ->
                Text(
                    text = subtitleText,
                    color = DiscordTextSecondary,
                    fontSize = 13.sp,
                )
            }
        }
        if (!badge.isNullOrBlank()) {
            Spacer(Modifier.width(8.dp))
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(TelegramMessageUi.AccentBlue)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = badge.uppercase(),
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Spacer(Modifier.width(14.dp))
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = textColor,
            modifier =
                Modifier
                    .size(22.dp)
                    .padding(top = if (hasSubtitle) 2.dp else 0.dp),
        )
    }
}
