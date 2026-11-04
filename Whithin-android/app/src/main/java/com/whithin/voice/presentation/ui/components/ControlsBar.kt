package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ScreenShare
import androidx.compose.material.icons.automirrored.filled.StopScreenShare
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Headset
import androidx.compose.material.icons.filled.HeadsetOff
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.ui.theme.DiscordError

private enum class DockButtonStyle {
    IDLE,
    ACTIVE,
    MUTED,
    DISCONNECT,
}

private val DockButtonSize = 52.dp
private val DockIconSize = 26.dp
private val DockShape = RoundedCornerShape(12.dp)
private val DockOuterShape = RoundedCornerShape(20.dp)

@Composable
fun ControlsBar(
    isMuted: Boolean,
    isVideoEnabled: Boolean,
    isScreenSharing: Boolean = false,
    isAudioEnabled: Boolean,
    onMuteClick: () -> Unit,
    onVideoClick: () -> Unit,
    onScreenShareClick: () -> Unit = {},
    onAudioClick: () -> Unit,
    onLeaveClick: () -> Unit,
    modifier: Modifier = Modifier,
    applyNavigationInsets: Boolean = true,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .then(
                    if (applyNavigationInsets) {
                        Modifier.navigationBarsPadding()
                    } else {
                        Modifier
                    },
                )
                .padding(horizontal = 8.dp, vertical = 10.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        CallControlDock(
            isMuted = isMuted,
            isVideoEnabled = isVideoEnabled,
            isScreenSharing = isScreenSharing,
            isAudioEnabled = isAudioEnabled,
            onMuteClick = onMuteClick,
            onVideoClick = onVideoClick,
            onScreenShareClick = onScreenShareClick,
            onAudioClick = onAudioClick,
            onLeaveClick = onLeaveClick,
        )
    }
}

@Composable
private fun CallControlDock(
    isMuted: Boolean,
    isVideoEnabled: Boolean,
    isScreenSharing: Boolean,
    isAudioEnabled: Boolean,
    onMuteClick: () -> Unit,
    onVideoClick: () -> Unit,
    onScreenShareClick: () -> Unit,
    onAudioClick: () -> Unit,
    onLeaveClick: () -> Unit,
) {
    val scrollState = rememberScrollState()
    val colors = MaterialTheme.colorScheme
    val accent = colors.primary
    val dockGlass = colors.surface.copy(alpha = 0.92f)
    val dockBorder = colors.outline.copy(alpha = 0.45f)

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(scrollState),
        horizontalArrangement = Arrangement.Center,
    ) {
        Surface(
            shape = DockOuterShape,
            color = dockGlass,
            border = BorderStroke(1.dp, dockBorder),
            shadowElevation = 10.dp,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    DockControlButton(
                        icon = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = if (isMuted) "Включить микрофон" else "Выключить микрофон",
                        style = if (isMuted) DockButtonStyle.MUTED else DockButtonStyle.IDLE,
                        onClick = onMuteClick,
                    )
                    DockControlButton(
                        icon = if (isAudioEnabled) Icons.Default.Headset else Icons.Default.HeadsetOff,
                        contentDescription =
                            if (isAudioEnabled) {
                                "Выключить звук всех"
                            } else {
                                "Включить звук всех"
                            },
                        style = if (isAudioEnabled) DockButtonStyle.IDLE else DockButtonStyle.MUTED,
                        onClick = onAudioClick,
                    )
                }

                DockDivider()

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    DockControlButton(
                        icon = Icons.Default.Videocam,
                        contentDescription = if (isVideoEnabled) "Выключить камеру" else "Включить камеру",
                        style = if (isVideoEnabled) DockButtonStyle.ACTIVE else DockButtonStyle.IDLE,
                        accentColor = accent,
                        onClick = onVideoClick,
                    )
                    DockControlButton(
                        icon =
                            if (isScreenSharing) {
                                Icons.AutoMirrored.Filled.StopScreenShare
                            } else {
                                Icons.AutoMirrored.Filled.ScreenShare
                            },
                        contentDescription =
                            if (isScreenSharing) {
                                "Остановить демонстрацию экрана"
                            } else {
                                "Демонстрация экрана"
                            },
                        style = if (isScreenSharing) DockButtonStyle.ACTIVE else DockButtonStyle.IDLE,
                        accentColor = accent,
                        onClick = onScreenShareClick,
                    )
                }

                DockDivider()

                DockControlButton(
                    icon = Icons.Default.CallEnd,
                    contentDescription = "Завершить звонок",
                    style = DockButtonStyle.DISCONNECT,
                    onClick = onLeaveClick,
                )
            }
        }
    }
}

@Composable
private fun DockDivider() {
    Box(
        modifier =
            Modifier
                .width(1.dp)
                .height(30.dp)
                .background(Color.White.copy(alpha = 0.1f)),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DockControlButton(
    icon: ImageVector,
    contentDescription: String,
    style: DockButtonStyle,
    onClick: () -> Unit,
    accentColor: Color = Color.Unspecified,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val resolvedAccent =
        if (accentColor == Color.Unspecified) {
            colors.primary
        } else {
            accentColor
        }

    val backgroundColor =
        when (style) {
            DockButtonStyle.IDLE -> colors.surfaceVariant
            DockButtonStyle.ACTIVE -> colors.secondaryContainer
            DockButtonStyle.MUTED -> DiscordError
            DockButtonStyle.DISCONNECT -> DiscordError
        }

    val iconTint =
        when (style) {
            DockButtonStyle.IDLE -> colors.onSurfaceVariant
            DockButtonStyle.ACTIVE -> resolvedAccent
            DockButtonStyle.MUTED -> Color.White
            DockButtonStyle.DISCONNECT -> Color.White
        }

    val border =
        when (style) {
            DockButtonStyle.ACTIVE ->
                BorderStroke(1.dp, resolvedAccent.copy(alpha = 0.4f))
            DockButtonStyle.IDLE ->
                BorderStroke(1.dp, colors.outline.copy(alpha = 0.2f))
            DockButtonStyle.MUTED, DockButtonStyle.DISCONNECT ->
                BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        }

    Surface(
        onClick = onClick,
        modifier = modifier.size(DockButtonSize),
        shape = DockShape,
        color = backgroundColor,
        border = border,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = iconTint,
                modifier = Modifier.size(DockIconSize),
            )
        }
    }
}
