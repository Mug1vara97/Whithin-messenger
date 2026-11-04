package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Poll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.MessagePoll
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordSurface
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.utils.formatPollVotesLabel
import com.whithin.voice.presentation.ui.utils.pollOptionPercent

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PollResultsSheet(
    poll: MessagePoll,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val options = poll.optionsValue
    val totalVotes =
        poll.totalVotesValue.takeIf { it > 0 }
            ?: options.sumOf { it.voteCountValue }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordSurface,
        dragHandle = null,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Poll, contentDescription = null, tint = DiscordAccent)
                Text(
                    text = "Результаты",
                    color = DiscordText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 8.dp),
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = DiscordTextSecondary)
                }
            }

            Text(
                text = poll.questionValue,
                color = DiscordText,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                text =
                    buildString {
                        append("Всего ${formatPollVotesLabel(totalVotes)}")
                        if (poll.allowMultipleValue) append(" · можно выбрать несколько")
                    },
                color = DiscordTextSecondary,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )

            for (option in options) {
                val percent = pollOptionPercent(option.voteCountValue, totalVotes)
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(text = option.textValue, color = DiscordText, fontSize = 14.sp)
                        Text(
                            text = "$percent% · ${option.voteCountValue}",
                            color = DiscordTextSecondary,
                            fontSize = 12.sp,
                        )
                    }
                    for (voter in option.votersValue) {
                        Row(
                            modifier = Modifier.padding(top = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier =
                                    Modifier
                                        .size(24.dp)
                                        .clip(CircleShape)
                                        .background(DiscordAccent),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = voter.usernameValue.take(1).uppercase(),
                                    color = Color.White,
                                    fontSize = 11.sp,
                                )
                            }
                            Text(
                                text = voter.usernameValue.ifBlank { "Unknown" },
                                color = DiscordTextSecondary,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(start = 8.dp),
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
