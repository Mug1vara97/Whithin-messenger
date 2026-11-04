package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.whithin.voice.data.model.Server
import com.whithin.voice.presentation.ui.media.resolveAvatarUrl
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import androidx.compose.material3.MaterialTheme
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordSuccess

@Composable
fun ServerSidebar(
    servers: List<Server>,
    selectedServerId: String? = null,
    onServerSelected: (Server?) -> Unit,
    onDiscoverClick: () -> Unit = {},
    onCreateServerClick: () -> Unit = {},
    userAvatarUrl: String? = null,
    userAvatarColor: String? = null,
    userName: String = "",
    onProfileClick: () -> Unit = {},
    onProfileSettingsClick: () -> Unit = {},
    onLogout: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val sidebarColor = LocalAppThemePreset.current.serverListBackground
    Box(
        modifier = modifier
            .fillMaxHeight()
            .width(72.dp)
            .background(sidebarColor),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
        // "Чаты" button (like Discord's DMs)
        ServerIconButton(
            isSelected = selectedServerId == null,
            onClick = { onServerSelected(null) },
            icon = Icons.Default.Message,
            label = "Чаты"
        )
        
        Divider(
            modifier = Modifier
                .width(32.dp)
                .height(2.dp),
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f),
            thickness = 2.dp
        )
        
        // Server list
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            items(
                items = servers,
                key = { it.serverIdValue }
            ) { server ->
                ServerIconButton(
                    isSelected = selectedServerId == server.serverIdValue,
                    onClick = { onServerSelected(server) },
                    server = server
                )
            }
        }
        
        ServerIconButton(
            isSelected = false,
            onClick = onCreateServerClick,
            textSymbol = "+",
            label = "Создать сервер",
        )

        ServerIconButton(
            isSelected = false,
            onClick = onDiscoverClick,
            icon = Icons.Default.Explore,
            label = "Обзор серверов",
        )

        ServerIconButton(
            isSelected = false,
            onClick = onProfileClick,
            avatarUrl = userAvatarUrl,
            avatarColor = userAvatarColor,
            avatarName = userName,
            label = "Профиль",
        )

        // Profile settings button
        ServerIconButton(
            isSelected = false,
            onClick = onProfileSettingsClick,
            icon = Icons.Default.Settings,
            label = "Настройки профиля"
        )

        // Logout button
        ServerIconButton(
            isSelected = false,
            onClick = onLogout,
            icon = Icons.Default.Logout,
            label = "Выход"
        )
        }
    }
}

@Composable
private fun ServerIconButton(
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    textSymbol: String? = null,
    label: String? = null,
    server: Server? = null,
    avatarUrl: String? = null,
    avatarColor: String? = null,
    avatarName: String? = null,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val iconSizePx = remember(density) { with(density) { 46.dp.roundToPx() } }
    val backgroundColor = if (isSelected) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.surface
    }

    val contentColor = if (isSelected) {
        MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }
    
    Box(
        modifier = modifier
            .size(46.dp)
            .clip(CircleShape)
            .background(backgroundColor)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        when {
            server != null -> {
                val iconResolved = remember(server.iconUrlValue) {
                    resolveServerIconUrl(server.iconUrlValue)
                }
                val iconRequest = remember(iconResolved, context, iconSizePx) {
                    iconResolved?.let { url ->
                        ImageRequest.Builder(context)
                            .data(url)
                            .size(iconSizePx)
                            .crossfade(false)
                            .build()
                    }
                }
                when {
                    iconRequest != null -> AsyncImage(
                        model = iconRequest,
                        contentDescription = server.nameValue,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )

                    else -> Text(
                        text = server.nameValue.takeIf { it.isNotEmpty() }?.firstOrNull()?.uppercase() ?: "S",
                        color = contentColor,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            !avatarUrl.isNullOrBlank() || !avatarName.isNullOrBlank() -> {
                val resolvedAvatar = remember(avatarUrl) { resolveAvatarUrl(avatarUrl) }
                val letter =
                    avatarName?.trim()?.firstOrNull()?.uppercaseChar()?.toString() ?: "U"
                val fallbackColor =
                    remember(avatarColor) {
                        avatarColor?.let {
                            runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
                        }
                    } ?: MaterialTheme.colorScheme.primary
                if (resolvedAvatar != null) {
                    val avatarRequest = remember(resolvedAvatar, context, iconSizePx) {
                        ImageRequest.Builder(context)
                            .data(resolvedAvatar)
                            .size(iconSizePx)
                            .crossfade(false)
                            .build()
                    }
                    AsyncImage(
                        model = avatarRequest,
                        contentDescription = label,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .background(fallbackColor),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = letter,
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
            icon != null -> {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = contentColor,
                    modifier = Modifier.size(24.dp)
                )
            }
            textSymbol != null -> {
                Text(
                    text = textSymbol,
                    color = DiscordSuccess,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Light,
                    textAlign = TextAlign.Center,
                )
            }
            else -> {
                Text(
                    text = label ?: "",
                    color = contentColor,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
