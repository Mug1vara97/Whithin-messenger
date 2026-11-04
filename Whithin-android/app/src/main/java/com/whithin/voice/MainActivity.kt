package com.whithin.voice

import android.Manifest
import android.app.AlertDialog
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import com.whithin.voice.presentation.ui.theme.setupWhithinSystemBars
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.rememberNavController
import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.data.repository.FriendRepository
import com.whithin.voice.data.repository.PresenceRepository
import com.whithin.voice.data.repository.ServerRepository
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.presentation.ui.components.MinimizedCallBar
import com.whithin.voice.presentation.viewmodel.VoiceRoomViewModel
import com.whithin.voice.presentation.navigation.AppNavGraph
import com.whithin.voice.presentation.navigation.ConfirmLinkData
import com.whithin.voice.presentation.navigation.ConfirmLinkType
import com.whithin.voice.presentation.navigation.Screen
import com.whithin.voice.presentation.notifications.ChatNotificationManager
import com.whithin.voice.presentation.notifications.IncomingCallAcceptStore
import com.whithin.voice.presentation.notifications.IncomingCallRingingService
import com.whithin.voice.presentation.notifications.IncomingCallIntents
import com.whithin.voice.presentation.notifications.toLaunchData
import com.whithin.voice.presentation.notifications.PushNotificationIntents
import com.whithin.voice.presentation.notifications.PushNotificationTitles
import com.whithin.voice.presentation.share.ShareIntentParser
import com.whithin.voice.presentation.share.SharePayload
import javax.inject.Inject
import com.whithin.voice.presentation.qr.QrScannerCaptureActivity
import com.whithin.voice.data.local.AppSettingsStore
import com.whithin.voice.data.local.ColdStartBootstrap
import com.whithin.voice.data.signalr.NotificationHub
import com.whithin.voice.presentation.ui.components.ChatListSkeleton
import com.whithin.voice.presentation.ui.theme.AppThemePreset
import com.whithin.voice.presentation.ui.theme.AppThemePresets
import com.whithin.voice.presentation.ui.theme.updateWhithinSystemBars
import com.whithin.voice.presentation.ui.theme.VoiceTheme
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.presentation.viewmodel.AuthUiState
import com.whithin.voice.presentation.viewmodel.ChatListViewModel
import com.whithin.voice.util.SessionNetworkCoordinator
import com.whithin.voice.util.CALL_RING_TIMEOUT_MS
import com.whithin.voice.util.ChatCallSignalingState
import com.whithin.voice.util.OutgoingCallRingtone
import com.whithin.voice.util.visibleName
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import androidx.compose.runtime.snapshotFlow

