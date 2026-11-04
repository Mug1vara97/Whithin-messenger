package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Poll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.MessagePoll
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordOutline
import com.whithin.voice.presentation.ui.theme.DiscordSurface
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.utils.formatPollVotesLabel
import com.whithin.voice.presentation.ui.utils.pollOptionPercent

@Composable
fun PollMessageContent(
    poll: MessagePoll,
    onVote: (List<String>) -> Unit,
    disabled: Boolean = false,
    modifier: Modifier = Modifier,
) {
    var showResults by remember { mutableStateOf(false) }
    val options = poll.optionsValue
    val votedIds = poll.votedOptionIdsValue.map { it.lowercase() }.toSet()
    val totalVotes =
        poll.totalVotesValue.takeIf { it > 0 }
            ?: options.sumOf { it.voteCountValue }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Outlined.Poll,
                contentDescription = null,
                tint = DiscordAccent,
                modifier = Modifier.padding(end = 6.dp),
            )
            Text(
                text = "Опрос",
                color = DiscordAccent,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = if (poll.isAnonymousValue) "Анонимный" else "Публичный",
                color = DiscordTextSecondary,
                fontSize = 11.sp,
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = poll.questionValue,
            color = DiscordText,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
        )

        Spacer(modifier = Modifier.height(10.dp))

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { option ->
                val optionId = option.idValue.trim().lowercase()
                val isSelected = votedIds.contains(optionId)
                val percent = pollOptionPercent(option.voteCountValue, totalVotes)
                PollOptionRow(
                    text = option.textValue,
                    percent = percent,
                    voteCount = option.voteCountValue,
                    selected = isSelected,
                    enabled = !disabled,
                    onClick = {
                        if (disabled) return@PollOptionRow
                        if (poll.allowMultipleValue) {
                            val next = votedIds.toMutableSet()
                            if (next.contains(optionId)) next.remove(optionId) else next.add(optionId)
                            onVote(next.toList())
                        } else {
                            onVote(if (isSelected) emptyList() else listOf(option.idValue))
                        }
                    },
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text =
                buildString {
                    append(formatPollVotesLabel(totalVotes))
                    if (poll.allowMultipleValue) append(" · можно выбрать несколько")
                    if (poll.isAnonymousValue) append(" · голоса скрыты")
                },
            color = DiscordTextSecondary,
            fontSize = 12.sp,
        )

        if (!poll.isAnonymousValue) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Результаты",
                color = DiscordAccent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.clickable { showResults = true },
            )
        }
    }

    if (showResults && !poll.isAnonymousValue) {
        PollResultsSheet(
            poll = poll,
            onDismiss = { showResults = false },
        )
    }
}

@Composable
private fun PollOptionRow(
    text: String,
    percent: Int,
    voteCount: Int,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(8.dp)
    val accent = DiscordAccent
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .border(
                    width = 1.dp,
                    color =
                        if (selected) {
                            accent
                        } else {
                            DiscordOutline
                        },
                    shape = shape,
                )
                .background(DiscordSurface)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .clip(shape)
                    .background(accent.copy(alpha = if (selected) 0.22f else 0.12f)),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(fraction = (percent.coerceIn(0, 100) / 100f).coerceAtLeast(0f))
                        .background(accent.copy(alpha = if (selected) 0.35f else 0.18f)),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = text,
                color = DiscordText,
                fontSize = 14.sp,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "$percent% · $voteCount",
                color = DiscordTextSecondary,
                fontSize = 12.sp,
            )
        }
    }
}
