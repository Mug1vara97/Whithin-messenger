package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.VoiceChannelParticipant
import com.whithin.voice.domain.model.Participant
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordSuccess
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import com.whithin.voice.presentation.viewmodel.VoiceRoomUiState
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatVoicePresenceBar(
    participants: List<VoiceChannelParticipant>,
    isUserInCall: Boolean,
    currentUserId: String,
    onJoinClick: () -> Unit,
    onOpenClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (participants.isEmpty()) return

    val barBackground = LocalAppThemePreset.current.serverListBackground
    val subtitleColor = MaterialTheme.colorScheme.onSurfaceVariant

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = barBackground,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = 12.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(
                imageVector = Icons.Default.VolumeUp,
                contentDescription = null,
                tint = DiscordSuccess,
                modifier = Modifier.size(18.dp),
            )

            VoiceParticipantAvatarStack(
                participants = participants,
                modifier = Modifier,
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Text(
                    text = if (isUserInCall) "Вы в голосовом звонке" else "В голосовом звонке",
                    color = DiscordSuccess,
                    fontSize = 13.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
                Text(
                    text = formatParticipantNames(participants, currentUserId),
                    color = subtitleColor,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
            }

            Button(
                onClick = if (isUserInCall) onOpenClick else onJoinClick,
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = DiscordSuccess,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                modifier = Modifier.height(32.dp),
            ) {
                Text(
                    text = if (isUserInCall) "Открыть" else "Присоединиться",
                    fontSize = 11.sp,
                    scrambleOnce = false,
                )
            }
        }
    }
}

@Composable
private fun VoiceParticipantAvatarStack(
    participants: List<VoiceChannelParticipant>,
    modifier: Modifier = Modifier,
    maxVisible: Int = 4,
) {
    val visible = participants.take(maxVisible)
    val avatarSize = 28.dp
    val overlap = 10.dp
    val totalWidth = avatarSize + overlap * (visible.size - 1).coerceAtLeast(0)

    Box(
        modifier = modifier.size(width = totalWidth, height = avatarSize),
        contentAlignment = Alignment.CenterStart,
    ) {
        visible.forEachIndexed { index, participant ->
            VoiceParticipantAvatar(
                participant = participant,
                size = avatarSize,
                modifier = Modifier.offset(x = overlap * index),
            )
        }
    }
}

@Composable
private fun VoiceParticipantAvatar(
    participant: VoiceChannelParticipant,
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    val speakingRing =
        if (participant.isSpeaking) {
            Modifier.border(2.dp, DiscordSuccess, CircleShape)
        } else {
            Modifier
        }
    val fallbackColor =
        runCatching { Color(android.graphics.Color.parseColor(participant.avatarColor)) }
            .getOrDefault(DiscordAccent)

    Box(
        modifier = modifier.then(speakingRing),
        contentAlignment = Alignment.Center,
    ) {
        AvatarWithPresenceIndicator(
            name = participant.userName,
            avatarUrl = participant.avatar?.toAbsoluteMediaUrl(),
            avatarColor = fallbackColor,
            status = null,
            size = size,
            showIndicator = false,
            avatarDecoration = participant.avatarDecoration,
            animateDecoration = true,
        )
    }
}

private fun formatParticipantNames(
    participants: List<VoiceChannelParticipant>,
    currentUserId: String,
): String {
    val names =
        participants.map { participant ->
            if (participant.userId == currentUserId) {
                "Вы"
            } else {
                participant.userName.ifBlank { "Участник" }
            }
        }
    return when (names.size) {
        1 -> names[0]
        2 -> "${names[0]} и ${names[1]}"
        else -> "${names[0]}, ${names[1]} и ещё ${names.size - 2}"
    }
}

private fun String.toAbsoluteMediaUrl(): String =
    when {
        startsWith("http") -> this
        startsWith("/uploads/") -> "https://whithin.ru$this"
        isNotBlank() -> "https://whithin.ru/uploads/$this"
        else -> this
    }

fun buildChatVoiceParticipants(
    chatId: String,
    userId: String,
    userName: String,
    voiceCallState: VoiceRoomUiState,
    presenceParticipants: List<VoiceChannelParticipant>,
): List<VoiceChannelParticipant> {
    val inThisCall =
        voiceCallState.isConnected &&
            voiceCallState.sessionRoomId == chatId
    if (!inThisCall) {
        return presenceParticipants
            .distinctBy { it.userId }
            .sortedWith(
                compareByDescending<VoiceChannelParticipant> { it.userId == userId }
                    .thenBy { it.userId.lowercase() },
            )
    }

    val local =
        VoiceChannelParticipant(
            userId = userId,
            userName = voiceCallState.userName.ifBlank { userName },
            isMuted = voiceCallState.isMuted,
            isSpeaking = voiceCallState.localIsSpeaking,
            avatar = voiceCallState.localAvatarUrl,
            avatarColor = voiceCallState.localAvatarColor,
            banner = voiceCallState.localBannerUrl,
        )
    val remotes =
        voiceCallState.participants.map { participant ->
            participant.toVoiceChannelParticipant()
        }
    val merged = (listOf(local) + remotes).distinctBy { it.userId }
    return merged
        .ifEmpty { presenceParticipants }
        .sortedWith(
            compareByDescending<VoiceChannelParticipant> { it.userId == userId }
                .thenBy { it.userId.lowercase() },
        )
}

private fun Participant.toVoiceChannelParticipant(): VoiceChannelParticipant =
    VoiceChannelParticipant(
        userId = identity,
        userName = name,
        isMuted = isMuted,
        isSpeaking = isSpeaking,
        isAudioDisabled = isGlobalAudioMuted,
        avatar = avatarUrl,
        avatarColor = avatarColor,
        banner = bannerUrl,
        nameplate = nameplate,
        avatarDecoration = avatarDecoration,
    )