private const val NAV_PREFS = "navigation_state"
private const val NAV_LAST_CHAT_ID = "last_chat_id"
private const val NAV_LAST_CHAT_NAME = "last_chat_name"
private const val LAUNCH_LOG_TAG = "WhithinLaunch"

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val pendingIncomingCall = mutableStateOf<IncomingCallLaunchData?>(null)
    /** Stays set until VoiceRoom is on the back stack — prevents launch route from flipping to chatList too early. */
    private val acceptedIncomingCall = mutableStateOf<IncomingCallLaunchData?>(null)
    /** Stays set until Chat is on the back stack — prevents launch route from flipping to chatList too early. */
    private val acceptedOpenChat = mutableStateOf<OpenChatLaunchData?>(null)
    private val pendingOpenFriends = mutableStateOf(false)
    private val pendingOpenChat = mutableStateOf<OpenChatLaunchData?>(null)
    private val pendingShareContent = mutableStateOf<SharePayload?>(null)
    private val pendingConfirmLink = mutableStateOf<ConfirmLinkData?>(null)
    private var didPromptFullScreenIntentPermission = false
    private val authViewModel: AuthViewModel by viewModels()

    @Inject
    lateinit var chatNotificationManager: ChatNotificationManager

    @Inject
    lateinit var chatRepository: ChatRepository

    @Inject
    lateinit var serverRepository: ServerRepository

    @Inject
    lateinit var friendRepository: FriendRepository

    @Inject
    lateinit var presenceRepository: PresenceRepository

    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var appSettingsStore: AppSettingsStore

    @Inject
    lateinit var coldStartBootstrap: ColdStartBootstrap

    @Inject
    lateinit var notificationHub: NotificationHub

    @Inject
    lateinit var liveKitService: com.whithin.voice.presentation.service.LiveKitService
    
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Handle permission results
        val allGranted = permissions.all { it.value }
        if (!allGranted) {
            // Show message that permissions are required
        }
    }

    override fun onResume() {
        super.onResume()
        promptFullScreenIntentPermissionIfNeeded()
        if (acceptedIncomingCall.value == null && pendingIncomingCall.value == null) {
            IncomingCallAcceptStore.consume()?.toLaunchData()?.let { call ->
                pendingIncomingCall.value = call
                acceptedIncomingCall.value = call
                authViewModel.checkAuthStatus()
            }
        }
        if (authViewModel.uiState.value.isAuthenticated) {
            authViewModel.syncPushTokenIfNeeded()
        }
    }

    private val scanQrLauncher = registerForActivityResult(ScanContract()) { result ->
        val contents = result.contents
        if (contents.isNullOrBlank()) {
            return@registerForActivityResult
        }

        val sessionId = parseQrSessionId(contents)
        if (sessionId == null) {
            Toast.makeText(this, "Этот QR-код не подходит для входа в Whithin Web", Toast.LENGTH_LONG).show()
            return@registerForActivityResult
        }

        approveQrSession(sessionId)
    }

    /** Theme from memory — disk warm runs in [ColdStartBootstrap] without blocking first frame. */
    private fun peekBootThemePreset(): AppThemePreset {
        val themeId = appSettingsStore.peekThemePresetId()
        return AppThemePresets.find(themeId) ?: AppThemePresets.all.first()
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleAcceptedIncomingCallIntent(intent)
        pendingOpenFriends.value = parseOpenFriendsIntent(intent)
        parseOpenChatIntent(intent)?.let { chat ->
            stageOpenChatFromPush(chat)
        }
        logLaunchIntent("onCreate", intent)
        pendingShareContent.value = parseShareIntent(intent)
        pendingConfirmLink.value = parseConfirmLink(intent)
        handleQrLoginIntent(intent)
        liveKitService.ensureNormalAudioModeIfIdle()

        val bootThemePreset = peekBootThemePreset()
        window.decorView.setBackgroundColor(bootThemePreset.background.toArgb())
        setupWhithinSystemBars(
            sidebarArgb = bootThemePreset.serverListBackground.toArgb(),
            backgroundArgb = bootThemePreset.background.toArgb(),
        )
        updateWhithinSystemBars(bootThemePreset)

        val initialThemePresetId = bootThemePreset.id
        setContent {
            val incomingCall by pendingIncomingCall
            val acceptedCall by acceptedIncomingCall
            val acceptedChat by acceptedOpenChat
            val themePresetId by appSettingsStore.settings
                .map { it.themePresetId }
                .collectAsState(initial = initialThemePresetId)
            val themePreset = AppThemePresets.find(themePresetId) ?: bootThemePreset
            val activity = LocalContext.current as ComponentActivity
            val authState by authViewModel.uiState.collectAsState()
            SideEffect {
                activity.updateWhithinSystemBars(themePreset)
            }
            // First frame is up — allow hubs / E2E / list network warm without blocking paint.
            LaunchedEffect(Unit) {
                coldStartBootstrap.notifyUiInteractive()
            }
            VoiceTheme(themePresetId = themePresetId) {
                LaunchedEffect(authState.isAuthenticated, authState.user?.id) {
                    if (!authState.isAuthenticated) return@LaunchedEffect
                    val userId = authState.user?.id.orEmpty()
                    if (userId.isBlank()) return@LaunchedEffect
                    withContext(Dispatchers.IO) {
                        notificationHub.connect(userId)
                    }
                }

                LaunchedEffect(Unit) {
                    notificationHub.notificationDismissedEvents.collect { event ->
                        event.chatId?.takeIf { it.isNotBlank() }?.let { chatId ->
                            chatNotificationManager.cancelNotificationsForChat(chatId)
                        }
                    }
                }

                LaunchedEffect(Unit) {
                    notificationHub.incomingCallDismissedEvents.collect { event ->
                        dismissIncomingCallForChat(event.chatId)
                    }
                }

                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .background(MaterialTheme.colorScheme.background),
                ) {
                    MessengerApp(
                        modifier = Modifier.fillMaxSize(),
                        authViewModel = authViewModel,
                        chatRepository = chatRepository,
                        serverRepository = serverRepository,
                        friendRepository = friendRepository,
                        presenceRepository = presenceRepository,
                        authRepository = authRepository,
                        onScanQrClick = { startQrScanner() },
                        pendingIncomingCall = incomingCall,
                        acceptedIncomingCall = acceptedCall,
                        onIncomingCallHandled = {
                            pendingIncomingCall.value = null
                            acceptedIncomingCall.value = null
                        },
                        pendingOpenFriends = pendingOpenFriends.value,
                        onOpenFriendsHandled = { pendingOpenFriends.value = false },
                        pendingOpenChat = pendingOpenChat.value,
                        acceptedOpenChat = acceptedChat,
                        onOpenChatHandled = {
                            pendingOpenChat.value = null
                            acceptedOpenChat.value = null
                        },
                        pendingShareContent = pendingShareContent.value,
                        onShareContentHandled = { pendingShareContent.value = null },
                        pendingConfirmLink = pendingConfirmLink.value,
                        onConfirmLinkHandled = { pendingConfirmLink.value = null },
                        onOpenChatFromNotification = { chatId ->
                            chatNotificationManager.cancelNotificationsForChat(chatId)
                        },
                        onRemoteIncomingCallSync = { chatId, _ ->
                            // Answered/declined on another device — only dismiss ringing UI here.
                            dismissIncomingCallForChat(chatId)
                        },
                        onIncomingCallSignal = { chatId, callerId, callerName ->
                            chatNotificationManager.showIncomingCallNotification(
                                chatId = chatId,
                                roomId = chatId,
                                callerId = callerId,
                                callerName = callerName,
                            )
                        },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAcceptedIncomingCallIntent(intent)
        logLaunchIntent("onNewIntent", intent)
        if (parseOpenFriendsIntent(intent)) {
            pendingOpenFriends.value = true
        }
        parseOpenChatIntent(intent)?.let { chat ->
            stageOpenChatFromPush(chat)
        }
        parseShareIntent(intent)?.let { pendingShareContent.value = it }
        parseConfirmLink(intent)?.let { pendingConfirmLink.value = it }
        handleQrLoginIntent(intent)
    }

    private fun stageOpenChatFromPush(chat: OpenChatLaunchData) {
        pendingOpenChat.value = chat
        acceptedOpenChat.value = chat
        ChatListViewModel.stagePushShell(chat.serverId)
    }

    private fun parseShareIntent(intent: Intent?): SharePayload? {
        return ShareIntentParser.parseSharePayload(intent, contentResolver)
    }

    private fun parseOpenFriendsIntent(intent: Intent?): Boolean {
        return intent?.getBooleanExtra(PushNotificationIntents.EXTRA_OPEN_FRIENDS, false) == true
    }

    private fun parseOpenChatIntent(intent: Intent?): OpenChatLaunchData? {
        if (intent == null) return null
        if (intent.getBooleanExtra(IncomingCallIntents.EXTRA_INCOMING_CALL, false)) return null
        if (intent.getBooleanExtra(PushNotificationIntents.EXTRA_OPEN_FRIENDS, false)) return null

        val chatId =
            intent.getStringExtra(PushNotificationIntents.EXTRA_CHAT_ID)
                ?: intent.getStringExtra(IncomingCallIntents.EXTRA_CHAT_ID)
        if (chatId.isNullOrBlank()) return null

        val pushType = intent.getStringExtra("type")?.trim()?.lowercase()
        val isChatMessagePush =
            pushType == PushNotificationIntents.TYPE_CHAT_MESSAGE ||
                pushType == PushNotificationIntents.TYPE_SERVER_MESSAGE ||
                pushType == "direct_message" ||
                pushType == "group_message" ||
                pushType.isNullOrBlank() ||
                intent.getBooleanExtra(PushNotificationIntents.EXTRA_OPEN_CHAT, false)

        if (!isChatMessagePush) return null

        val rawTitle =
            intent.getStringExtra(PushNotificationIntents.EXTRA_CHAT_TITLE)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
        val chatName =
            if (PushNotificationTitles.isGeneric(rawTitle)) {
                "Chat"
            } else {
                rawTitle!!
            }
        return OpenChatLaunchData(
            chatId = chatId.trim(),
            chatName = chatName,
            serverId = intent.getStringExtra(PushNotificationIntents.EXTRA_SERVER_ID)?.trim()?.takeIf { it.isNotEmpty() },
        )
    }

    private fun parseIncomingCallIntent(intent: Intent?): IncomingCallLaunchData? {
        if (intent == null) return null
        val isIncomingCall = intent.getBooleanExtra(IncomingCallIntents.EXTRA_INCOMING_CALL, false)
        if (!isIncomingCall) return null
        val action = intent.getStringExtra(IncomingCallIntents.EXTRA_CALL_ACTION)
        if (action != IncomingCallIntents.CALL_ACTION_ACCEPT) return null

        val chatId =
            intent.getStringExtra(IncomingCallIntents.EXTRA_CHAT_ID)
                ?: intent.getStringExtra(IncomingCallIntents.EXTRA_ROOM_ID)
                ?: return null
        val roomId = intent.getStringExtra(IncomingCallIntents.EXTRA_ROOM_ID) ?: chatId
        val callerName = intent.getStringExtra(IncomingCallIntents.EXTRA_CALLER_NAME)
            .orEmpty()
            .ifBlank { "Incoming call" }
        return IncomingCallLaunchData(
            roomId = roomId,
            roomName = callerName,
            chatId = chatId,
            chatName = callerName,
        )
    }

    private fun handleAcceptedIncomingCallIntent(intent: Intent?) {
        val incomingCallData =
            parseIncomingCallIntent(intent)
                ?: IncomingCallAcceptStore.consume()?.toLaunchData()
                ?: return
        IncomingCallAcceptStore.clear()
        chatRepository.acceptCall(incomingCallData.chatId)
        pendingIncomingCall.value = incomingCallData
        acceptedIncomingCall.value = incomingCallData
        pendingOpenChat.value = null
        acceptedOpenChat.value = null
        pendingOpenFriends.value = false
        pendingShareContent.value = null
        pendingConfirmLink.value = null
        dismissIncomingCallUi(intent)
        configureForAcceptedIncomingCall()
        authViewModel.checkAuthStatus()
    }

    private fun dismissIncomingCallForChat(chatId: String) {
        chatNotificationManager.dismissActiveIncomingCall(chatId = chatId, roomId = chatId)
        if (pendingIncomingCall.value?.chatId == chatId) {
            pendingIncomingCall.value = null
        }
        if (acceptedIncomingCall.value?.chatId == chatId) {
            acceptedIncomingCall.value = null
        }
    }

    private fun dismissIncomingCallUi(intent: Intent?) {
        sendBroadcast(
            Intent(IncomingCallIntents.ACTION_DISMISS_INCOMING_CALL_UI).setPackage(packageName),
        )
        IncomingCallRingingService.stop(this)
        val notificationId = intent?.getIntExtra(IncomingCallIntents.EXTRA_NOTIFICATION_ID, -1) ?: -1
        if (notificationId != -1) {
            chatNotificationManager.cancelNotificationById(notificationId)
        } else {
            chatNotificationManager.cancelIncomingCallNotification(
                chatId = intent?.getStringExtra(IncomingCallIntents.EXTRA_CHAT_ID),
                callerId = intent?.getStringExtra(IncomingCallIntents.EXTRA_CALLER_ID),
                roomId = intent?.getStringExtra(IncomingCallIntents.EXTRA_ROOM_ID),
            )
        }
    }

    private fun configureForAcceptedIncomingCall() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(KeyguardManager::class.java)
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }
    }

    private fun promptFullScreenIntentPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        if (didPromptFullScreenIntentPermission) return
        val notificationManager = getSystemService(NotificationManager::class.java) ?: return
        if (notificationManager.canUseFullScreenIntent()) return

        didPromptFullScreenIntentPermission = true
        Log.w(
            "WhithinIncomingCall",
            "Full-screen incoming call permission is disabled; prompting user to open settings",
        )
        AlertDialog.Builder(this)
            .setTitle("Разрешите окно входящего звонка")
            .setMessage(
                "Android запретил Whithin открывать полноэкранное окно звонка при выключенном экране. " +
                    "Включите полноэкранные уведомления для приложения, чтобы входящий звонок снова включал экран.",
            )
            .setPositiveButton("Открыть настройки") { _, _ ->
                openFullScreenIntentSettings()
            }
            .setNegativeButton("Позже", null)
            .show()
    }

    private fun openFullScreenIntentSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        val fullScreenIntentSettings =
            Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                data = Uri.parse("package:$packageName")
            }
        runCatching {
            startActivity(fullScreenIntentSettings)
        }.onFailure { error ->
            Log.w("WhithinIncomingCall", "Full-screen intent settings failed; opening app settings", error)
            runCatching {
                startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:$packageName")
                    },
                )
            }
        }
    }

    private fun handleQrLoginIntent(intent: Intent?) {
        val sessionId = parseQrSessionId(intent) ?: return
        approveQrSession(sessionId)
    }

    private fun startQrScanner() {
        val options = ScanOptions().apply {
            setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            setPrompt("")
            setBeepEnabled(true)
            setOrientationLocked(true)
            setCameraId(0)
            setCaptureActivity(QrScannerCaptureActivity::class.java)
        }
        scanQrLauncher.launch(options)
    }

    private fun approveQrSession(sessionId: String) {
        lifecycleScope.launch {
            authViewModel.uiState
                .map { it.isSessionCheckPending }
                .first { pending -> !pending }

            val isAuthenticated = authViewModel.uiState.value.isAuthenticated
            if (!isAuthenticated) {
                Toast.makeText(
                    this@MainActivity,
                    "Сначала войдите в аккаунт в Android-приложении",
                    Toast.LENGTH_LONG
                ).show()
                return@launch
            }

            authViewModel.approveWebLogin(sessionId) { isSuccess, message ->
                Toast.makeText(
                    this@MainActivity,
                    message,
                    if (isSuccess) Toast.LENGTH_SHORT else Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun parseQrSessionId(intent: Intent?): String? {
        return parseQrSessionId(intent?.data)
    }

    private fun parseQrSessionId(rawValue: String?): String? {
        if (rawValue.isNullOrBlank()) return null
        return try {
            parseQrSessionId(Uri.parse(rawValue.trim()))
        } catch (_: Exception) {
            null
        }
    }

    private fun parseQrSessionId(data: Uri?): String? {
        val uri = data ?: return null
        val isSupportedLink =
            (uri.scheme.equals("within", ignoreCase = true) && uri.host.equals("qr-login", ignoreCase = true)) ||
                (uri.scheme.equals("https", ignoreCase = true) &&
                    uri.host.equals("whithin.ru", ignoreCase = true) &&
                    uri.path?.startsWith("/qr-login") == true)

        if (!isSupportedLink) return null

        return uri.getQueryParameter("session")?.trim()?.takeIf { it.isNotEmpty() }
    }

    private fun logLaunchIntent(source: String, intent: Intent?) {
        if (intent == null) {
            Log.d(LAUNCH_LOG_TAG, "$source: intent=null")
            return
        }
        val extras = intent.extras
        val extraKeys = extras?.keySet()?.sorted()?.joinToString(", ").orEmpty().ifBlank { "(none)" }
        val chat = parseOpenChatIntent(intent)
        val call = parseIncomingCallIntent(intent)
        Log.d(
            LAUNCH_LOG_TAG,
            "$source action=${intent.action} data=${intent.dataString} keys=[$extraKeys] " +
                "chat=${chat?.chatId} call=${call?.roomId} " +
                "incoming=${intent.getBooleanExtra(IncomingCallIntents.EXTRA_INCOMING_CALL, false)} " +
                "callAction=${intent.getStringExtra(IncomingCallIntents.EXTRA_CALL_ACTION)}",
        )
    }

}

@Composable
fun MessengerApp(
    modifier: Modifier = Modifier,
    authViewModel: AuthViewModel,
    chatRepository: ChatRepository,
    serverRepository: ServerRepository,
    friendRepository: FriendRepository,
    presenceRepository: PresenceRepository,
    authRepository: AuthRepository,
    onScanQrClick: () -> Unit = {},
    pendingIncomingCall: IncomingCallLaunchData? = null,
    acceptedIncomingCall: IncomingCallLaunchData? = null,
    onIncomingCallHandled: () -> Unit = {},
    pendingOpenFriends: Boolean = false,
    onOpenFriendsHandled: () -> Unit = {},
    pendingOpenChat: OpenChatLaunchData? = null,
    acceptedOpenChat: OpenChatLaunchData? = null,
    onOpenChatHandled: () -> Unit = {},
    pendingShareContent: SharePayload? = null,
    onShareContentHandled: () -> Unit = {},
    pendingConfirmLink: ConfirmLinkData? = null,
    onConfirmLinkHandled: () -> Unit = {},
    onOpenChatFromNotification: (String) -> Unit = {},
    onRemoteIncomingCallSync: (String, String) -> Unit = { _, _ -> },
    onIncomingCallSignal: (String, String?, String) -> Unit = { _, _, _ -> },
) {
    val navController = rememberNavController()
    val authState by authViewModel.uiState.collectAsState()
    val activity = LocalContext.current as ComponentActivity
    val navPrefs = remember(activity) {
        activity.getSharedPreferences(NAV_PREFS, Context.MODE_PRIVATE)
    }
    /** First resolved launch route — kept stable so clearing pending intents does not remount NavHost. */
    var navHostStartDestination by remember { mutableStateOf<String?>(null) }
    /** Prevents push/call LaunchedEffects from re-navigating after the user leaves the deep-link screen. */
    var deepLinkLaunchConsumed by remember { mutableStateOf(false) }
    val voiceRoomViewModel: VoiceRoomViewModel = hiltViewModel(activity)
    val voiceCallState by voiceRoomViewModel.uiState.collectAsState()
    val callSession by ChatCallSignalingState.session.collectAsState()

    DisposableEffect(chatRepository, onRemoteIncomingCallSync) {
        chatRepository.setOnRemoteIncomingCallSync(onRemoteIncomingCallSync)
        onDispose {
            chatRepository.setOnRemoteIncomingCallSync(null)
        }
    }

    DisposableEffect(chatRepository, onIncomingCallSignal) {
        chatRepository.setOnIncomingCallSignal(onIncomingCallSignal)
        onDispose {
            chatRepository.setOnIncomingCallSignal(null)
        }
    }

    DisposableEffect(voiceRoomViewModel, navController) {
        chatRepository.setOnForceEndOutgoingCall { _ ->
            OutgoingCallRingtone.stop()
            if (voiceRoomViewModel.uiState.value.isConnected || voiceRoomViewModel.uiState.value.isJoining) {
                voiceRoomViewModel.leaveRoom(skipCallSignaling = true)
            }
            val onVoiceRoom = navController.currentBackStackEntry?.destination?.route.orEmpty()
                .startsWith("voiceRoom")
            if (onVoiceRoom) {
                navController.popBackStack()
            }
        }
        onDispose {
            chatRepository.setOnForceEndOutgoingCall(null)
        }
    }

    LaunchedEffect(
        callSession.chatId,
        callSession.withRinging,
        callSession.isAnswered,
    ) {
        if (!callSession.withRinging || callSession.isAnswered || callSession.chatId.isBlank()) {
            return@LaunchedEffect
        }
        delay(CALL_RING_TIMEOUT_MS)
        val current = ChatCallSignalingState.session.value
        if (
            current.chatId == callSession.chatId &&
            current.withRinging &&
            !current.isAnswered
        ) {
            chatRepository.reportMissedCall(callSession.chatId)
            OutgoingCallRingtone.stop()
            ChatCallSignalingState.clear()
            if (voiceRoomViewModel.uiState.value.isConnected || voiceRoomViewModel.uiState.value.isJoining) {
                voiceRoomViewModel.leaveRoom(skipCallSignaling = true)
            }
            val onVoiceRoom = navController.currentBackStackEntry?.destination?.route.orEmpty()
                .startsWith("voiceRoom")
            if (onVoiceRoom) {
                navController.popBackStack()
            }
        }
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            authViewModel.syncPushTokenIfNeeded()
        }
    }

    val avPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { _ -> }

    LaunchedEffect(Unit) {
        val requiredPermissions =
            listOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA,
            )
        val missingPermissions =
            requiredPermissions.filter { permission ->
                ContextCompat.checkSelfPermission(activity, permission) != PackageManager.PERMISSION_GRANTED
            }
        if (missingPermissions.isNotEmpty()) {
            avPermissionLauncher.launch(missingPermissions.toTypedArray())
        }
    }

    LaunchedEffect(authState.isAuthenticated, authState.isSessionCheckPending) {
        if (authState.isSessionCheckPending || !authState.isAuthenticated) return@LaunchedEffect
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return@LaunchedEffect
            }
        }
        authViewModel.syncPushTokenIfNeeded()
    }

    // Friends load when session is ready; chat/server hubs may already be warm from cold start.
    LaunchedEffect(authState.isAuthenticated, authState.isSessionCheckPending, authState.user?.id) {
        if (authState.isSessionCheckPending || !authState.isAuthenticated) return@LaunchedEffect
        val userId = authState.user?.id.orEmpty()
        if (userId.isBlank()) return@LaunchedEffect
        launch(Dispatchers.IO) {
            SessionNetworkCoordinator.ensureStartupNetwork(
                userId = userId,
                chatRepository = chatRepository,
                serverRepository = serverRepository,
                friendRepository = friendRepository,
                presenceRepository = presenceRepository,
                authRepository = authRepository,
            )
        }
    }

    val launchRoute =
        resolveLaunchRoute(
            authState = authState,
            hasCachedSession = authViewModel.hasCachedSession(),
            peekCachedUserId = authViewModel.peekCachedUserId(),
            acceptedIncomingCall = acceptedIncomingCall,
            pendingIncomingCall = pendingIncomingCall,
            acceptedOpenChat = acceptedOpenChat,
            pendingOpenChat = pendingOpenChat,
            pendingOpenFriends = pendingOpenFriends,
            pendingShareContent = pendingShareContent,
            pendingConfirmLink = pendingConfirmLink,
        )

    LaunchedEffect(authState.isAuthenticated, authState.isSessionCheckPending) {
        if (!authState.isAuthenticated && !authState.isSessionCheckPending) {
            navHostStartDestination = null
            deepLinkLaunchConsumed = false
        }
    }

    val consumeDeepLinkLaunch = {
        deepLinkLaunchConsumed = true
        onOpenChatHandled()
        onIncomingCallHandled()
    }

    LaunchedEffect(launchRoute) {
        if (navHostStartDestination == null && launchRoute != null) {
            navHostStartDestination = launchRoute
        }
    }

    val startDestination = navHostStartDestination ?: launchRoute

    SideEffect {
        Log.d(
            LAUNCH_LOG_TAG,
            "launchRoute=$launchRoute startDestination=$startDestination auth=${authState.isAuthenticated} " +
                "sessionPending=${authState.isSessionCheckPending} " +
                "openChat=${(acceptedOpenChat ?: pendingOpenChat)?.chatId} " +
                "acceptedCall=${acceptedIncomingCall?.roomId}",
        )
    }

    LaunchedEffect(acceptedIncomingCall?.roomId, pendingIncomingCall?.roomId) {
        if (acceptedIncomingCall != null || pendingIncomingCall != null) {
            deepLinkLaunchConsumed = false
        }
    }

    LaunchedEffect(
        acceptedIncomingCall?.roomId,
        pendingIncomingCall?.roomId,
        authState.isAuthenticated,
        authState.isSessionCheckPending,
        authState.user?.id,
        launchRoute,
        startDestination,
    ) {
        if (launchRoute == null) return@LaunchedEffect
        if (authState.isSessionCheckPending || !authState.isAuthenticated) return@LaunchedEffect
        val call = acceptedIncomingCall ?: pendingIncomingCall ?: return@LaunchedEffect
        val userId = authState.user?.id.orEmpty()
        if (userId.isBlank()) return@LaunchedEffect
        val userName = authState.user?.visibleName().orEmpty().ifBlank { "User" }

        ChatCallSignalingState.beginOutgoing(call.chatId, withRinging = false)

        val returnTo = Screen.Chat.createRoute(call.chatId, call.chatName)
        val targetRoute =
            Screen.VoiceRoom.createRoute(
                roomId = call.roomId,
                roomName = call.roomName,
                userId = userId,
                userName = userName,
                returnTo = returnTo,
            )

        Log.d(
            LAUNCH_LOG_TAG,
            "call-nav start roomId=${call.roomId} targetRoute=$targetRoute currentRoute=${navController.currentBackStackEntry?.destination?.route}",
        )

        if (startDestination == targetRoute) {
            val arrived =
                withTimeoutOrNull(3_000L) {
                    snapshotFlow {
                        navController.currentBackStackEntry?.arguments?.getString("roomId")
                    }.first { it == call.roomId }
                } != null
            Log.d(LAUNCH_LOG_TAG, "call-nav cold start on target arrived=$arrived")
            if (arrived) {
                consumeDeepLinkLaunch()
            }
            return@LaunchedEffect
        }

        val currentRoomId = navController.currentBackStackEntry?.arguments?.getString("roomId")
        if (currentRoomId != call.roomId) {
            navController.navigate(targetRoute) {
                popUpTo(Screen.ChatList.route) { inclusive = false }
                launchSingleTop = true
            }
        }

        val arrived =
            withTimeoutOrNull(3_000L) {
                snapshotFlow {
                    navController.currentBackStackEntry?.arguments?.getString("roomId")
                }.first { it == call.roomId }
            } != null

        Log.d(
            LAUNCH_LOG_TAG,
            "call-nav done arrived=$arrived route=${navController.currentBackStackEntry?.destination?.route} " +
                "roomId=${navController.currentBackStackEntry?.arguments?.getString("roomId")}",
        )

        if (arrived) {
            consumeDeepLinkLaunch()
        }
    }

    LaunchedEffect(
        authState.isAuthenticated,
        authState.isSessionCheckPending,
        pendingShareContent,
        launchRoute,
    ) {
        if (authState.isSessionCheckPending) return@LaunchedEffect
        if (pendingShareContent == null) return@LaunchedEffect
        if (!authState.isAuthenticated) {
            Toast.makeText(
                activity,
                "Войдите в аккаунт, чтобы отправить в Whithin",
                Toast.LENGTH_LONG,
            ).show()
            return@LaunchedEffect
        }
        if (launchRoute == Screen.ShareContent.route) return@LaunchedEffect
        navController.navigate(Screen.ShareContent.route) {
            launchSingleTop = true
        }
    }

    LaunchedEffect(
        authState.isAuthenticated,
        authState.isSessionCheckPending,
        acceptedOpenChat?.chatId,
        acceptedOpenChat?.serverId,
        pendingOpenChat?.chatId,
        pendingOpenChat?.chatName,
        pendingOpenChat?.serverId,
        pendingShareContent,
        launchRoute,
        deepLinkLaunchConsumed,
        startDestination,
    ) {
        if (deepLinkLaunchConsumed) return@LaunchedEffect
        if (authState.isSessionCheckPending) return@LaunchedEffect
        if (pendingShareContent != null) return@LaunchedEffect
        val openChat = acceptedOpenChat ?: pendingOpenChat ?: return@LaunchedEffect
        if (!authState.isAuthenticated) return@LaunchedEffect
        if (openChat.chatId.isBlank()) return@LaunchedEffect
        if (launchRoute == null) return@LaunchedEffect

        val targetRoute = Screen.Chat.createRoute(openChat.chatId, openChat.chatName)
        val currentChatId = navController.currentBackStackEntry?.arguments?.getString("chatId")

        Log.d(
            LAUNCH_LOG_TAG,
            "chat-nav start chatId=${openChat.chatId} serverId=${openChat.serverId} targetRoute=$targetRoute launchRoute=$launchRoute " +
                "currentRoute=${navController.currentBackStackEntry?.destination?.route} currentChatId=$currentChatId",
        )

        if (startDestination == targetRoute) {
            Log.d(LAUNCH_LOG_TAG, "chat-nav cold start on chat, consuming deep link")
            onOpenChatFromNotification(openChat.chatId)
            consumeDeepLinkLaunch()
            return@LaunchedEffect
        }

        if (currentChatId != openChat.chatId) {
            navController.navigate(targetRoute) {
                popUpTo(Screen.ChatList.route) { inclusive = false }
                launchSingleTop = true
            }
        }

        val arrived =
            withTimeoutOrNull(3_000L) {
                snapshotFlow {
                    navController.currentBackStackEntry?.arguments?.getString("chatId")
                }.first { it == openChat.chatId }
            } != null

        Log.d(
            LAUNCH_LOG_TAG,
            "chat-nav done arrived=$arrived route=${navController.currentBackStackEntry?.destination?.route} " +
                "chatId=${navController.currentBackStackEntry?.arguments?.getString("chatId")}",
        )

        if (arrived) {
            onOpenChatFromNotification(openChat.chatId)
            consumeDeepLinkLaunch()
        }
    }

    LaunchedEffect(
        authState.isAuthenticated,
        authState.isSessionCheckPending,
        pendingOpenFriends,
    ) {
        if (authState.isSessionCheckPending) return@LaunchedEffect
        if (!pendingOpenFriends) return@LaunchedEffect
        if (!authState.isAuthenticated) return@LaunchedEffect

        val targetRoute = Screen.Friends.createRoute(tab = 1)
        val onFriends =
            navController.currentBackStackEntry?.destination?.route.orEmpty().startsWith("friends")
        if (!onFriends) {
            navController.navigate(targetRoute) {
                launchSingleTop = true
            }
        }
        onOpenFriendsHandled()
    }

    Box(modifier = modifier.fillMaxSize()) {
        if (startDestination == null) {
            if (authViewModel.hasCachedSession()) {
                ChatListSkeleton(modifier = Modifier.fillMaxSize())
            } else {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
        } else {
            AppNavGraph(
                navController = navController,
                startDestination = startDestination,
                authViewModel = authViewModel,
                voiceRoomViewModel = voiceRoomViewModel,
                onScanQrClick = onScanQrClick,
                onDeepLinkBack = consumeDeepLinkLaunch,
                onChatOpened = { chatId, chatName ->
                    navPrefs.edit()
                        .putString(NAV_LAST_CHAT_ID, chatId)
                        .putString(NAV_LAST_CHAT_NAME, chatName)
                        .apply()
                },
                onChatClosed = {
                    navPrefs.edit()
                        .remove(NAV_LAST_CHAT_ID)
                        .remove(NAV_LAST_CHAT_NAME)
                        .apply()
                },
                pendingShareContent = pendingShareContent,
                onShareContentHandled = onShareContentHandled,
                pendingConfirmLink = pendingConfirmLink,
                onConfirmLinkHandled = onConfirmLinkHandled,
            )

            if (voiceCallState.isMinimized && voiceCallState.isConnected) {
                MinimizedCallBar(
                    roomName = voiceCallState.roomName,
                    participantCount = voiceCallState.participants.size + 1,
                    isMuted = voiceCallState.isMuted,
                    onExpandClick = {
                        voiceRoomViewModel.expandCall()
                        navController.navigate(
                            Screen.VoiceRoom.createRoute(
                                roomId = voiceCallState.sessionRoomId,
                                roomName = voiceCallState.roomName,
                                userId = voiceCallState.sessionUserId,
                                userName = voiceCallState.sessionUserName,
                                returnTo = voiceCallState.sessionReturnTo,
                            ),
                        ) {
                            launchSingleTop = true
                        }
                    },
                    onMuteClick = { voiceRoomViewModel.toggleMute() },
                    onLeaveClick = { voiceRoomViewModel.leaveRoom() },
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }
        }
    }
}

data class IncomingCallLaunchData(
    val roomId: String,
    val roomName: String,
    val chatId: String,
    val chatName: String,
)

data class OpenChatLaunchData(
    val chatId: String,
    val chatName: String,
    val serverId: String? = null,
)

/** Стартовый экран без промежуточного ChatList (share, push, входящий звонок). */
private fun parseConfirmLink(intent: Intent?): ConfirmLinkData? {
    val uri = intent?.data ?: return null
    if (uri.host != "whithin.ru") return null
    val path = uri.path ?: return null
    val userId = uri.getQueryParameter("userId") ?: return null
    val token = uri.getQueryParameter("token") ?: return null
    return when {
        path.startsWith("/confirm-email-change") -> ConfirmLinkData(
            type = ConfirmLinkType.EMAIL_CHANGE,
            userId = userId,
            token = token,
            email = uri.getQueryParameter("email"),
        )
        path.startsWith("/confirm-password-change") -> ConfirmLinkData(
            type = ConfirmLinkType.PASSWORD_CHANGE,
            userId = userId,
            token = token,
        )
        path.startsWith("/confirm-email") -> ConfirmLinkData(
            type = ConfirmLinkType.REGISTER_EMAIL,
            userId = userId,
            token = token,
        )
        else -> null
    }
}

private fun resolveLaunchRoute(
    authState: AuthUiState,
    hasCachedSession: Boolean,
    peekCachedUserId: String?,
    acceptedIncomingCall: IncomingCallLaunchData?,
    pendingIncomingCall: IncomingCallLaunchData?,
    acceptedOpenChat: OpenChatLaunchData?,
    pendingOpenChat: OpenChatLaunchData?,
    pendingOpenFriends: Boolean,
    pendingShareContent: SharePayload?,
    pendingConfirmLink: ConfirmLinkData?,
): String? {
    if (pendingConfirmLink != null) return Screen.ConfirmAuth.route

    if (authState.isSessionCheckPending) {
        if (hasCachedSession && !peekCachedUserId.isNullOrBlank()) {
            if (pendingShareContent != null) return Screen.ShareContent.route
            if (pendingOpenFriends) return Screen.Friends.createRoute(tab = 1)
            (acceptedOpenChat ?: pendingOpenChat)?.let { openChat ->
                if (openChat.chatId.isNotBlank()) {
                    return Screen.Chat.createRoute(openChat.chatId, openChat.chatName)
                }
            }
            return Screen.ChatList.route
        }
        return null
    }

    if (!authState.isAuthenticated) return Screen.Login.route

    if (pendingShareContent != null) return Screen.ShareContent.route

    if (pendingOpenFriends) return Screen.Friends.createRoute(tab = 1)

    (acceptedIncomingCall ?: pendingIncomingCall)?.let { call ->
        val userId = authState.user?.id.orEmpty()
        if (userId.isNotBlank()) {
            val userName = authState.user?.visibleName().orEmpty().ifBlank { "User" }
            return Screen.VoiceRoom.createRoute(
                roomId = call.roomId,
                roomName = call.roomName,
                userId = userId,
                userName = userName,
                returnTo = Screen.Chat.createRoute(call.chatId, call.chatName),
            )
        }
        return null
    }

    (acceptedOpenChat ?: pendingOpenChat)?.let { openChat ->
        if (openChat.chatId.isNotBlank()) {
            return Screen.Chat.createRoute(openChat.chatId, openChat.chatName)
        }
    }

    return Screen.ChatList.route
}
