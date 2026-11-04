package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.data.model.PresenceStatus
import com.whithin.voice.data.model.ServerDetail
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordModalCard
import com.whithin.voice.presentation.ui.theme.DiscordSuccess
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.viewmodel.ServerSetupProgress
import com.whithin.voice.presentation.viewmodel.buildServerSetupProgress

private val SheetCardShape = RoundedCornerShape(16.dp)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerContextMenuBottomSheet(
    server: ServerDetail,
    memberCount: Int,
    onlineCount: Int,
    isMembersLoading: Boolean,
    channelCount: Int,
    canManageServer: Boolean,
    canManageChannels: Boolean,
    canCreateInvites: Boolean,
    isOwner: Boolean,
    onDismiss: () -> Unit,
    onInvite: () -> Unit,
    onOpenSettings: () -> Unit,
    onCreateChannel: () -> Unit,
    onCreateCategory: () -> Unit,
    onSetupContinue: () -> Unit,
    onLeave: () -> Unit,
    onDelete: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val avatarUrl = resolveServerIconUrl(server.avatarPathValue)
    val serverInitial = server.nameValue.firstOrNull()?.uppercaseChar()?.toString() ?: "S"
    val setupProgress = remember(server, memberCount, channelCount, canManageServer) {
        buildServerSetupProgress(server, memberCount, channelCount, canManageServer)
    }
    val accent = DiscordAccent
    val sheetBackground = DiscordModalCard
    val actionCircleBackground = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = sheetBackground,
        dragHandle = { ServerMenuDragHandle() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(accent),
                    contentAlignment = Alignment.Center,
                ) {
                    if (avatarUrl != null) {
                        val context = LocalContext.current
                        val px = with(LocalDensity.current) { 52.dp.roundToPx() }
                        val request =
                            remember(avatarUrl, px) {
                                sizedImageRequest(context, avatarUrl, px)
                            }
                        AsyncImage(
                            model = request,
                            contentDescription = null,
                            modifier = Modifier.fillMaxWidth(),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Text(
                            text = serverInitial,
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = server.nameValue,
                        color = DiscordText,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(4.dp))
                    if (isMembersLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = DiscordTextSecondary,
                        )
                    } else {
                        ServerPresenceStats(
                            onlineCount = onlineCount,
                            memberCount = memberCount,
                        )
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                QuickActionButton(
                    icon = Icons.Default.WorkspacePremium,
                    label = "Буст",
                    circleBackground = actionCircleBackground,
                    tint = MaterialTheme.colorScheme.secondary.copy(alpha = 0.85f),
                    enabled = false,
                    onClick = {},
                )
                if (canCreateInvites) {
                    QuickActionButton(
                        icon = Icons.Default.PersonAdd,
                        label = "Пригласить",
                        circleBackground = actionCircleBackground,
                        tint = DiscordText,
                        onClick = {
                            onDismiss()
                            onInvite()
                        },
                    )
                }
                QuickActionButton(
                    icon = Icons.Default.Notifications,
                    label = "Уведомления",
                    circleBackground = actionCircleBackground,
                    enabled = false,
                    onClick = {},
                )
                QuickActionButton(
                    icon = Icons.Default.Settings,
                    label = "Настройки",
                    circleBackground = actionCircleBackground,
                    tint = DiscordText,
                    onClick = {
                        onDismiss()
                        onOpenSettings()
                    },
                )
            }

            MenuCard {
                Text(
                    text = "Пометить как прочитанное",
                    color = DiscordTextSecondary.copy(alpha = 0.55f),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = false) {}
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                )
            }

            if (setupProgress != null) {
                MenuCard(
                    modifier = Modifier.clickable {
                        onDismiss()
                        onSetupContinue()
                    },
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Продолжить настройку сервера",
                                color = DiscordText,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = setupProgress.stepLabel,
                                color = DiscordTextSecondary,
                                fontSize = 13.sp,
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = DiscordTextSecondary,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                    LinearProgressIndicator(
                        progress = { setupProgress.progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .padding(bottom = 14.dp)
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = accent,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant,
                    )
                }
            }

            MenuCard {
                if (canManageChannels) {
                    MenuListItem(
                        title = "Создать канал",
                        onClick = {
                            onDismiss()
                            onCreateChannel()
                        },
                    )
                    MenuDivider()
                    MenuListItem(
                        title = "Создать категорию",
                        onClick = {
                            onDismiss()
                            onCreateCategory()
                        },
                    )
                }
                if (!isOwner) {
                    if (canManageChannels) MenuDivider()
                    MenuListItem(
                        title = "Покинуть сервер",
                        color = DiscordError,
                        onClick = {
                            onDismiss()
                            onLeave()
                        },
                    )
                }
                if (isOwner) {
                    if (canManageChannels) MenuDivider()
                    MenuListItem(
                        title = "Удалить сервер",
                        color = DiscordError,
                        onClick = {
                            onDismiss()
                            onDelete()
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ServerPresenceStats(
    onlineCount: Int,
    memberCount: Int,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(DiscordSuccess),
            )
            Text(
                text = formatOnlineLabel(onlineCount),
                color = DiscordTextSecondary,
                fontSize = 13.sp,
            )
        }
        Text("•", color = DiscordTextSecondary, fontSize = 13.sp)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(DiscordTextSecondary.copy(alpha = 0.55f)),
            )
            Text(
                text = formatMemberLabel(memberCount),
                color = DiscordTextSecondary,
                fontSize = 13.sp,
            )
        }
    }
}

@Composable
private fun QuickActionButton(
    icon: ImageVector,
    label: String,
    circleBackground: Color,
    tint: Color = DiscordText,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .width(72.dp)
            .clickable(enabled = enabled, onClick = onClick),
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(circleBackground),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (enabled) tint else tint.copy(alpha = 0.35f),
                modifier = Modifier.size(22.dp),
            )
        }
        Text(
            text = label,
            color = if (enabled) DiscordTextSecondary else DiscordTextSecondary.copy(alpha = 0.45f),
            fontSize = 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun MenuCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(SheetCardShape)
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.55f)),
    ) {
        content()
    }
}

@Composable
private fun MenuListItem(
    title: String,
    color: Color = DiscordText,
    onClick: () -> Unit,
) {
    Text(
        text = title,
        color = color,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    )
}

@Composable
private fun MenuDivider() {
    HorizontalDivider(
        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f),
        thickness = 0.5.dp,
    )
}

@Composable
private fun ServerMenuDragHandle() {
    Box(
        modifier = Modifier
            .padding(vertical = 10.dp)
            .size(width = 36.dp, height = 4.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)),
    )
}

private fun formatOnlineLabel(count: Int): String =
    when (count) {
        0 -> "0 в сети"
        1 -> "1 в сети"
        else -> "$count в сети"
    }

private fun formatMemberLabel(count: Int): String =
    when (count) {
        0 -> "0 участников"
        1 -> "1 участник"
        in 2..4 -> "$count участника"
        else -> "$count участников"
    }

fun countOnlineMembers(members: List<ServerMemberInfo>): Int =
    members.count { member ->
        val status = PresenceStatus.from(member.userStatus ?: member.userStatusAlt)
        status == PresenceStatus.ONLINE ||
            status == PresenceStatus.INACTIVE ||
            status == PresenceStatus.DO_NOT_DISTURB
    }
