package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.util.Log
import android.widget.FrameLayout
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HeadsetOff
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.domain.model.Participant
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordSuccess
import com.whithin.voice.presentation.ui.theme.DiscordText
import io.livekit.android.room.Room
import io.livekit.android.room.track.VideoTrack
import livekit.org.webrtc.EglBase
import livekit.org.webrtc.RendererCommon
import livekit.org.webrtc.SurfaceViewRenderer

private val TileBackground = Color(0xFF1E1F22)
private val SpeakingGreen = Color(0xFF23A55A)
private val MicSilentTint = Color(0xFFB5BAC1)
private val StatusBadgeBackground = Color(0xCC000000)
private val TileShape = RoundedCornerShape(8.dp)
private val StatusBadgeShape = RoundedCornerShape(3.dp)
private const val CallTileDecorationScale = VOICE_CALL_AVATAR_DECORATION_SCALE

@Composable
fun ParticipantView(
    participant: Participant,
    room: Room?,
    videoTrack: VideoTrack? = null,
    modifier: Modifier = Modifier,
    onVolumeClick: (() -> Unit)? = null,
) {
    val isSpeakingLive = participant.isSpeaking && !participant.isMuted

    Box(modifier = modifier) {
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .clip(TileShape)
                    .background(TileBackground),
        ) {
            if (videoTrack != null && participant.hasVideo && room != null) {
                VideoTrackView(
                    room = room,
                    videoTrack = videoTrack,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                ParticipantAvatarBackground(participant = participant)
            }

            if (isSpeakingLive) {
                Box(
                    modifier =
                        Modifier
                            .matchParentSize()
                            .background(
                                Brush.verticalGradient(
                                    colors =
                                        listOf(
                                            SpeakingGreen.copy(alpha = 0.15f),
                                            SpeakingGreen.copy(alpha = 0.05f),
                                        ),
                                ),
                            ),
                )
                Box(
                    modifier =
                        Modifier
                            .matchParentSize()
                            .border(3.dp, SpeakingGreen, TileShape),
                )
            }
        }

        ParticipantOverlay(
            participant = participant,
            modifier = Modifier.fillMaxSize(),
            onVolumeClick = onVolumeClick,
        )
    }
}

@Composable
private fun ParticipantAvatarBackground(participant: Participant) {
    val bannerValue = participant.bannerUrl
    val bannerImageUrl = if (isBannerImage(bannerValue)) buildMediaUrl(bannerValue) else null
    val bannerColor =
        if (!bannerValue.isNullOrBlank() && !isBannerImage(bannerValue)) {
            parseBannerColor(bannerValue)
        } else {
            null
        }
    val avatarUrl = buildAvatarUrl(participant.avatarUrl)
    val avatarColor = parseAvatarColor(participant.avatarColor)
    val letter =
        participant.name
            .trim()
            .firstOrNull()
            ?.uppercaseChar()
            ?.toString()
            ?: "?"

    val hasBannerOrColor = bannerColor != null || bannerImageUrl != null

    if (hasBannerOrColor) {
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(bannerColor ?: avatarColor),
            )
            if (!bannerImageUrl.isNullOrBlank()) {
                val context = LocalContext.current
                val h = with(LocalDensity.current) { 240.dp.roundToPx() }
                val bannerRequest =
                    remember(bannerImageUrl, h) {
                        sizedImageRequest(context, bannerImageUrl, 1080, h)
                    }
                AsyncImage(
                    model = bannerRequest,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CallTileAvatar(
                    avatarUrl = avatarUrl,
                    letter = letter,
                    avatarColor = avatarColor,
                    avatarDecoration = participant.avatarDecoration,
                    size = 100.dp,
                    showContrastRing = true,
                )
            }
        }
    } else if (!avatarUrl.isNullOrBlank()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            CallTileAvatar(
                avatarUrl = avatarUrl,
                letter = letter,
                avatarColor = avatarColor,
                avatarDecoration = participant.avatarDecoration,
                size = 120.dp,
                showContrastRing = false,
            )
        }
    } else {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(avatarColor),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = letter,
                fontSize = 80.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
            )
        }
    }
}

