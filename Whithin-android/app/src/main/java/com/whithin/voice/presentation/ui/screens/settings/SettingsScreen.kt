package com.whithin.voice.presentation.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.outlined.Headset
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.data.model.PresenceStatus
import com.whithin.voice.presentation.ui.components.AppText as Text
import com.whithin.voice.presentation.ui.media.resolveServerIconUrl
import com.whithin.voice.presentation.ui.theme.AppThemePresets
import androidx.compose.foundation.layout.navigationBarsPadding
import com.whithin.voice.presentation.ui.theme.DiscordError
import com.whithin.voice.presentation.ui.theme.DiscordOutline
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.presentation.viewmodel.SettingsViewModel
import com.whithin.voice.util.UserDisplayNames
import com.whithin.voice.util.visibleName
import kotlinx.coroutines.launch

enum class SettingsTab(
    val label: String,
    val icon: ImageVector,
) {
    ACCOUNT("Аккаунт", Icons.Outlined.Person),
    APPEARANCE("Оформление", Icons.Outlined.Palette),
    AUDIO("Аудио", Icons.Outlined.Headset),
    INTERFACE("Интерфейс", Icons.Outlined.Tune),
    NOTIFICATIONS("Уведомления", Icons.Outlined.Notifications),
}

private val AccentPresets = listOf(
    "#5865F2", "#EB459E", "#57F287", "#FEE75C",
    "#ED4245", "#FAA61A", "#00B0F4", "#9B59B6",
)

private val BannerPresets = listOf(
    "#5865F2", "#EB459E", "#1ABC9C", "#2C3E50",
    "#E67E22", "#8E44AD", "#16A085", "#C0392B",
)

