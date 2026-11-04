package com.whithin.voice.presentation.ui.components

import android.app.Activity
import android.content.pm.ActivityInfo
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ScreenShare
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.whithin.voice.presentation.ui.components.AppText as Text
import com.whithin.voice.presentation.ui.model.FullscreenScreenShareState
import kotlinx.coroutines.delay
import livekit.org.webrtc.RendererCommon
import kotlin.math.roundToInt

private val FullscreenBackground = Color(0xFF000000)
private val PipShape = RoundedCornerShape(12.dp)
private val FullscreenChromeButtonShape = RoundedCornerShape(8.dp)
private val FullscreenTitleChipShape = RoundedCornerShape(6.dp)
private val FullscreenHeaderHeight = 44.dp
private val PipEdgePadding = 16.dp
private val PipPortraitWidthFraction = 0.42f
private val PipPortraitMaxWidth = 360.dp
private val PipLandscapeWidthFraction = 0.21f
private val PipLandscapeMaxWidth = 192.dp
private const val ScreenShareAspectRatio = 16f / 9f
private const val FullscreenChromeAutoHideMs = 3_000L

@Composable
fun ScreenShareFullscreenButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isExit: Boolean = false,
) {
    IconButton(
        onClick = onClick,
        modifier =
            modifier
                .size(36.dp)
                .background(Color.Black.copy(alpha = 0.55f), FullscreenChromeButtonShape),
    ) {
        Icon(
            imageVector = if (isExit) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
            contentDescription =
                if (isExit) {
                    "Выйти из полноэкранного режима"
                } else {
                    "Полноэкранный режим"
                },
            tint = Color.White,
        )
    }
}

@Composable
fun ScreenShareFullscreenOverlay(
    state: FullscreenScreenShareState,
    isMuted: Boolean,
    isVideoEnabled: Boolean,
    isScreenSharing: Boolean,
    isAudioEnabled: Boolean,
    onMuteClick: () -> Unit,
    onVideoClick: () -> Unit,
    onScreenShareClick: () -> Unit,
    onAudioClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val activity = context as? Activity

    DisposableEffect(state.tileId) {
        val previousOrientation = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        onDispose {
            val hostActivity = activity
            if (hostActivity != null && !hostActivity.isFinishing && !hostActivity.isDestroyed) {
                hostActivity.requestedOrientation =
                    previousOrientation ?: ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }
        }
    }

    BackHandler(onBack = onDismiss)

    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .zIndex(20f)
                .background(FullscreenBackground),
    ) {
        val isPortrait = maxHeight > maxWidth

        if (isPortrait) {
            PortraitScreenShareLayout(
                state = state,
                isMuted = isMuted,
                isVideoEnabled = isVideoEnabled,
                isScreenSharing = isScreenSharing,
                isAudioEnabled = isAudioEnabled,
                onMuteClick = onMuteClick,
                onVideoClick = onVideoClick,
                onScreenShareClick = onScreenShareClick,
                onAudioClick = onAudioClick,
                onLeaveClick = onLeaveClick,
                onDismiss = onDismiss,
            )
        } else {
            LandscapeScreenShareLayout(
                state = state,
                isMuted = isMuted,
                isVideoEnabled = isVideoEnabled,
                isScreenSharing = isScreenSharing,
                isAudioEnabled = isAudioEnabled,
                onMuteClick = onMuteClick,
                onVideoClick = onVideoClick,
                onScreenShareClick = onScreenShareClick,
                onAudioClick = onAudioClick,
                onLeaveClick = onLeaveClick,
                onDismiss = onDismiss,
            )
        }
    }
}

