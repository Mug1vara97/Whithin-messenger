package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.ui.media.ProfileMediaSpecs

@Composable
fun UserNameplate(
    nameplate: String?,
    modifier: Modifier = Modifier,
    decoratedMinHeight: Dp = 48.dp,
    mediaPreviewSizeDp: Dp = 128.dp,
    contentPadding: PaddingValues = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
    /** false in member/participant lists — static first frame, no WebM/FrameSeq. */
    playAnimation: Boolean = true,
    content: @Composable () -> Unit,
) {
    val showNameplate = ProfileMediaSpecs.NAMEPLATE_UI_ENABLED && !nameplate.isNullOrBlank()
    if (!showNameplate) {
        Box(modifier = modifier.wrapContentHeight()) {
            content()
        }
        return
    }

    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .wrapContentHeight()
                .defaultMinSize(minHeight = decoratedMinHeight),
    ) {
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(12.dp)),
        ) {
            NameplateMedia(
                nameplate = nameplate,
                modifier = Modifier.matchParentSize(),
                contentScale = ContentScale.Crop,
                mediaAlignment = Alignment.CenterEnd,
                previewSizeDp = mediaPreviewSizeDp,
                playAnimation = playAnimation,
                bypassWebmLimiter = playAnimation,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
                    .align(Alignment.CenterStart)
                    .padding(contentPadding),
        ) {
            content()
        }
    }
}
