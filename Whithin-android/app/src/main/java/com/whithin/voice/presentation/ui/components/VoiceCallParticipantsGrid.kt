package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.whithin.voice.domain.model.Participant
import com.whithin.voice.presentation.ui.model.FullscreenScreenShareState
import io.livekit.android.room.Room
import io.livekit.android.room.track.VideoTrack

sealed class VoiceGridItem {
    abstract val tileId: String

    data class ParticipantTile(
        override val tileId: String,
        val participant: Participant,
        val room: Room?,
        val videoTrack: VideoTrack?,
        val showVolumeControl: Boolean = false,
    ) : VoiceGridItem()

    data class ScreenShareTile(
        override val tileId: String,
        val ownerIdentity: String,
        val ownerName: String,
        val room: Room?,
        val screenTrack: VideoTrack,
        val cameraTrack: VideoTrack?,
        val mirrorCamera: Boolean,
    ) : VoiceGridItem()
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun VoiceCallParticipantsGrid(
    items: List<VoiceGridItem>,
    onScreenShareFullscreenRequest: (FullscreenScreenShareState) -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(start = 8.dp, top = 8.dp, end = 8.dp, bottom = 120.dp),
) {
    BoxWithConstraints(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        if (maxWidth <= 0.dp || maxHeight <= 0.dp) return@BoxWithConstraints

        val count = items.size
        if (count == 0) return@BoxWithConstraints

        val columns = voiceCallGridColumnCount(count, maxWidth)
        val gap = 8.dp
        val horizontalPadding =
            contentPadding.calculateLeftPadding(androidx.compose.ui.unit.LayoutDirection.Ltr) +
                contentPadding.calculateRightPadding(androidx.compose.ui.unit.LayoutDirection.Ltr)
        val availableWidth = (maxWidth - horizontalPadding).coerceAtLeast(0.dp)
        if (availableWidth <= 0.dp) return@BoxWithConstraints
        val tileWidth =
            if (columns <= 1) {
                availableWidth
            } else {
                (availableWidth - gap * (columns - 1)) / columns
            }

        FlowRow(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(contentPadding),
            horizontalArrangement = Arrangement.spacedBy(gap, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(gap, Alignment.CenterVertically),
            maxItemsInEachRow = columns,
        ) {
            items.forEach { item ->
                val tileModifier =
                    if (count == 1) {
                        Modifier
                            .widthIn(max = minOf(availableWidth, 800.dp))
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                    } else {
                        Modifier
                            .width(tileWidth)
                            .aspectRatio(16f / 9f)
                    }

                when (item) {
                    is VoiceGridItem.ParticipantTile -> {
                        ParticipantView(
                            participant = item.participant,
                            room = item.room,
                            videoTrack = item.videoTrack,
                            modifier = tileModifier,
                            onVolumeClick =
                                if (item.showVolumeControl) {
                                    { /* per-participant volume — future hook */ }
                                } else {
                                    null
                                },
                        )
                    }

                    is VoiceGridItem.ScreenShareTile -> {
                        ScreenShareTileView(
                            ownerName = item.ownerName,
                            room = item.room,
                            screenTrack = item.screenTrack,
                            modifier = tileModifier,
                            onFullscreenClick = {
                                onScreenShareFullscreenRequest(
                                    FullscreenScreenShareState(
                                        tileId = item.tileId,
                                        ownerName = item.ownerName,
                                        room = item.room,
                                        screenTrack = item.screenTrack,
                                        cameraTrack = item.cameraTrack,
                                        mirrorCamera = item.mirrorCamera,
                                    ),
                                )
                            },
                        )
                    }
                }
            }
        }
    }
}

private fun voiceCallGridColumnCount(participantCount: Int, maxWidth: Dp): Int {
    if (participantCount <= 1) return 1
    if (maxWidth < 500.dp) return 1
    if (participantCount == 2) return if (maxWidth >= 600.dp) 2 else 1
    if (participantCount <= 4) return 2
    if (maxWidth < 750.dp) return 2
    if (participantCount <= 6) return 3
    if (maxWidth < 800.dp) return 2
    return 3
}