@Composable
private fun CallTileAvatar(
    avatarUrl: String?,
    letter: String,
    avatarColor: Color,
    avatarDecoration: String?,
    size: androidx.compose.ui.unit.Dp,
    showContrastRing: Boolean,
) {
    val hasDecoration = !avatarDecoration.isNullOrBlank()
    AvatarWithPresenceIndicator(
        name = letter,
        avatarUrl = avatarUrl,
        avatarColor = avatarColor,
        status = null,
        size = size,
        showIndicator = false,
        displayInitial = letter,
        avatarDecoration = avatarDecoration,
        decorationScale = CallTileDecorationScale,
        decorationPreviewSizeDp = 160.dp,
        innerBorderWidth = if (showContrastRing && !hasDecoration) 3.dp else 0.dp,
        innerBorderColor = Color.White,
        // Many tiles on screen — keep frames static to avoid FrameSeq storms.
        animateDecoration = false,
    )
}

private class ClippedVideoRendererHost(context: android.content.Context) : FrameLayout(context) {
    val renderer: SurfaceViewRenderer
    var eglBase: EglBase? = null

    init {
        clipChildren = true
        clipToPadding = true
        renderer =
            SurfaceViewRenderer(context).also { surface ->
                addView(surface, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
            }
    }
}

@Composable
fun VideoTrackView(
    room: Room,
    videoTrack: VideoTrack,
    modifier: Modifier = Modifier,
    mirror: Boolean = false,
    scalingType: RendererCommon.ScalingType = RendererCommon.ScalingType.SCALE_ASPECT_FILL,
    enableHardwareScaler: Boolean = false,
    clipToBounds: Boolean = false,
) {
    val trackKey = videoTrack.sid.orEmpty().ifBlank { videoTrack.name.orEmpty() }.ifBlank { "video" }
    key(trackKey) {
        AndroidView(
            factory = { context ->
                val eglBase = EglBase.create()
                if (clipToBounds) {
                    ClippedVideoRendererHost(context).apply {
                        this.eglBase = eglBase
                        renderer.init(eglBase.eglBaseContext, null)
                        renderer.setEnableHardwareScaler(enableHardwareScaler)
                        renderer.setScalingType(scalingType)
                        renderer.setMirror(mirror)
                        runCatching { videoTrack.addRenderer(renderer) }
                            .onFailure {
                                Log.w("VideoTrackView", "Failed to attach renderer for $trackKey", it)
                            }
                    }
                } else {
                    SurfaceViewRenderer(context).apply {
                        init(eglBase.eglBaseContext, null)
                        setEnableHardwareScaler(enableHardwareScaler)
                        setScalingType(scalingType)
                        setMirror(mirror)
                        tag = eglBase
                        runCatching { videoTrack.addRenderer(this) }
                            .onFailure {
                                Log.w("VideoTrackView", "Failed to attach renderer for $trackKey", it)
                            }
                    }
                }
            },
            modifier = modifier,
            update = { view ->
                val renderer =
                    if (clipToBounds) {
                        (view as ClippedVideoRendererHost).renderer
                    } else {
                        view as SurfaceViewRenderer
                    }
                renderer.setEnableHardwareScaler(enableHardwareScaler)
                renderer.setScalingType(scalingType)
                renderer.setMirror(mirror)
            },
            onRelease = { view ->
                if (clipToBounds) {
                    val host = view as ClippedVideoRendererHost
                    runCatching { videoTrack.removeRenderer(host.renderer) }
                        .onFailure {
                            Log.w("VideoTrackView", "Failed to detach renderer for $trackKey", it)
                        }
                    runCatching { host.renderer.release() }
                    host.eglBase?.let { egl ->
                        runCatching { egl.release() }
                    }
                } else {
                    val renderer = view as SurfaceViewRenderer
                    runCatching { videoTrack.removeRenderer(renderer) }
                        .onFailure {
                            Log.w("VideoTrackView", "Failed to detach renderer for $trackKey", it)
                        }
                    runCatching { renderer.release() }
                    (renderer.tag as? EglBase)?.let { egl ->
                        runCatching { egl.release() }
                    }
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParticipantOverlay(
    participant: Participant,
    modifier: Modifier = Modifier,
    onVolumeClick: (() -> Unit)? = null,
) {
    Box(modifier = modifier) {
        Row(
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                MicStatusBadge(participant = participant)
                if (participant.isGlobalAudioMuted) {
                    HeadsetStatusBadge()
                }
                Text(
                    text = participant.name,
                    color = DiscordText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style =
                        MaterialTheme.typography.bodyMedium.copy(
                            shadow =
                                Shadow(
                                    color = Color.Black.copy(alpha = 0.8f),
                                    blurRadius = 2f,
                                ),
                        ),
                )
            }

            if (onVolumeClick != null) {
                Surface(
                    onClick = onVolumeClick,
                    modifier = Modifier.size(35.dp),
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.5f),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = "Громкость",
                            tint = DiscordText,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MicStatusBadge(participant: Participant) {
    val (backgroundColor, icon, tint) =
        when {
            participant.isMuted ->
                Triple(StatusBadgeBackground, Icons.Default.MicOff, DiscordError)
            participant.isSpeaking ->
                Triple(SpeakingGreen.copy(alpha = 0.2f), Icons.Default.Mic, DiscordSuccess)
            else ->
                Triple(StatusBadgeBackground, Icons.Default.Mic, MicSilentTint)
        }

    Box(
        modifier =
            Modifier
                .size(26.dp)
                .clip(StatusBadgeShape)
                .background(backgroundColor),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun HeadsetStatusBadge() {
    Box(
        modifier =
            Modifier
                .size(26.dp)
                .clip(StatusBadgeShape)
                .background(StatusBadgeBackground),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Default.HeadsetOff,
            contentDescription = null,
            tint = DiscordError,
            modifier = Modifier.size(18.dp),
        )
    }
}

private fun buildAvatarUrl(avatar: String?): String? = buildMediaUrl(avatar)

private fun buildMediaUrl(value: String?): String? {
    if (value.isNullOrBlank()) return null
    return when {
        value.startsWith("http://") || value.startsWith("https://") -> value
        value.startsWith("/") -> "https://whithin.ru$value"
        value.startsWith("uploads/") -> "https://whithin.ru/$value"
        value.startsWith("api/") -> "https://whithin.ru/$value"
        value.contains("/") -> "https://whithin.ru/$value"
        else -> "https://whithin.ru/uploads/$value"
    }
}

private fun isBannerImage(value: String?): Boolean {
    if (value.isNullOrBlank()) return false
    if (value.startsWith("#")) return false
    val lower = value.lowercase()
    return lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".gif") ||
        lower.endsWith(".webp") ||
        lower.endsWith(".svg") ||
        lower.startsWith("http://") ||
        lower.startsWith("https://") ||
        lower.startsWith("/uploads/") ||
        lower.startsWith("uploads/") ||
        lower.startsWith("/api/") ||
        lower.startsWith("api/")
}

private fun parseBannerColor(value: String?): Color? {
    if (value.isNullOrBlank()) return null
    return try {
        Color(AndroidColor.parseColor(value))
    } catch (_: Exception) {
        null
    }
}

@Composable
private fun parseAvatarColor(colorHex: String?): Color {
    val fallback = MaterialTheme.colorScheme.primary
    if (colorHex.isNullOrBlank()) return fallback
    return try {
        Color(AndroidColor.parseColor(colorHex))
    } catch (_: Exception) {
        fallback
    }
}
