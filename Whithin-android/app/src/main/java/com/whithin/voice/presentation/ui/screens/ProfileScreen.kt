package com.whithin.voice.presentation.ui.screens

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.presentation.ui.components.AvatarWithPresenceIndicator
import com.whithin.voice.presentation.ui.components.UserNameplate
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordModalBackground
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.util.visibleName

@Composable
fun ProfileScreen(
    authViewModel: AuthViewModel,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val state by authViewModel.uiState.collectAsUiState()
    val user = state.user
    val bannerUrl = resolveServerIconUrl(user?.bannerUrl)
    val avatarUrl = resolveServerIconUrl(user?.avatarUrl)
    val accent = parseAvatarColor(user?.avatarColor)
    val loginUsername = user?.username.orEmpty()
    val visibleName = user?.visibleName() ?: "Гость"
    val initial = visibleName.firstOrNull()?.uppercaseChar()?.toString() ?: "?"

    LaunchedEffect(Unit) {
        authViewModel.refreshProfileVisuals()
    }

    Surface(modifier = Modifier.fillMaxSize(), color = DiscordModalBackground) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Назад",
                        tint = DiscordText,
                    )
                }
                Text(
                    text = "Профиль",
                    color = DiscordText,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.align(Alignment.Center),
                )
                IconButton(
                    onClick = onOpenSettings,
                    modifier = Modifier.align(Alignment.CenterEnd),
                ) {
                    Icon(
                        Icons.Default.Settings,
                        contentDescription = "Настройки профиля",
                        tint = DiscordText,
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding(),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(148.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(accent.copy(alpha = 0.4f)),
                    ) {
                        if (bannerUrl != null) {
                            val context = LocalContext.current
                            val h = with(LocalDensity.current) { 148.dp.roundToPx() }
                            val request =
                                remember(bannerUrl, h) {
                                    sizedImageRequest(context, bannerUrl, 1080, h)
                                }
                            AsyncImage(
                                model = request,
                                contentDescription = "Баннер",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .offset(y = 54.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        AvatarWithPresenceIndicator(
                            name = visibleName,
                            avatarUrl = avatarUrl,
                            avatarColor = accent,
                            status = null,
                            size = 108.dp,
                            showIndicator = false,
                            displayInitial = initial,
                            avatarDecoration = user?.avatarDecoration,
                            decorationPreviewSizeDp = 172.dp,
                        )
                    }
                }

                Spacer(modifier = Modifier.height(62.dp))

                UserNameplate(
                    nameplate = user?.nameplate,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                ) {
                    Text(
                        text = visibleName,
                        color = DiscordText,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                if (loginUsername.isNotBlank()) {
                    Text(
                        text = "@$loginUsername",
                        color = DiscordTextSecondary,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = user?.email ?: "Нет email",
                    color = DiscordTextSecondary,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                )

                Spacer(modifier = Modifier.height(20.dp))

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = DiscordModalCard,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                        ) {
                            Text(
                                text = "ID пользователя",
                                color = DiscordTextSecondary,
                                fontSize = 13.sp,
                            )
                            Text(
                                text = user?.id ?: "—",
                                color = DiscordText,
                                fontSize = 15.sp,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable(onClick = onOpenSettings),
                        color = DiscordModalCard,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = "Изменить аватар и баннер",
                                color = DiscordAccent,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                            )
                            Icon(
                                Icons.Default.Settings,
                                contentDescription = null,
                                tint = DiscordTextSecondary,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

private fun parseAvatarColor(hex: String?): Color {
    val raw = hex?.trim()?.takeIf { it.isNotEmpty() } ?: return Color(0xFF5865F2)
    val withHash = if (raw.startsWith("#")) raw else "#$raw"
    return try {
        Color(AndroidColor.parseColor(withHash))
    } catch (_: Exception) {
        Color(0xFF5865F2)
    }
}
