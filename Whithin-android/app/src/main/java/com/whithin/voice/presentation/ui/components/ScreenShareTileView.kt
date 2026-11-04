package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ScreenShare
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.ui.components.AppText as Text
import io.livekit.android.room.Room
import io.livekit.android.room.track.VideoTrack
import livekit.org.webrtc.RendererCommon

private val ScreenShareBackground = Color(0xFF000000)
private val TileShape = RoundedCornerShape(8.dp)

@Composable
fun ScreenShareTileView(
    ownerName: String,
    room: Room?,
    screenTrack: VideoTrack,
    modifier: Modifier = Modifier,
    onFullscreenClick: () -> Unit = {},
) {
    Box(
        modifier =
            modifier
                .clip(TileShape)
                .background(Color(0xFF1E1F22)),
    ) {
        if (room != null) {
            VideoTrackView(
                room = room,
                videoTrack = screenTrack,
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(ScreenShareBackground),
                scalingType = RendererCommon.ScalingType.SCALE_ASPECT_FIT,
            )
        }

        ScreenShareTileOverlay(
            ownerName = ownerName,
            onFullscreenClick = onFullscreenClick,
        )
    }
}

@Composable
private fun ScreenShareTileOverlay(
    ownerName: String,
    onFullscreenClick: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        ScreenShareFullscreenButton(
            onClick = onFullscreenClick,
            modifier = Modifier.align(Alignment.TopEnd).padding(6.dp),
        )

        Surface(
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(8.dp),
            shape = RoundedCornerShape(6.dp),
            color = Color.Black.copy(alpha = 0.65f),
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.ScreenShare,
                    contentDescription = null,
                    tint = Color(0xFF5865F2),
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    text = ownerName,
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                )
                Text(
                    text = "· Демонстрация",
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                )
            }
        }
    }
}
