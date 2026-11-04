package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordOutlineVariant
import com.whithin.voice.presentation.ui.theme.DiscordTabSelected
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.theme.IsNeoVectorheartTheme
import com.whithin.voice.presentation.ui.theme.NeoVectorheartPanelBorder

@Composable
fun FloatingPillTabBar(
    tabs: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    selectedTextColor: Color = DiscordAccent,
) {
    if (tabs.isEmpty()) return

    val isNeoVectorheart = IsNeoVectorheartTheme
    val railShape =
        if (isNeoVectorheart) {
            CutCornerShape(topStart = 16.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 16.dp)
        } else {
            RoundedCornerShape(50)
        }
    val chipShape =
        if (isNeoVectorheart) {
            CutCornerShape(topStart = 12.dp, topEnd = 4.dp, bottomStart = 4.dp, bottomEnd = 12.dp)
        } else {
            RoundedCornerShape(50)
        }

    val horizontalScroll = rememberScrollState()
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(railShape)
                .background(DiscordModalCard)
                .border(
                    width = if (isNeoVectorheart) 1.dp else 0.5.dp,
                    color = if (isNeoVectorheart) NeoVectorheartPanelBorder else DiscordOutlineVariant,
                    shape = railShape,
                )
                .horizontalScroll(horizontalScroll)
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tabs.forEachIndexed { index, label ->
                val selected = index == selectedIndex
                Box(
                    modifier = Modifier
                        .clip(chipShape)
                        .background(if (selected) DiscordTabSelected else Color.Transparent)
                        .clickable { onSelect(index) }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        color = if (selected) selectedTextColor else DiscordTextSecondary,
                        fontSize = 14.sp,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
