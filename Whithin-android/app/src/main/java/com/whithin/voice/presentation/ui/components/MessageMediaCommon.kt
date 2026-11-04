package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.MediaFile
import java.util.Locale

/** Telegram's dark translucent pill used for time / duration over media. */
@Composable
internal fun MediaPill(
    text: String,
    modifier: Modifier = Modifier,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0x7A000000))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            scrambleOnce = false,
        )
        trailing?.invoke()
    }
}

/** Время + галочки статуса, как `infoLayout` на фото в Telegram. */
@Composable
internal fun MediaTimeBadge(
    time: String,
    modifier: Modifier = Modifier,
    isOwn: Boolean = false,
    status: String? = null,
) {
    MediaPill(
        text = time,
        modifier = modifier,
        trailing =
            if (isOwn) {
                {
                    MessageStatusIndicator(
                        status = status,
                        onLightBubble = false,
                        modifier = Modifier.size(12.dp),
                    )
                }
            } else {
                null
            },
    )
}

@Composable
internal fun MediaPlayButton(
    modifier: Modifier = Modifier,
    buttonSize: Dp = 48.dp,
    iconSize: Dp = 30.dp,
) {
    Box(
        modifier =
            modifier
                .size(buttonSize)
                .clip(CircleShape)
                .background(Color(0x66000000)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Default.PlayArrow,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(iconSize),
        )
    }
}

internal fun formatMediaDuration(totalSeconds: Double?): String {
    val s = (totalSeconds ?: return "").toInt().coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    val sec = s % 60
    return if (h > 0) {
        String.format(Locale.US, "%d:%02d:%02d", h, m, sec)
    } else {
        String.format(Locale.US, "%d:%02d", m, sec)
    }
}

internal fun formatMediaFileSize(bytes: Long?): String {
    val b = bytes ?: return ""
    if (b <= 0) return ""
    val kb = b / 1024.0
    if (kb < 1024) return String.format(Locale.US, "%.0f KB", kb)
    val mb = kb / 1024.0
    if (mb < 1024) return String.format(Locale.US, "%.1f MB", mb)
    return String.format(Locale.US, "%.2f GB", mb / 1024.0)
}

/** "0:15" when the duration is known, otherwise the file size ("2.4 MB"), or "" when neither. */
internal fun videoBadgeLabel(media: MediaFile): String {
    val duration = formatMediaDuration(media.durationSecondsValue)
    if (duration.isNotBlank()) return duration
    return formatMediaFileSize(media.fileSize ?: media.fileSizeAlt)
}
