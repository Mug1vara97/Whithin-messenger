package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.emoji.DefaultEmojiCategories
import com.whithin.voice.data.emoji.EmojiCategory
import com.whithin.voice.data.local.EmojiRecentStore

private val EmojiGridHeight = 260.dp

enum class ExpressionPanelTab {
    EMOJI,
    STICKERS,
}

@Composable
fun EmojiPickerContent(
    onEmojiClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val recentStore = remember { EmojiRecentStore(context) }
    var recentEmojis by remember { mutableStateOf(recentStore.getRecentEmojis()) }

    val categories =
        remember(recentEmojis) {
            buildList {
                if (recentEmojis.isNotEmpty()) {
                    add(
                        EmojiCategory(
                            id = DefaultEmojiCategories.RECENT_CATEGORY_ID,
                            label = "Недавние",
                            icon = "",
                            emojis = recentEmojis,
                        ),
                    )
                }
                addAll(DefaultEmojiCategories.categories)
            }
        }

    var activeCategoryId by remember(categories) {
        mutableStateOf(categories.firstOrNull()?.id.orEmpty())
    }

    val activeCategory = categories.firstOrNull { it.id == activeCategoryId } ?: categories.first()

    Column(modifier = modifier) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 44.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(EmojiGridHeight)
                    .padding(horizontal = 8.dp),
            contentPadding = PaddingValues(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            items(activeCategory.emojis, key = { "${activeCategory.id}-$it" }) { emoji ->
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable {
                                recentEmojis = recentStore.rememberEmoji(emoji)
                                onEmojiClick(emoji)
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = emoji,
                        fontSize = 28.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items(categories, key = { it.id }) { category ->
                val selected = category.id == activeCategoryId
                Box(
                    modifier =
                        Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (selected) {
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
                                } else {
                                    MaterialTheme.colorScheme.surface.copy(alpha = 0.35f)
                                },
                            )
                            .clickable { activeCategoryId = category.id },
                    contentAlignment = Alignment.Center,
                ) {
                    if (category.id == DefaultEmojiCategories.RECENT_CATEGORY_ID) {
                        Icon(
                            imageVector = Icons.Default.History,
                            contentDescription = category.label,
                            tint =
                                if (selected) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                },
                            modifier = Modifier.size(20.dp),
                        )
                    } else {
                        Text(
                            text = category.icon,
                            fontSize = 22.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ExpressionPanelBottomTabs(
    selectedTab: ExpressionPanelTab,
    onTabSelected: (ExpressionPanelTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ExpressionPanelTabChip(
            label = "Эмодзи",
            selected = selectedTab == ExpressionPanelTab.EMOJI,
            onClick = { onTabSelected(ExpressionPanelTab.EMOJI) },
        )
        ExpressionPanelTabChip(
            label = "Стикеры",
            selected = selectedTab == ExpressionPanelTab.STICKERS,
            onClick = { onTabSelected(ExpressionPanelTab.STICKERS) },
        )
    }
}

@Composable
private fun ExpressionPanelTabChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .padding(horizontal = 4.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(
                    if (selected) {
                        TelegramMessageUi.AccentBlue.copy(alpha = 0.28f)
                    } else {
                        MaterialTheme.colorScheme.surface
                    },
                )
                .clickable(onClick = onClick)
                .padding(horizontal = 18.dp, vertical = 7.dp),
    ) {
        Text(
            text = label,
            color = androidx.compose.ui.graphics.Color.White,
            fontSize = 14.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
        )
    }
}

@Composable
fun EmojiPickerSheet(
    onDismiss: () -> Unit,
    onEmojiClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    ChatBottomSheet(onDismiss = onDismiss, modifier = modifier) {
        Text(
            text = "Эмодзи",
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
            style = MaterialTheme.typography.titleMedium,
        )
        EmojiPickerContent(onEmojiClick = onEmojiClick)
    }
}
