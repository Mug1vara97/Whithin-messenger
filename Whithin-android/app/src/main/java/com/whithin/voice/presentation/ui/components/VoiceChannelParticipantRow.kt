package com.whithin.voice.presentation.ui.components

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HeadsetOff
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.whithin.voice.data.model.VoiceChannelParticipant
import com.whithin.voice.presentation.ui.components.AppText as Text
import com.whithin.voice.presentation.ui.theme.DiscordError

private val SpeakingGreen = Color(0xFF43B581)
private val MutedNameColor = Color(0xFFB5BAC1)
private val NameplateTextColor = Color(0xFFF2F3F5)
private val NameplatePull = 22.dp
private val NameplateHeight = 28.dp
private val NameplateRadius = 8.dp

/**
 * Sidebar voice participant row — mirrors web `.voice-participant__layout`.
 */
@Composable
fun VoiceChannelParticipantRow(
    participant: VoiceChannelParticipant,
    modifier: Modifier = Modifier,
) {
    val isSpeaking = participant.isSpeaking && !participant.isMuted
    val isMuted = participant.isMuted
    val isDeafened = participant.isAudioDisabled || participant.isDeafened
    val hasNameplate = !participant.nameplate.isNullOrBlank()
    val displayName =
        participant.userName.ifBlank {
            participant.userId.take(6)
        }

    val nameColor =
        when {
            isDeafened -> MutedNameColor.copy(alpha = 0.7f)
            isMuted -> MutedNameColor
            hasNameplate -> NameplateTextColor
            else -> MaterialTheme.colorScheme.onSurfaceVariant
        }
    val nameStyle =
        if (hasNameplate) {
            TextStyle(
                shadow =
                    Shadow(
                        color = Color.Black.copy(alpha = 0.65f),
                        offset = Offset(0f, 3f),
                        blurRadius = 6f,
                    ),
            )
        } else {
            TextStyle()
        }

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 32.dp)
                .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        VoiceSidebarAvatarWrap(
            participant = participant,
            isSpeaking = isSpeaking,
            modifier = Modifier.zIndex(2f),
        )

        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .then(
                        if (hasNameplate) {
                            Modifier
                                .offset(x = -NameplatePull)
                                .height(NameplateHeight)
                        } else {
                            Modifier.padding(start = 6.dp)
                        },
                    ),
        ) {
            if (hasNameplate) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(NameplateRadius)),
                ) {
                    NameplateMedia(
                        nameplate = participant.nameplate,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                        mediaAlignment = Alignment.CenterEnd,
                        previewSizeDp = 96.dp,
                        playAnimation = false,
                    )
                }
            }

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .then(
                            if (hasNameplate) {
                                Modifier
                                    .height(NameplateHeight)
                                    .padding(start = NameplatePull + 10.dp, end = 8.dp)
                            } else {
                                Modifier.padding(start = 2.dp, end = 6.dp, top = 2.dp, bottom = 2.dp)
                            },
                        ),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = displayName,
                    fontSize = 13.sp,
                    fontWeight = if (hasNameplate) FontWeight.SemiBold else FontWeight.Medium,
                    color = nameColor,
                    style = nameStyle,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (isMuted) {
                    Icon(
                        imageVector = Icons.Default.MicOff,
                        contentDescription = "Muted",
                        tint = DiscordError,
                        modifier = Modifier.size(14.dp),
                    )
                }
                if (isDeafened) {
                    Icon(
                        imageVector = Icons.Default.HeadsetOff,
                        contentDescription = "Deafened",
                        tint = DiscordError,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun VoiceSidebarAvatarWrap(
    participant: VoiceChannelParticipant,
    isSpeaking: Boolean,
    modifier: Modifier = Modifier,
) {
    val fallbackColor =
        runCatching {
            Color(AndroidColor.parseColor(participant.avatarColor))
        }.getOrNull() ?: MaterialTheme.colorScheme.primary
    val avatarUrl = resolveVoiceAvatarUrl(participant.avatar)

    Box(
        modifier = modifier.size(34.dp),
        contentAlignment = Alignment.Center,
    ) {
        AvatarWithPresenceIndicator(
            name = participant.userName,
            avatarUrl = avatarUrl,
            avatarColor = fallbackColor,
            status = null,
            size = 30.dp,
            showIndicator = false,
            avatarDecoration = null,
        )
        if (isSpeaking) {
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .border(2.dp, SpeakingGreen, CircleShape),
            )
        }
    }
}

private fun resolveVoiceAvatarUrl(avatar: String?): String? {
    val raw = avatar?.trim().orEmpty()
    if (raw.isBlank()) return null
    return when {
        raw.startsWith("http://") || raw.startsWith("https://") -> raw
        raw.startsWith("/") -> "https://whithin.ru$raw"
        raw.startsWith("uploads/") -> "https://whithin.ru/$raw"
        else -> "https://whithin.ru/uploads/$raw"
    }
}
