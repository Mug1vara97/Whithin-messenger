package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.whithin.voice.data.model.ForwardListItem
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl

@Composable
fun ForwardTargetRow(
    item: ForwardListItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isSelected: Boolean = false,
    showSelection: Boolean = false,
) {
    val colorScheme = MaterialTheme.colorScheme
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when (item) {
            is ForwardListItem.DirectMessage ->
                ForwardTargetDmAvatar(
                    title = item.title,
                    avatarUrl = item.avatarUrl,
                    avatarColor = item.avatarColor,
                    isGroup = item.isGroup,
                    isSavedMessages = item.isSavedMessages,
                )
            is ForwardListItem.ServerChannel ->
                ForwardTargetChannelAvatar(
                    serverName = item.serverName,
                    serverIconUrl = item.serverIconUrl,
                )
        }

        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp),
        ) {
            Text(
                text = item.title,
                color = colorScheme.onSurface,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                scrambleOnce = false,
            )
            item.subtitle?.takeIf { it.isNotBlank() }?.let { subtitle ->
                Text(
                    text = subtitle,
                    color = colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
            }
        }

        if (showSelection) {
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Выбрано",
                    tint = colorScheme.primary,
                    modifier = Modifier.size(26.dp),
                )
            } else {
                Spacer(modifier = Modifier.size(26.dp))
            }
        }
    }
}

@Composable
private fun ForwardTargetDmAvatar(
    title: String,
    avatarUrl: String?,
    avatarColor: String?,
    isGroup: Boolean,
    isSavedMessages: Boolean,
) {
    val colorScheme = MaterialTheme.colorScheme
    if (isSavedMessages) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Default.Bookmark,
                contentDescription = "Избранное",
                tint = colorScheme.onSurfaceVariant,
                modifier = Modifier.size(22.dp),
            )
        }
        return
    }
    val color =
        remember(avatarColor, colorScheme.primary) {
            avatarColor?.let {
                try {
                    Color(android.graphics.Color.parseColor(it))
                } catch (_: Exception) {
                    colorScheme.primary
                }
            } ?: colorScheme.primary
        }
    val resolvedUrl =
        remember(avatarUrl) {
            avatarUrl?.trim()?.takeIf { it.isNotBlank() }?.let { url ->
                when {
                    url.startsWith("/uploads/") -> "https://whithin.ru$url"
                    url.startsWith("http") -> url
                    else -> "https://whithin.ru/uploads/$url"
                }
            }
        }
    val context = LocalContext.current
    val sizePx = with(LocalDensity.current) { 44.dp.roundToPx() }

    Box(modifier = Modifier.size(44.dp)) {
        if (resolvedUrl != null) {
            val request =
                remember(resolvedUrl, sizePx) {
                    ImageRequest.Builder(context)
                        .data(resolvedUrl)
                        .size(sizePx)
                        .crossfade(false)
                        .build()
                }
            AsyncImage(
                model = request,
                contentDescription = title,
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
        } else {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(color),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text =
                        if (isGroup) {
                            "G"
                        } else {
                            title.firstOrNull()?.uppercaseChar()?.toString() ?: "U"
                        },
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    scrambleOnce = false,
                )
            }
        }
    }
}

@Composable
private fun ForwardTargetChannelAvatar(
    serverName: String,
    serverIconUrl: String?,
) {
    val colorScheme = MaterialTheme.colorScheme
    val iconResolved = remember(serverIconUrl) { resolveServerIconUrl(serverIconUrl) }
    val context = LocalContext.current
    val sizePx = with(LocalDensity.current) { 44.dp.roundToPx() }
    Box(modifier = Modifier.size(44.dp)) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(colorScheme.primary),
            contentAlignment = Alignment.Center,
        ) {
            if (iconResolved != null) {
                val request =
                    remember(iconResolved, sizePx) {
                        ImageRequest.Builder(context)
                            .data(iconResolved)
                            .size(sizePx)
                            .crossfade(false)
                            .build()
                    }
                AsyncImage(
                    model = request,
                    contentDescription = serverName,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Text(
                    text = serverName.firstOrNull()?.uppercaseChar()?.toString() ?: "S",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    scrambleOnce = false,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(18.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(colorScheme.surface)
                    .border(1.dp, colorScheme.outline, RoundedCornerShape(5.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "#",
                color = colorScheme.onSurface,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                scrambleOnce = false,
            )
        }
    }
}
