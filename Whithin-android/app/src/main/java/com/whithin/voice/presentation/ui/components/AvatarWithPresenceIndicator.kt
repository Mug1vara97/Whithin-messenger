package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.whithin.voice.presentation.ui.components.AppText as Text
import com.whithin.voice.presentation.ui.media.ProfileMediaSpecs
import com.whithin.voice.presentation.ui.media.resolveProfileMediaUrl
import com.whithin.voice.presentation.ui.utils.presenceColor

private const val DEFAULT_AVATAR_DECORATION_SCALE = ProfileMediaSpecs.AVATAR_DECORATION_SCALE_DEFAULT
/** Web VideoCallGrid tile scale */
const val VOICE_CALL_AVATAR_DECORATION_SCALE = 1.22f

@Composable
fun AvatarWithPresenceIndicator(
    name: String,
    avatarUrl: String?,
    avatarColor: Color,
    status: Any?,
    modifier: Modifier = Modifier,
    size: Dp = 52.dp,
    showIndicator: Boolean = true,
    displayInitial: String? = null,
    avatarDecoration: String? = null,
    decorationScale: Float = DEFAULT_AVATAR_DECORATION_SCALE,
    decorationPreviewSizeDp: Dp = 96.dp,
    reserveDecorationSpace: Boolean = true,
    innerBorderWidth: Dp = 0.dp,
    innerBorderColor: Color = Color.White,
    /**
     * true — грузим анимированную декорацию один раз и ставим на паузу при скролле
     * ([LocalChatAnimationsAllowed]), без remount/re-decode.
     */
    animateDecoration: Boolean = true,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val indicatorSize = if (size <= 40.dp) 12.dp else 14.dp
    val indicatorInset = indicatorSize / 2
    val decorationUrl = resolveProfileMediaUrl(avatarDecoration)
    val hasDecoration = !decorationUrl.isNullOrBlank()
    val decorationSize = size * decorationScale
    val slotSize = if (hasDecoration && reserveDecorationSpace) decorationSize else size
    val avatarRequest =
        remember(avatarUrl, size, context, density) {
            avatarUrl?.takeIf { it.isNotBlank() }?.let { url ->
                ImageRequest.Builder(context)
                    .data(url)
                    .size(with(density) { size.roundToPx() })
                    .crossfade(false)
                    .build()
            }
        }

    Box(modifier = modifier.size(slotSize), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(size)
                    .then(
                        if (innerBorderWidth > 0.dp) {
                            Modifier.border(innerBorderWidth, innerBorderColor, CircleShape)
                        } else {
                            Modifier
                        },
                    )
                    .clip(CircleShape)
                    .background(avatarColor),
            contentAlignment = Alignment.Center,
        ) {
            if (avatarRequest != null) {
                AsyncImage(
                    model = avatarRequest,
                    contentDescription = name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Text(
                    text = displayInitial ?: name.take(1).uppercase(),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }

        if (hasDecoration) {
            if (animateDecoration) {
                val playDecoration = LocalChatAnimationsAllowed.current
                // Keep the same animated tree mounted; only pause/resume playback.
                LoopingProfileMedia(
                    mediaPath = avatarDecoration,
                    modifier = Modifier.size(decorationSize),
                    contentScale = ContentScale.Fit,
                    mediaAlignment = Alignment.Center,
                    previewSizeDp = decorationPreviewSizeDp,
                    playAnimation = playDecoration,
                )
            } else {
                val decoPx =
                    with(density) { decorationSize.roundToPx().coerceAtLeast(1) }
                val decoRequest =
                    remember(decorationUrl, decoPx) {
                        ImageRequest.Builder(context)
                            .data(decorationUrl)
                            .size(decoPx)
                            .crossfade(false)
                            .allowHardware(true)
                            .build()
                    }
                AsyncImage(
                    model = decoRequest,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(decorationSize),
                )
            }
        }

        if (showIndicator) {
            Box(
                modifier =
                    Modifier
                        .size(size)
                        .align(Alignment.Center),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(indicatorSize)
                            .clip(CircleShape)
                            .background(presenceColor(status))
                            .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
                            .align(Alignment.BottomEnd)
                            .offset(x = indicatorInset * -1, y = indicatorInset * -1),
                )
            }
        }
    }
}