@Composable
private fun PortraitScreenShareLayout(
    state: FullscreenScreenShareState,
    isMuted: Boolean,
    isVideoEnabled: Boolean,
    isScreenSharing: Boolean,
    isAudioEnabled: Boolean,
    onMuteClick: () -> Unit,
    onVideoClick: () -> Unit,
    onScreenShareClick: () -> Unit,
    onAudioClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        PortraitScreenShareHeader(
            ownerName = state.ownerName,
            onDismiss = onDismiss,
        )

        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth(),
        ) {
            if (state.room != null) {
                ContainedScreenShareVideo(
                    room = state.room,
                    screenTrack = state.screenTrack,
                )
            }

            if (state.room != null && state.cameraTrack != null) {
                ScreenShareCameraPip(
                    room = state.room,
                    cameraTrack = state.cameraTrack,
                    mirror = state.mirrorCamera,
                    isPortrait = true,
                    modifier = Modifier.fillMaxSize(),
                )
            }

            ControlsBar(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .zIndex(2f),
                isMuted = isMuted,
                isVideoEnabled = isVideoEnabled,
                isScreenSharing = isScreenSharing,
                isAudioEnabled = isAudioEnabled,
                onMuteClick = onMuteClick,
                onVideoClick = onVideoClick,
                onScreenShareClick = onScreenShareClick,
                onAudioClick = onAudioClick,
                onLeaveClick = onLeaveClick,
                applyNavigationInsets = false,
            )
        }
    }
}

@Composable
private fun LandscapeScreenShareLayout(
    state: FullscreenScreenShareState,
    isMuted: Boolean,
    isVideoEnabled: Boolean,
    isScreenSharing: Boolean,
    isAudioEnabled: Boolean,
    onMuteClick: () -> Unit,
    onVideoClick: () -> Unit,
    onScreenShareClick: () -> Unit,
    onAudioClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onDismiss: () -> Unit,
) {
    var chromeVisible by remember { mutableStateOf(true) }
    var isPipDragging by remember { mutableStateOf(false) }

    LandscapeFullscreenImmersiveMode(enabled = true)

    LaunchedEffect(chromeVisible, isPipDragging) {
        if (!chromeVisible || isPipDragging) return@LaunchedEffect
        delay(FullscreenChromeAutoHideMs)
        chromeVisible = false
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .pointerInput(isPipDragging) {
                    awaitEachGesture {
                        awaitFirstDown(requireUnconsumed = true)
                        if (!isPipDragging) {
                            chromeVisible = true
                        }
                    }
                },
    ) {
        if (state.room != null) {
            ContainedScreenShareVideo(
                room = state.room,
                screenTrack = state.screenTrack,
                modifier = Modifier.fillMaxSize(),
            )
        }

        if (state.room != null && state.cameraTrack != null) {
            ScreenShareCameraPip(
                room = state.room,
                cameraTrack = state.cameraTrack,
                mirror = state.mirrorCamera,
                isPortrait = false,
                onDragStateChange = { dragging ->
                    isPipDragging = dragging
                    if (dragging) {
                        chromeVisible = false
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
        }

        AnimatedVisibility(
            visible = chromeVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier =
                Modifier
                    .align(Alignment.TopStart)
                    .fillMaxWidth()
                    .zIndex(2f),
        ) {
            LandscapeScreenShareTopChrome(
                ownerName = state.ownerName,
                onDismiss = onDismiss,
            )
        }

        AnimatedVisibility(
            visible = chromeVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .zIndex(2f),
        ) {
            ControlsBar(
                isMuted = isMuted,
                isVideoEnabled = isVideoEnabled,
                isScreenSharing = isScreenSharing,
                isAudioEnabled = isAudioEnabled,
                onMuteClick = onMuteClick,
                onVideoClick = onVideoClick,
                onScreenShareClick = onScreenShareClick,
                onAudioClick = onAudioClick,
                onLeaveClick = onLeaveClick,
                applyNavigationInsets = false,
            )
        }
    }
}

@Composable
private fun PortraitScreenShareHeader(
    ownerName: String,
    onDismiss: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .height(FullscreenHeaderHeight)
                .padding(start = 12.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ScreenShare,
            contentDescription = null,
            tint = Color(0xFF5865F2),
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = "$ownerName · Демонстрация",
            color = Color.White,
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        ScreenShareFullscreenButton(
            onClick = onDismiss,
            isExit = true,
        )
    }
}

@Composable
private fun LandscapeScreenShareTopChrome(
    ownerName: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(
            modifier =
                Modifier
                    .background(Color.Black.copy(alpha = 0.55f), FullscreenTitleChipShape)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ScreenShare,
                contentDescription = null,
                tint = Color(0xFF5865F2),
                modifier = Modifier.size(16.dp),
            )
            Text(
                text = "$ownerName · Демонстрация",
                color = Color.White,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
            )
        }
        ScreenShareFullscreenButton(
            onClick = onDismiss,
            isExit = true,
        )
    }
}

@Composable
private fun ContainedScreenShareVideo(
    room: io.livekit.android.room.Room,
    screenTrack: io.livekit.android.room.track.VideoTrack,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        if (maxWidth <= 0.dp || maxHeight <= 0.dp) return@BoxWithConstraints

        val widthByHeight = maxHeight * ScreenShareAspectRatio
        val heightByWidth = maxWidth / ScreenShareAspectRatio

        val boxWidth: Dp
        val boxHeight: Dp
        if (widthByHeight <= maxWidth) {
            boxWidth = widthByHeight
            boxHeight = maxHeight
        } else {
            boxWidth = maxWidth
            boxHeight = heightByWidth
        }

        Box(
            modifier =
                Modifier
                    .size(boxWidth, boxHeight)
                    .clip(RectangleShape),
            contentAlignment = Alignment.Center,
        ) {
            VideoTrackView(
                room = room,
                videoTrack = screenTrack,
                modifier = Modifier.fillMaxSize(),
                scalingType = RendererCommon.ScalingType.SCALE_ASPECT_FIT,
                enableHardwareScaler = true,
                clipToBounds = true,
            )
        }
    }
}

