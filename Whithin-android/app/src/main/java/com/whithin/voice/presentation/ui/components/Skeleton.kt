package com.whithin.voice.presentation.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

private val SkeletonAvatarSize = 40.dp
private val SkeletonAvatarGap = 14.dp
private val SkeletonClusterGapFirst = 14.dp
private val SkeletonClusterGapContinue = 1.dp
private val SkeletonNameHeight = 18.dp
private val SkeletonTimeWidth = 52.dp
private val SkeletonTextLineHeight = 22.dp

private enum class SkeletonClusterPosition {
    SINGLE,
    FIRST,
    MIDDLE,
    LAST,
}

private data class SkeletonMessageRow(
    val showClusterHeader: Boolean,
    val lineWidthFractions: List<Float>,
    val position: SkeletonClusterPosition,
    val showMediaBlock: Boolean = false,
)

private val chatSkeletonRows =
    listOf(
        SkeletonMessageRow(
            showClusterHeader = true,
            lineWidthFractions = listOf(0.78f, 0.52f),
            position = SkeletonClusterPosition.FIRST,
        ),
        SkeletonMessageRow(
            showClusterHeader = false,
            lineWidthFractions = listOf(0.64f),
            position = SkeletonClusterPosition.MIDDLE,
        ),
        SkeletonMessageRow(
            showClusterHeader = false,
            lineWidthFractions = listOf(0.41f),
            position = SkeletonClusterPosition.LAST,
        ),
        SkeletonMessageRow(
            showClusterHeader = true,
            lineWidthFractions = listOf(0.70f, 0.85f, 0.36f),
            position = SkeletonClusterPosition.SINGLE,
            showMediaBlock = true,
        ),
        SkeletonMessageRow(
            showClusterHeader = true,
            lineWidthFractions = listOf(0.48f),
            position = SkeletonClusterPosition.FIRST,
        ),
        SkeletonMessageRow(
            showClusterHeader = false,
            lineWidthFractions = listOf(0.58f, 0.44f),
            position = SkeletonClusterPosition.MIDDLE,
        ),
        SkeletonMessageRow(
            showClusterHeader = true,
            lineWidthFractions = listOf(0.62f, 0.33f),
            position = SkeletonClusterPosition.SINGLE,
        ),
    )

@Composable
private fun SkeletonBlock(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(6.dp),
    baseColor: Color = Color.White.copy(alpha = 0.08f),
) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 900, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "skeleton-alpha",
    )
    Box(
        modifier =
            modifier
                .clip(shape)
                .background(baseColor.copy(alpha = baseColor.alpha * alpha)),
    )
}

@Composable
fun ChatListSkeleton(
    modifier: Modifier = Modifier,
    itemCount: Int = 8,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        items(itemCount) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonBlock(
                    modifier = Modifier.size(40.dp),
                    shape = CircleShape,
                    baseColor = Color.White.copy(alpha = 0.1f),
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    SkeletonBlock(
                        modifier = Modifier.fillMaxWidth(0.55f).height(14.dp),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    SkeletonBlock(
                        modifier = Modifier.fillMaxWidth(0.85f).height(12.dp),
                    )
                }
            }
        }
    }
}

/** Скелетон списка сообщений — та же сетка, что у [com.whithin.voice.presentation.ui.screens.ChatScreen] MessageRow. */
@Composable
fun ChatMessagesSkeleton(
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier =
            modifier
                .fillMaxSize()
                .background(TelegramMessageUi.ChatBackground),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
    ) {
        items(chatSkeletonRows) { row ->
            ChatMessageSkeletonRow(row)
        }
    }
}

@Composable
private fun ChatMessageSkeletonRow(row: SkeletonMessageRow) {
    val topPadding =
        when (row.position) {
            SkeletonClusterPosition.SINGLE, SkeletonClusterPosition.FIRST -> SkeletonClusterGapFirst
            SkeletonClusterPosition.MIDDLE, SkeletonClusterPosition.LAST -> SkeletonClusterGapContinue
        }

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = topPadding),
        horizontalArrangement = Arrangement.Start,
        verticalAlignment = Alignment.Top,
    ) {
        if (row.showClusterHeader) {
            SkeletonBlock(
                modifier = Modifier.size(SkeletonAvatarSize),
                shape = CircleShape,
                baseColor = TelegramMessageUi.InputBackground.copy(alpha = 0.55f),
            )
        } else {
            Spacer(modifier = Modifier.width(SkeletonAvatarSize))
        }

        Spacer(modifier = Modifier.width(SkeletonAvatarGap))

        Column(modifier = Modifier.weight(1f)) {
            if (row.showClusterHeader) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SkeletonBlock(
                        modifier =
                            Modifier
                                .fillMaxWidth(0.38f)
                                .height(SkeletonNameHeight),
                        baseColor = Color.White.copy(alpha = 0.12f),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    SkeletonBlock(
                        modifier =
                            Modifier
                                .width(SkeletonTimeWidth)
                                .height(12.dp),
                        baseColor = Color.White.copy(alpha = 0.07f),
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
            }

            if (row.showMediaBlock) {
                SkeletonBlock(
                    modifier =
                        Modifier
                            .fillMaxWidth(0.72f)
                            .height(140.dp),
                    shape = RoundedCornerShape(8.dp),
                    baseColor = TelegramMessageUi.InputBackground.copy(alpha = 0.65f),
                )
                Spacer(modifier = Modifier.height(6.dp))
            }

            row.lineWidthFractions.forEachIndexed { index, fraction ->
                SkeletonBlock(
                    modifier =
                        Modifier
                            .fillMaxWidth(fraction)
                            .height(SkeletonTextLineHeight),
                    baseColor = Color.White.copy(alpha = 0.09f),
                )
                if (index < row.lineWidthFractions.lastIndex) {
                    Spacer(modifier = Modifier.height(2.dp))
                }
            }
        }
    }
}
