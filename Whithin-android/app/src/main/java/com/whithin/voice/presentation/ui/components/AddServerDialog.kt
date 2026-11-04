package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ColorLens
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.whithin.voice.domain.model.User
import com.whithin.voice.data.model.Server
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordBackground
import com.whithin.voice.presentation.ui.theme.DiscordDarker
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.media.resolveAvatarUrl
import com.whithin.voice.presentation.ui.theme.AppThemePreset
import com.whithin.voice.presentation.ui.theme.AppThemePresets
import com.whithin.voice.presentation.ui.theme.IsNeoVectorheartTheme
import com.whithin.voice.presentation.ui.theme.NeoVectorheartPanelBorder

@Composable
fun AddServerDialog(
    publicServers: List<Server>,
    memberServerIds: Set<String>,
    isLoading: Boolean,
    error: String?,
    joiningServerId: String?,
    activeThemePresetId: String,
    activeAvatarDecoration: String?,
    currentUser: User?,
    avatarDecorationBusy: Boolean,
    onDismiss: () -> Unit,
    onRetry: () -> Unit,
    onJoinServer: (Server) -> Unit,
    onApplyTheme: (String) -> Unit,
    onApplyAvatarDecoration: (String) -> Unit,
    onRemoveAvatarDecoration: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var searchQuery by remember { mutableStateOf("") }
    var activeSection by remember { mutableStateOf(DiscoverySection.Servers) }
    val isNeoVectorheart = IsNeoVectorheartTheme
    val normalizedQuery = remember(searchQuery) { searchQuery.trim().lowercase() }
    LaunchedEffect(Unit) {
        if (publicServers.isEmpty() && !isLoading && error.isNullOrBlank()) {
            onRetry()
        }
    }
    val serverSearchEntries =
        remember(publicServers) {
            publicServers.map { server ->
                Triple(
                    server,
                    server.nameValue.lowercase(),
                    server.descriptionValue.orEmpty().lowercase(),
                )
            }
        }
    val filteredServers =
        remember(serverSearchEntries, normalizedQuery) {
            if (normalizedQuery.isBlank()) {
                publicServers
            } else {
                serverSearchEntries
                    .asSequence()
                    .filter { (_, nameLower, descriptionLower) ->
                        nameLower.contains(normalizedQuery) || descriptionLower.contains(normalizedQuery)
                    }
                    .map { (server, _, _) -> server }
                    .toList()
            }
        }

    val themeSearchEntries =
        remember {
            AppThemePresets.all.map { preset ->
                Triple(
                    preset,
                    preset.name.lowercase(),
                    preset.description.lowercase(),
                )
            }
        }
    val filteredThemes =
        remember(themeSearchEntries, normalizedQuery) {
            if (normalizedQuery.isBlank()) {
                AppThemePresets.all
            } else {
                themeSearchEntries
                    .asSequence()
                    .filter { (_, nameLower, descriptionLower) ->
                        nameLower.contains(normalizedQuery) || descriptionLower.contains(normalizedQuery)
                    }
                    .map { (preset, _, _) -> preset }
                    .toList()
            }
        }

    val decorationSearchEntries =
        remember {
            DiscoveryAvatarDecorations.map { item ->
                Triple(
                    item,
                    item.name.lowercase(),
                    item.description.lowercase(),
                )
            }
        }
    val filteredDecorations =
        remember(decorationSearchEntries, normalizedQuery) {
            if (normalizedQuery.isBlank()) {
                DiscoveryAvatarDecorations
            } else {
                decorationSearchEntries
                    .asSequence()
                    .filter { (_, nameLower, descriptionLower) ->
                        nameLower.contains(normalizedQuery) || descriptionLower.contains(normalizedQuery)
                    }
                    .map { (item, _, _) -> item }
                    .toList()
            }
        }
    val searchPlaceholder =
        when (activeSection) {
            DiscoverySection.Servers -> "Поиск по названию или описанию..."
            DiscoverySection.Themes -> "Поиск по названию или описанию темы..."
            DiscoverySection.Decorations -> "Поиск по названию рамки..."
        }
    val sectionSubtitle =
        when (activeSection) {
            DiscoverySection.Servers -> "Публичные сообщества Whithin"
            DiscoverySection.Themes -> "Темы интерфейса приложения"
            DiscoverySection.Decorations -> "Рамки профиля пользователя"
        }
    val countText =
        when (activeSection) {
            DiscoverySection.Servers -> "${filteredServers.size} ${serverCountWord(filteredServers.size)}"
            DiscoverySection.Themes -> "${filteredThemes.size} ${themeCountWord(filteredThemes.size)}"
            DiscoverySection.Decorations -> "${filteredDecorations.size} ${frameCountWord(filteredDecorations.size)}"
        }

    SwipeBackContainer(
        onBack = onDismiss,
        modifier = modifier,
    ) {
        Surface(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(DiscordDarker)
                    .statusBarsPadding()
                    .navigationBarsPadding(),
            color = DiscordDarker,
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                        .then(
                            if (isNeoVectorheart) {
                                Modifier.border(
                                    width = 1.dp,
                                    color = NeoVectorheartPanelBorder,
                                    shape = CutCornerShape(topStart = 16.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 16.dp),
                                )
                            } else {
                                Modifier
                            },
                        ),
                    color = DiscordBackground,
                    shape =
                        if (isNeoVectorheart) {
                            CutCornerShape(topStart = 16.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 16.dp)
                        } else {
                            RoundedCornerShape(16.dp)
                        },
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            IconButton(onClick = onDismiss) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Назад",
                                    tint = DiscordText,
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Обнаружение",
                                    color = DiscordText,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    scrambleOnce = false,
                                )
                                Text(
                                    text = sectionSubtitle,
                                    color = DiscordTextSecondary,
                                    fontSize = 12.sp,
                                    scrambleOnce = false,
                                )
                            }
                        }
                        FloatingPillTabBar(
                            tabs = listOf("Серверы", "Темы", "Рамки"),
                            selectedIndex =
                                when (activeSection) {
                                    DiscoverySection.Servers -> 0
                                    DiscoverySection.Themes -> 1
                                    DiscoverySection.Decorations -> 2
                                },
                            onSelect = { idx ->
                                activeSection =
                                    when (idx) {
                                        1 -> DiscoverySection.Themes
                                        2 -> DiscoverySection.Decorations
                                        else -> DiscoverySection.Servers
                                    }
                            },
                            modifier = Modifier.padding(top = 2.dp),
                        )
                        TextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 6.dp, vertical = 6.dp),
                            placeholder = {
                                Text(searchPlaceholder, color = DiscordTextSecondary, scrambleOnce = false)
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = null,
                                    tint = DiscordTextSecondary,
                                )
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(24.dp),
                            colors =
                                TextFieldDefaults.colors(
                                    focusedContainerColor = DiscordDarker,
                                    unfocusedContainerColor = DiscordDarker,
                                    disabledContainerColor = DiscordDarker,
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                    disabledIndicatorColor = Color.Transparent,
                                    cursorColor = DiscordAccent,
                                    focusedTextColor = DiscordText,
                                    unfocusedTextColor = DiscordText,
                                ),
                        )
                        if (!isLoading && error.isNullOrBlank()) {
                            Text(
                                text = countText,
                                color = DiscordTextSecondary,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 2.dp),
                                scrambleOnce = false,
                            )
                        }
                    }
                }

                if (!error.isNullOrBlank()) {
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                        scrambleOnce = false,
                    )
                }

                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    when {
                        isLoading && activeSection == DiscoverySection.Servers && publicServers.isEmpty() -> {
                            CircularProgressIndicator(
                                modifier = Modifier.align(Alignment.Center),
                                color = DiscordAccent,
                            )
                        }
                        activeSection == DiscoverySection.Servers && filteredServers.isEmpty() -> {
                            Column(
                                modifier =
                                    Modifier
                                        .align(Alignment.Center)
                                        .padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Explore,
                                    contentDescription = null,
                                    tint = DiscordTextSecondary.copy(alpha = 0.45f),
                                    modifier = Modifier.size(44.dp),
                                )
                                Text(
                                    text =
                                        if (searchQuery.isNotBlank()) {
                                            "Серверы не найдены"
                                        } else {
                                            "Публичных серверов пока нет"
                                        },
                                    color = DiscordTextSecondary,
                                    scrambleOnce = false,
                                )
                                if (!isLoading) {
                                    OutlinedButton(onClick = onRetry) {
                                        Text("Обновить", scrambleOnce = false)
                                    }
                                }
                            }
                        }
                        activeSection == DiscoverySection.Themes && filteredThemes.isEmpty() -> {
                            DiscoveryEmptyState(
                                title = "Темы не найдены",
                                subtitle = "Попробуйте другой запрос или очистите поиск",
                                icon = Icons.Default.ColorLens,
                            )
                        }
                        activeSection == DiscoverySection.Decorations && filteredDecorations.isEmpty() -> {
                            DiscoveryEmptyState(
                                title = "Рамки не найдены",
                                subtitle = "Попробуйте другой запрос или очистите поиск",
                                icon = Icons.Default.AutoAwesome,
                            )
                        }
                        else -> {
                            LazyColumn(modifier = Modifier.fillMaxSize()) {
                                when (activeSection) {
                                    DiscoverySection.Servers -> {
                                        items(
                                            items = filteredServers,
                                            key = { it.serverIdValue },
                                        ) { server ->
                                            val serverId = server.serverIdValue
                                            val isMember =
                                                memberServerIds.contains(serverId.trim().lowercase())
                                            val isJoining = joiningServerId == serverId
                                            DiscoveryServerCard(
                                                server = server,
                                                isMember = isMember,
                                                isJoining = isJoining,
                                                onJoinServer = onJoinServer,
                                            )
                                        }
                                    }
                                    DiscoverySection.Themes -> {
                                        items(
                                            items = filteredThemes,
                                            key = { it.id },
                                        ) { preset ->
                                            DiscoveryThemeCard(
                                                preset = preset,
                                                isActive = preset.id == activeThemePresetId,
                                                onApply = onApplyTheme,
                                            )
                                        }
                                    }
                                    DiscoverySection.Decorations -> {
                                        items(
                                            items = filteredDecorations,
                                            key = { it.id },
                                        ) { frame ->
                                            DiscoveryAvatarDecorationCard(
                                                item = frame,
                                                currentUser = currentUser,
                                                activeAvatarDecoration = activeAvatarDecoration,
                                                isBusy = avatarDecorationBusy,
                                                onApply = onApplyAvatarDecoration,
                                                onRemove = onRemoveAvatarDecoration,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DiscoveryServerCard(
    server: Server,
    isMember: Boolean,
    isJoining: Boolean,
    onJoinServer: (Server) -> Unit,
) {
    val isNeoVectorheart = IsNeoVectorheartTheme
    val iconResolved = remember(server.iconUrlValue) { resolveServerIconUrl(server.iconUrlValue) }
    val bannerResolved = remember(server.bannerValue) { resolveServerIconUrl(server.bannerValue) }
    val bannerTint =
        remember(server.serverIdValue, server.nameValue, server.bannerColorValue) {
            server.bannerColorValue
                ?.let { raw ->
                    runCatching { Color(android.graphics.Color.parseColor(raw)) }.getOrNull()
                }
                ?: discoveryBannerColor(server.serverIdValue, server.nameValue)
        }
    val context = LocalContext.current
    val density = LocalDensity.current
    val bannerH = with(density) { 92.dp.roundToPx() }
    val iconPx = with(density) { 52.dp.roundToPx() }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 6.dp, vertical = 6.dp)
            .then(
                if (isNeoVectorheart) {
                    Modifier.border(
                        width = 1.dp,
                        color = NeoVectorheartPanelBorder,
                        shape = CutCornerShape(topStart = 14.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 14.dp),
                    )
                } else {
                    Modifier
                },
            ),
        colors = CardDefaults.cardColors(containerColor = DiscordBackground),
        shape =
            if (isNeoVectorheart) {
                CutCornerShape(topStart = 14.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 14.dp)
            } else {
                RoundedCornerShape(14.dp)
            },
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(92.dp)
                .background(bannerTint),
        ) {
            if (bannerResolved != null) {
                val bannerRequest =
                    remember(bannerResolved, bannerH) {
                        sizedImageRequest(context, bannerResolved, 1080, bannerH)
                    }
                AsyncImage(
                    model = bannerRequest,
                    contentDescription = "Баннер ${server.nameValue}",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.18f)),
            )
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .offset(x = 14.dp, y = 20.dp)
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(bannerTint)
                    .border(2.dp, DiscordBackground, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (iconResolved != null) {
                    val iconRequest =
                        remember(iconResolved, iconPx) {
                            sizedImageRequest(context, iconResolved, iconPx)
                        }
                    AsyncImage(
                        model = iconRequest,
                        contentDescription = server.nameValue,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    Text(
                        text = server.nameValue.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        scrambleOnce = false,
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(26.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = server.nameValue,
                    color = DiscordText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
                Icon(
                    imageVector = Icons.Default.Public,
                    contentDescription = null,
                    tint = DiscordTextSecondary,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    text = "Публичный",
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    scrambleOnce = false,
                )
            }
            Text(
                text = server.descriptionValue?.takeIf { it.isNotBlank() } ?: "Описание не указано",
                color = DiscordTextSecondary,
                fontSize = 13.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                scrambleOnce = false,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(
                        imageVector = Icons.Default.Groups,
                        contentDescription = null,
                        tint = DiscordTextSecondary,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        text = "${server.memberCountValue} ${memberCountWord(server.memberCountValue)}",
                        color = DiscordTextSecondary,
                        fontSize = 13.sp,
                        scrambleOnce = false,
                    )
                }
                when {
                    isJoining -> {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = DiscordAccent,
                            strokeWidth = 2.dp,
                        )
                    }
                    isMember -> {
                        OutlinedButton(onClick = {}, enabled = false) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = DiscordTextSecondary,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(modifier = Modifier.size(6.dp))
                            Text("Вы участник", scrambleOnce = false)
                        }
                    }
                    else -> {
                        Button(onClick = { onJoinServer(server) }) {
                            Text("Присоединиться", scrambleOnce = false)
                        }
                    }
                }
            }
        }
    }
}

private enum class DiscoverySection {
    Servers,
    Themes,
    Decorations,
}

private data class DiscoveryAvatarDecorationItem(
    val id: String,
    val path: String,
    val name: String,
    val description: String = "Новый вид для вашего аватара.",
)

private val DiscoveryAvatarDecorations =
    listOf(
        DiscoveryAvatarDecorationItem("1144305233707671573", "/avatar-frames/1144305233707671573.png", "Душа покидает тело"),
        DiscoveryAvatarDecorationItem("1144308439720394944", "/avatar-frames/1144308439720394944.png", "Злость"),
        DiscoveryAvatarDecorationItem("1157411984371880118", "/avatar-frames/1157411984371880118.png", "Аметистовый чокер"),
        DiscoveryAvatarDecorationItem("1157412388509864068", "/avatar-frames/1157412388509864068.png", "Викторианское кружево"),
        DiscoveryAvatarDecorationItem("1157412779335090267", "/avatar-frames/1157412779335090267.png", "Вдовья шляпа"),
        DiscoveryAvatarDecorationItem("1174459546748600481", "/avatar-frames/1174459546748600481.png", "Снежный шар"),
        DiscoveryAvatarDecorationItem("1174460780842856588", "/avatar-frames/1174460780842856588.png", "Гирлянда"),
        DiscoveryAvatarDecorationItem("1197344636558114986", "/avatar-frames/1197344636558114986.png", "Имплант"),
        DiscoveryAvatarDecorationItem("1216908559548289084", "/avatar-frames/1216908559548289084.png", "Змейка"),
        DiscoveryAvatarDecorationItem("1232072520249643028", "/avatar-frames/1232072520249643028.png", "НЛО"),
        DiscoveryAvatarDecorationItem("1245087968759382207", "/avatar-frames/1245087968759382207.png", "Прыжок зефирки"),
        DiscoveryAvatarDecorationItem("1245088023452975104", "/avatar-frames/1245088023452975104.png", "Змея и перекус"),
        DiscoveryAvatarDecorationItem("1252404753321689119", "/avatar-frames/1252404753321689119.png", "Джойстик"),
        DiscoveryAvatarDecorationItem("1262491137386614812", "/avatar-frames/1262491137386614812.png", "Осенние листья"),
        DiscoveryAvatarDecorationItem("1262491137394868308", "/avatar-frames/1262491137394868308.png", "Лесные листья"),
        DiscoveryAvatarDecorationItem("1262491137394868311", "/avatar-frames/1262491137394868311.png", "Алые листья"),
        DiscoveryAvatarDecorationItem("1262491690900656258", "/avatar-frames/1262491690900656258.png", "Лисья шапка"),
        DiscoveryAvatarDecorationItem("1262491690900656261", "/avatar-frames/1262491690900656261.png", "Каштановая лисья шапка"),
        DiscoveryAvatarDecorationItem("1262491690900656264", "/avatar-frames/1262491690900656264.png", "Снежная лисья шапка"),
        DiscoveryAvatarDecorationItem("1266160780928352268", "/avatar-frames/1266160780928352268.png", "Аврора"),
        DiscoveryAvatarDecorationItem("1266160780978556969", "/avatar-frames/1266160780978556969.png", "Шапка белого медведя"),
        DiscoveryAvatarDecorationItem("1293373563184877618", "/avatar-frames/1293373563184877618.png", "Фиолетовые кости", "Бросаем кости!"),
        DiscoveryAvatarDecorationItem("1306752744258011166", "/avatar-frames/1306752744258011166.png", "Аномалия", "Красиво. Невозможно. Неизбежно."),
        DiscoveryAvatarDecorationItem("1309668861704146984", "/avatar-frames/1309668861704146984.png", "Учёба", "Набор начинающего студента."),
        DiscoveryAvatarDecorationItem("1326333074132176916", "/avatar-frames/1326333074132176916.png", "Часы хранителя времени"),
        DiscoveryAvatarDecorationItem("1333278032852549705", "/avatar-frames/1333278032852549705.png", "Городские стены"),
        DiscoveryAvatarDecorationItem("1341506443613831168", "/avatar-frames/1341506443613831168.png", "Злость (розовая)"),
        DiscoveryAvatarDecorationItem("1341506443622219776", "/avatar-frames/1341506443622219776.png", "Злость (жёлтая)"),
        DiscoveryAvatarDecorationItem("1341506443659968512", "/avatar-frames/1341506443659968512.png", "Капли пота (бирюзовые)"),
        DiscoveryAvatarDecorationItem("1341506443664162817", "/avatar-frames/1341506443664162817.png", "Капли пота (розовые)"),
        DiscoveryAvatarDecorationItem("1341506443748048896", "/avatar-frames/1341506443748048896.png", "Энергия ки (зелёная)"),
        DiscoveryAvatarDecorationItem("1341506443756437504", "/avatar-frames/1341506443756437504.png", "Энергия ки (бирюзовая)"),
        DiscoveryAvatarDecorationItem("1341506443760631808", "/avatar-frames/1341506443760631808.png", "Энергия ки (синяя)"),
        DiscoveryAvatarDecorationItem("1341506443764826112", "/avatar-frames/1341506443764826112.png", "Энергия ки (фуксия)"),
        DiscoveryAvatarDecorationItem("1352407446391492660", "/avatar-frames/1352407446391492660.png", "Загрузка…"),
        DiscoveryAvatarDecorationItem("1387888352539312288", "/avatar-frames/1387888352539312288.png", "Туалет Skibidi"),
        DiscoveryAvatarDecorationItem("1387888352564478063", "/avatar-frames/1387888352564478063.png", "Спикервумен"),
        DiscoveryAvatarDecorationItem("1387888352589643896", "/avatar-frames/1387888352589643896.png", "ТВ-женщина"),
        DiscoveryAvatarDecorationItem("1387888352614809600", "/avatar-frames/1387888352614809600.png", "Глитч камерамена"),
        DiscoveryAvatarDecorationItem("1387888352639975484", "/avatar-frames/1387888352639975484.png", "Джаггернаут Астро"),
        DiscoveryAvatarDecorationItem("1402472280239509664", "/avatar-frames/1402472280239509664.png", "Неоновый капюшон с котом"),
        DiscoveryAvatarDecorationItem("1402472280440832041", "/avatar-frames/1402472280440832041.png", "Неоновый капюшон с котом (синий)"),
        DiscoveryAvatarDecorationItem("1409898407828520990", "/avatar-frames/1409898407828520990.png", "Астральная аура"),
        DiscoveryAvatarDecorationItem("1437881614087618601", "/avatar-frames/1437881614087618601.png", "Сетка Encom"),
        DiscoveryAvatarDecorationItem("1506049399703474186", "/avatar-frames/1506049399703474186.png", "Граффити-спрей"),
        DiscoveryAvatarDecorationItem("darkknight", "/avatar-frames/darkknight.webp", "darkknight", "Автор: yarix"),
    )

@Composable
private fun DiscoverySectionTabs(
    activeSection: DiscoverySection,
    onSectionSelected: (DiscoverySection) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.weight(1f)) {
            DiscoverySectionTab(
                title = "Серверы",
                icon = Icons.Default.Public,
                selected = activeSection == DiscoverySection.Servers,
                onClick = { onSectionSelected(DiscoverySection.Servers) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Box(Modifier.weight(1f)) {
            DiscoverySectionTab(
                title = "Темы",
                icon = Icons.Default.ColorLens,
                selected = activeSection == DiscoverySection.Themes,
                onClick = { onSectionSelected(DiscoverySection.Themes) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Box(Modifier.weight(1f)) {
            DiscoverySectionTab(
                title = "Рамки",
                icon = Icons.Default.AutoAwesome,
                selected = activeSection == DiscoverySection.Decorations,
                onClick = { onSectionSelected(DiscoverySection.Decorations) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun DiscoverySectionTab(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = if (selected) DiscordAccent.copy(alpha = 0.2f) else DiscordBackground,
        modifier = modifier,
    ) {
        TextButton(
            onClick = onClick,
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 10.dp),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (selected) DiscordAccent else DiscordTextSecondary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = title,
                color = if (selected) DiscordAccent else DiscordTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                scrambleOnce = false,
            )
        }
    }
}

@Composable
private fun DiscoveryThemeCard(
    preset: AppThemePreset,
    isActive: Boolean,
    onApply: (String) -> Unit,
) {
    val isNeoVectorheart = IsNeoVectorheartTheme
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 6.dp, vertical = 6.dp)
            .then(
                if (isNeoVectorheart) {
                    Modifier.border(
                        width = 1.dp,
                        color = NeoVectorheartPanelBorder,
                        shape = CutCornerShape(topStart = 14.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 14.dp),
                    )
                } else {
                    Modifier
                },
            ),
        colors = CardDefaults.cardColors(containerColor = DiscordBackground),
        shape =
            if (isNeoVectorheart) {
                CutCornerShape(topStart = 14.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 14.dp)
            } else {
                RoundedCornerShape(14.dp)
            },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            ThemePreview(preset = preset, modifier = Modifier.size(width = 88.dp, height = 56.dp))
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = preset.name,
                    color = DiscordText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
                Text(
                    text = preset.description.ifBlank { "Без описания" },
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
                if (isActive) {
                    Text(
                        text = "Используется",
                        color = DiscordAccent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        scrambleOnce = false,
                    )
                }
            }
            if (!isActive) {
                Button(onClick = { onApply(preset.id) }) {
                    Text("Применить", scrambleOnce = false)
                }
            }
        }
    }
}

@Composable
private fun ThemePreview(
    preset: AppThemePreset,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(preset.background),
    ) {
        Box(
            modifier = Modifier
                .width(28.dp)
                .fillMaxSize()
                .background(preset.serverListBackground),
        )
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.65f)
                    .height(7.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(preset.onBackground.copy(alpha = 0.35f)),
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.82f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(preset.onSurfaceVariant.copy(alpha = 0.34f)),
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.56f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(preset.onSurfaceVariant.copy(alpha = 0.28f)),
            )
            Box(
                modifier = Modifier
                    .width(36.dp)
                    .height(10.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(preset.primary),
            )
        }
    }
}

@Composable
private fun DiscoveryAvatarDecorationCard(
    item: DiscoveryAvatarDecorationItem,
    currentUser: User?,
    activeAvatarDecoration: String?,
    isBusy: Boolean,
    onApply: (String) -> Unit,
    onRemove: () -> Unit,
) {
    val isNeoVectorheart = IsNeoVectorheartTheme
    val activeNormalized = activeAvatarDecoration?.trim()?.lowercase().orEmpty()
    val itemNormalized = item.path.trim().lowercase()
    val isActive = activeNormalized == itemNormalized
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 6.dp, vertical = 6.dp)
            .then(
                if (isNeoVectorheart) {
                    Modifier.border(
                        width = 1.dp,
                        color = NeoVectorheartPanelBorder,
                        shape = CutCornerShape(topStart = 14.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 14.dp),
                    )
                } else {
                    Modifier
                },
            ),
        colors = CardDefaults.cardColors(containerColor = DiscordBackground),
        shape =
            if (isNeoVectorheart) {
                CutCornerShape(topStart = 14.dp, topEnd = 6.dp, bottomStart = 6.dp, bottomEnd = 14.dp)
            } else {
                RoundedCornerShape(14.dp)
            },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            val previewColor =
                runCatching {
                    Color(
                        android.graphics.Color.parseColor(
                            currentUser?.avatarColor?.takeIf { it.isNotBlank() } ?: "#5865F2",
                        ),
                    )
                }.getOrElse { DiscordAccent }
            AvatarWithPresenceIndicator(
                name = currentUser?.displayName ?: currentUser?.username ?: "Whithin",
                avatarUrl = resolveAvatarUrl(currentUser?.avatarUrl),
                avatarColor = previewColor,
                status = null,
                size = 60.dp,
                showIndicator = false,
                avatarDecoration = item.path,
                // Discovery list: animate only the active decoration.
                animateDecoration = isActive,
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = item.name,
                    color = DiscordText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
                if (isActive) {
                    Text(
                        text = "На профиле",
                        color = DiscordAccent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        scrambleOnce = false,
                    )
                }
                Text(
                    text = item.description,
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
            }
            if (isActive) {
                OutlinedButton(onClick = onRemove, enabled = !isBusy) {
                    Text("Снять", scrambleOnce = false)
                }
            } else {
                Button(onClick = { onApply(item.path) }, enabled = !isBusy) {
                    Text("Применить", scrambleOnce = false)
                }
            }
        }
    }
}

@Composable
private fun DiscoveryEmptyState(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = DiscordTextSecondary.copy(alpha = 0.45f),
            modifier = Modifier.size(44.dp),
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = title,
            color = DiscordText,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            scrambleOnce = false,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = subtitle,
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            scrambleOnce = false,
        )
    }
}

private fun serverCountWord(count: Int): String =
    when {
        count % 10 == 1 && count % 100 != 11 -> "сервер"
        count % 10 in 2..4 && count % 100 !in 12..14 -> "сервера"
        else -> "серверов"
    }

private fun memberCountWord(count: Int): String =
    when {
        count % 10 == 1 && count % 100 != 11 -> "участник"
        count % 10 in 2..4 && count % 100 !in 12..14 -> "участника"
        else -> "участников"
    }

private fun themeCountWord(count: Int): String =
    when {
        count % 10 == 1 && count % 100 != 11 -> "тема"
        count % 10 in 2..4 && count % 100 !in 12..14 -> "темы"
        else -> "тем"
    }

private fun frameCountWord(count: Int): String =
    when {
        count % 10 == 1 && count % 100 != 11 -> "рамка"
        count % 10 in 2..4 && count % 100 !in 12..14 -> "рамки"
        else -> "рамок"
    }

private fun discoveryBannerColor(serverId: String, fallbackName: String): Color {
    val seed = (serverId.ifBlank { fallbackName }).hashCode()
    val hue = ((seed and 0x7fffffff) % 360).toFloat()
    return Color.hsv(hue, 0.55f, 0.72f)
}