@Composable
fun SettingsScreen(
    authViewModel: AuthViewModel,
    onBack: () -> Unit,
    onScanQrClick: () -> Unit = {},
    settingsViewModel: SettingsViewModel = hiltViewModel(),
) {
    var selectedTab by remember { mutableStateOf<SettingsTab?>(null) }
    val authState by authViewModel.uiState.collectAsUiState()
    val appSettings by settingsViewModel.settings.collectAsUiState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(authState.profileSuccessHint, authState.profileErrorHint) {
        authState.profileErrorHint?.let {
            snackbarHostState.showSnackbar(it)
            authViewModel.consumeProfileHints()
        } ?: authState.profileSuccessHint?.let {
            snackbarHostState.showSnackbar(it)
            authViewModel.consumeProfileHints()
        }
    }

    LaunchedEffect(authState.accountActionMessage, authState.accountActionError) {
        authState.accountActionError?.let {
            snackbarHostState.showSnackbar(it)
            authViewModel.consumeAccountActionHints()
        } ?: authState.accountActionMessage?.let {
            snackbarHostState.showSnackbar(it)
            authViewModel.consumeAccountActionHints()
        }
    }

    BackHandler(enabled = selectedTab != null) {
        selectedTab = null
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(Modifier.fillMaxSize()) {
            when (val tab = selectedTab) {
                null -> SettingsCategoryList(
                    visibleName = authState.user?.visibleName().orEmpty(),
                    loginUsername = authState.user?.username.orEmpty(),
                    onBack = onBack,
                    onSelect = { selectedTab = it },
                )

                else -> SettingsCategoryDetail(
                    tab = tab,
                    authState = authState,
                    appSettings = appSettings,
                    authViewModel = authViewModel,
                    settingsViewModel = settingsViewModel,
                    onScanQrClick = onScanQrClick,
                    onBackToCategories = { selectedTab = null },
                    onValidationError = { msg ->
                        scope.launch { snackbarHostState.showSnackbar(msg) }
                    },
                )
            }

            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

@Composable
private fun SettingsCategoryList(
    visibleName: String,
    loginUsername: String,
    onBack: () -> Unit,
    onSelect: (SettingsTab) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        SettingsTopBar(
            title = "Настройки",
            onBack = onBack,
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SettingsTab.entries.forEach { tab ->
                SettingsCategoryRow(tab = tab, onClick = { onSelect(tab) })
            }
        }

        Spacer(Modifier.weight(1f))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = visibleName.ifBlank { "Пользователь" }.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold,
                )
            }
            Column {
                Text(
                    text = visibleName.ifBlank { "Пользователь" },
                    color = MaterialTheme.colorScheme.onBackground,
                    fontSize = 14.sp,
                    maxLines = 1,
                )
                if (loginUsername.isNotBlank()) {
                    Text(
                        text = "@$loginUsername",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 12.sp,
                        maxLines = 1,
                    )
                }
                Text(
                    text = "Выберите раздел настроек",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
private fun SettingsCategoryRow(
    tab: SettingsTab,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(
                tab.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp),
            )
            Text(
                text = tab.label,
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SettingsCategoryDetail(
    tab: SettingsTab,
    authState: com.whithin.voice.presentation.viewmodel.AuthUiState,
    appSettings: com.whithin.voice.data.local.AppSettings,
    authViewModel: AuthViewModel,
    settingsViewModel: SettingsViewModel,
    onScanQrClick: () -> Unit,
    onBackToCategories: () -> Unit,
    onValidationError: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        SettingsTopBar(title = tab.label, onBack = onBackToCategories)

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .navigationBarsPadding(),
        ) {
            when (tab) {
                SettingsTab.ACCOUNT -> SettingsAccountTab(
                    authState = authState,
                    authViewModel = authViewModel,
                    onScanQrClick = onScanQrClick,
                    onLogout = { authViewModel.logout() },
                    onValidationError = onValidationError,
                )
                SettingsTab.APPEARANCE -> SettingsAppearanceTab(
                    authState = authState,
                    authViewModel = authViewModel,
                )
                SettingsTab.AUDIO -> SettingsAudioTab(
                    noiseSuppression = appSettings.noiseSuppression,
                    onNoiseSuppressionChange = settingsViewModel::setNoiseSuppression,
                )
                SettingsTab.INTERFACE -> SettingsInterfaceTab(
                    themePresetId = appSettings.themePresetId,
                    onThemeChange = settingsViewModel::setThemePresetId,
                )
                SettingsTab.NOTIFICATIONS -> SettingsNotificationsTab(
                    inAppEnabled = appSettings.inAppNotificationsEnabled,
                    soundEnabled = appSettings.soundNotificationsEnabled,
                    volume = appSettings.notificationSoundVolume,
                    onInAppChange = settingsViewModel::setInAppNotificationsEnabled,
                    onSoundChange = settingsViewModel::setSoundNotificationsEnabled,
                    onVolumeChange = settingsViewModel::setNotificationSoundVolume,
                )
            }
        }
    }
}

@Composable
private fun SettingsTopBar(
    title: String,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Назад",
                tint = MaterialTheme.colorScheme.onBackground,
            )
        }
        Text(
            text = title,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
        )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
}

@Composable
private fun SettingsPanel(
    title: String,
    description: String? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(text = title, color = MaterialTheme.colorScheme.onBackground, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        description?.let {
            Text(text = it, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        }
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(12.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                content()
            }
        }
    }
}

@Composable
private fun SettingsToggleRow(
    label: String,
    description: String? = null,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(text = label, color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
            description?.let {
                Text(text = it, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
        )
    }
}

@Composable
private fun SettingsAccountTab(
    authState: com.whithin.voice.presentation.viewmodel.AuthUiState,
    authViewModel: AuthViewModel,
    onScanQrClick: () -> Unit,
    onLogout: () -> Unit,
    onValidationError: (String) -> Unit,
) {
    var newEmail by remember { mutableStateOf("") }
    var emailPassword by remember { mutableStateOf("") }
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var displayNameDraft by remember { mutableStateOf("") }

    LaunchedEffect(authState.user?.displayName, authState.user?.username) {
        displayNameDraft = authState.user?.displayName.orEmpty()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        SettingsPanel(title = "Логин") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Имя для входа", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                Text(
                    text = "@${authState.user?.username.orEmpty()}",
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = 14.sp,
                )
            }
            Text(
                text = "Используется при авторизации. Изменить нельзя.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )
        }

        SettingsPanel(
            title = "Ник",
            description = "Отображается в чатах и профиле. Если не задан — показывается логин.",
        ) {
            OutlinedTextField(
                value = displayNameDraft,
                onValueChange = {
                    if (it.length <= UserDisplayNames.MAX_LENGTH) {
                        displayNameDraft = it
                    }
                },
                label = { Text("Отображаемое имя") },
                placeholder = { Text(authState.user?.username.orEmpty()) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !authState.accountActionLoading,
            )
            OutlinedButton(
                onClick = { authViewModel.updateDisplayName(displayNameDraft) },
                enabled = !authState.accountActionLoading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (authState.accountActionLoading) "Сохранение…" else "Сохранить ник")
            }
        }

        SettingsPanel(title = "Email") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Текущий email", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                Text(
                    authState.user?.email.orEmpty().ifBlank { "—" },
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = 14.sp,
                )
            }
        }

        SettingsPanel(
            title = "Смена email",
            description = "На новый адрес придёт письмо с подтверждением.",
        ) {
            OutlinedTextField(
                value = newEmail,
                onValueChange = { newEmail = it },
                label = { Text("Новый email") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !authState.accountActionLoading,
            )
            OutlinedTextField(
                value = emailPassword,
                onValueChange = { emailPassword = it },
                label = { Text("Текущий пароль") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                enabled = !authState.accountActionLoading,
            )
            OutlinedButton(
                onClick = {
                    if (newEmail.isNotBlank() && emailPassword.isNotBlank()) {
                        authViewModel.changeEmail(newEmail.trim(), emailPassword)
                    } else {
                        onValidationError("Заполните email и пароль")
                    }
                },
                enabled = !authState.accountActionLoading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (authState.accountActionLoading) "Отправка…" else "Сменить email")
            }
        }

        SettingsPanel(
            title = "Смена пароля",
            description = "После смены пароля потребуется подтверждение по email.",
        ) {
            OutlinedTextField(
                value = currentPassword,
                onValueChange = { currentPassword = it },
                label = { Text("Текущий пароль") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                enabled = !authState.accountActionLoading,
            )
            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = { Text("Новый пароль") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                enabled = !authState.accountActionLoading,
            )
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it },
                label = { Text("Повторите новый пароль") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                enabled = !authState.accountActionLoading,
            )
            OutlinedButton(
                onClick = {
                    when {
                        currentPassword.isBlank() -> onValidationError("Укажите текущий пароль")
                        newPassword.length < 6 -> onValidationError("Новый пароль — минимум 6 символов")
                        newPassword != confirmPassword -> onValidationError("Пароли не совпадают")
                        else -> authViewModel.changePassword(currentPassword, newPassword)
                    }
                },
                enabled = !authState.accountActionLoading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (authState.accountActionLoading) "Отправка…" else "Сменить пароль")
            }
        }

        SettingsPanel(
            title = "Whithin Web",
            description = "Отсканируйте QR-код на сайте, чтобы войти в аккаунт с телефона.",
        ) {
            OutlinedButton(
                onClick = onScanQrClick,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    Icons.Default.QrCode,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text("Сканировать QR-код")
            }
        }

        SettingsPanel(title = "Сессия") {
            TextButton(onClick = onLogout) {
                Text("Выйти из аккаунта", color = DiscordError)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SettingsAppearanceTab(
    authState: com.whithin.voice.presentation.viewmodel.AuthUiState,
    authViewModel: AuthViewModel,
) {
    val pickAvatar = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { authViewModel.uploadAvatarFromUri(it) }
    }
    val pickBanner = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { authViewModel.uploadBannerFromUri(it) }
    }

    val user = authState.user
    val accentColor = user?.avatarColor?.takeIf { it.isNotBlank() } ?: "#5865F2"
    val bannerRaw = user?.bannerUrl?.trim().orEmpty()
    val bannerIsColor = bannerRaw.startsWith("#")
    val bannerColor = if (bannerIsColor) bannerRaw else accentColor
    val bannerImageUrl = if (!bannerIsColor && bannerRaw.isNotEmpty()) {
        resolveServerIconUrl(bannerRaw)
    } else null
    val avatarUrl = resolveServerIconUrl(user?.avatarUrl)
    val selectedStatus = PresenceStatus.from(authState.currentStatus)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        SettingsPanel(title = "Оформление профиля") {
            Text(
                text = "JPEG, PNG, WebP или GIF. Аватар до 5 МБ, баннер до 10 МБ.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(88.dp)
                        .align(Alignment.TopCenter)
                        .clip(RoundedCornerShape(10.dp))
                        .background(parseColor(bannerColor)),
                ) {
                    bannerImageUrl?.let { url ->
                        val context = LocalContext.current
                        val h = with(LocalDensity.current) { 88.dp.roundToPx() }
                        val request =
                            remember(url, h) {
                                sizedImageRequest(context, url, 1080, h)
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
                        .align(Alignment.BottomStart)
                        .padding(start = 12.dp)
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(parseColor(accentColor))
                        .border(3.dp, MaterialTheme.colorScheme.surface, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    avatarUrl?.let { url ->
                        val context = LocalContext.current
                        val px = with(LocalDensity.current) { 56.dp.roundToPx() }
                        val request =
                            remember(url, px) {
                                sizedImageRequest(context, url, px)
                            }
                        AsyncImage(
                            model = request,
                            contentDescription = "Аватар",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    } ?: Text(
                        text = user?.visibleName()?.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = {
                        pickAvatar.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    enabled = !authState.profileVisualLoading,
                    modifier = Modifier.weight(1f),
                ) { Text("Аватар") }
                OutlinedButton(
                    onClick = {
                        pickBanner.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    enabled = !authState.profileVisualLoading,
                    modifier = Modifier.weight(1f),
                ) { Text("Баннер") }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (user?.avatarUrl != null) {
                    TextButton(
                        onClick = { authViewModel.removeAvatar() },
                        enabled = !authState.profileVisualLoading,
                    ) { Text("Удалить аватар", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                if (bannerRaw.isNotEmpty()) {
                    TextButton(
                        onClick = { authViewModel.removeBanner() },
                        enabled = !authState.profileVisualLoading,
                    ) { Text("Удалить баннер", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }

            if (authState.profileVisualLoading) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text("Загрузка…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        SettingsPanel(title = "Цвет акцента") {
            ColorPresetGrid(
                presets = AccentPresets,
                selected = accentColor,
                onSelect = authViewModel::updateAvatarColor,
                enabled = !authState.profileVisualLoading,
            )
        }

        SettingsPanel(title = "Цвет баннера") {
            ColorPresetGrid(
                presets = BannerPresets,
                selected = if (bannerIsColor) bannerRaw else null,
                onSelect = authViewModel::updateBannerColor,
                enabled = !authState.profileVisualLoading,
            )
        }

        SettingsPanel(title = "Статус") {
            PresenceStatus.entries.forEach { status ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { authViewModel.updateStatus(status) },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = status == selectedStatus, onClick = { authViewModel.updateStatus(status) })
                    Text(status.label, color = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColorPresetGrid(
    presets: List<String>,
    selected: String?,
    onSelect: (String) -> Unit,
    enabled: Boolean,
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        presets.forEach { hex ->
            val color = parseColor(hex)
            val isSelected = selected?.equals(hex, ignoreCase = true) == true
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(color)
                    .border(
                        width = if (isSelected) 2.dp else 1.dp,
                        color = if (isSelected) MaterialTheme.colorScheme.onSurface else DiscordOutline,
                        shape = CircleShape,
                    )
                    .clickable(enabled = enabled) { onSelect(hex) },
                contentAlignment = Alignment.Center,
            ) {
                if (isSelected) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
private fun SettingsAudioTab(
    noiseSuppression: Boolean,
    onNoiseSuppressionChange: (Boolean) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        SettingsPanel(title = "Микрофон") {
            SettingsToggleRow(
                label = "Подавление шума (RNNoise)",
                description = "Тот же алгоритм, что на сайте: убирает фоновый шум с микрофона во время звонков. Также доступно в выборе устройства вывода в звонке.",
                checked = noiseSuppression,
                onCheckedChange = onNoiseSuppressionChange,
            )
        }

        SettingsPanel(
            title = "Громкость участников",
            description = "Сохранённые уровни применяются при следующем звонке с участником.",
        ) {
            Text(
                text = "Настройка громкости отдельных участников будет доступна в звонке.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsInterfaceTab(
    themePresetId: String,
    onThemeChange: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedPreset = AppThemePresets.find(themePresetId) ?: AppThemePresets.all.first()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        SettingsPanel(
            title = "Тема",
            description = "Внешний вид интерфейса приложения.",
        ) {
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it },
            ) {
                OutlinedTextField(
                    value = selectedPreset.name,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Тема оформления") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false },
                ) {
                    AppThemePresets.all.forEach { preset ->
                        DropdownMenuItem(
                            text = { Text(preset.name) },
                            onClick = {
                                onThemeChange(preset.id)
                                expanded = false
                            },
                        )
                    }
                }
            }
            if (selectedPreset.description.isNotBlank()) {
                Text(selectedPreset.description, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun SettingsNotificationsTab(
    inAppEnabled: Boolean,
    soundEnabled: Boolean,
    volume: Int,
    onInAppChange: (Boolean) -> Unit,
    onSoundChange: (Boolean) -> Unit,
    onVolumeChange: (Int) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        SettingsPanel(title = "Уведомления") {
            SettingsToggleRow(
                label = "Push-уведомления",
                description = "Показывать уведомления о новых сообщениях, когда приложение в фоне.",
                checked = inAppEnabled,
                onCheckedChange = onInAppChange,
            )
            SettingsToggleRow(
                label = "Звук уведомлений",
                description = "Звуковой сигнал при новых сообщениях.",
                checked = soundEnabled,
                onCheckedChange = onSoundChange,
                enabled = inAppEnabled,
            )
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Громкость уведомлений",
                    color = if (inAppEnabled && soundEnabled) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 14.sp,
                )
                Text(
                    text = "Насколько громко воспроизводить звук нового сообщения.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Slider(
                        value = volume.toFloat(),
                        onValueChange = { onVolumeChange(it.toInt()) },
                        valueRange = 0f..100f,
                        enabled = inAppEnabled && soundEnabled,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = "$volume%",
                        color = Color.White,
                        modifier = Modifier.width(44.dp),
                        fontSize = 13.sp,
                    )
                }
            }
            Text(
                text = "Позицию уведомлений на экране задаёт система Android.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )
        }
    }
}

private fun parseColor(hex: String): Color =
    runCatching { Color(android.graphics.Color.parseColor(hex)) }
        .getOrDefault(Color(0xFF5865F2))