@Composable
private fun ScreenShareCameraPip(
    room: io.livekit.android.room.Room,
    cameraTrack: io.livekit.android.room.track.VideoTrack,
    mirror: Boolean,
    isPortrait: Boolean,
    onDragStateChange: (Boolean) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var dragOffset by remember { mutableStateOf(Offset.Zero) }
    val density = LocalDensity.current

    BoxWithConstraints(modifier = modifier.zIndex(1f)) {
        val pipWidth =
            minOf(
                maxWidth *
                    if (isPortrait) {
                        PipPortraitWidthFraction
                    } else {
                        PipLandscapeWidthFraction
                    },
                if (isPortrait) PipPortraitMaxWidth else PipLandscapeMaxWidth,
            )
        val pipHeight = pipWidth * (10f / 16f)
        val edgePadding = PipEdgePadding
        val containerWidth = maxWidth
        val containerHeight = maxHeight

        Box(modifier = Modifier.fillMaxSize()) {
            Surface(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .offset {
                            IntOffset(
                                dragOffset.x.roundToInt(),
                                dragOffset.y.roundToInt(),
                            )
                        }
                        .padding(end = edgePadding, bottom = edgePadding)
                        .size(pipWidth, pipHeight)
                        .pointerInput(containerWidth, containerHeight, pipWidth, pipHeight) {
                            val edgePaddingPx = with(density) { edgePadding.toPx() }
                            val pipWidthPx = with(density) { pipWidth.toPx() }
                            val pipHeightPx = with(density) { pipHeight.toPx() }
                            val containerWidthPx = with(density) { containerWidth.toPx() }
                            val containerHeightPx = with(density) { containerHeight.toPx() }

                            detectDragGestures(
                                onDragStart = {
                                    onDragStateChange(true)
                                },
                                onDragEnd = {
                                    onDragStateChange(false)
                                },
                                onDragCancel = {
                                    onDragStateChange(false)
                                },
                            ) { change, dragAmount ->
                                change.consume()
                                val maxOffsetX = 0f
                                val minOffsetX =
                                    -(containerWidthPx - pipWidthPx - edgePaddingPx * 2)
                                val maxOffsetY = 0f
                                val minOffsetY =
                                    -(
                                        containerHeightPx -
                                            pipHeightPx -
                                            edgePaddingPx * 2
                                    )
                                dragOffset =
                                    Offset(
                                        (dragOffset.x + dragAmount.x).coerceIn(minOffsetX, maxOffsetX),
                                        (dragOffset.y + dragAmount.y).coerceIn(minOffsetY, maxOffsetY),
                                    )
                            }
                        },
                shape = PipShape,
                color = Color(0xFF1E1F22),
                border = BorderStroke(2.dp, Color.White.copy(alpha = 0.9f)),
                shadowElevation = 12.dp,
            ) {
                VideoTrackView(
                    room = room,
                    videoTrack = cameraTrack,
                    mirror = mirror,
                    scalingType = RendererCommon.ScalingType.SCALE_ASPECT_FILL,
                    enableHardwareScaler = true,
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .clip(PipShape),
                )
            }
        }
    }
}
