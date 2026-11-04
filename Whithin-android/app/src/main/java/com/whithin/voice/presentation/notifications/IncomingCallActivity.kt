package com.whithin.voice.presentation.notifications

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.app.KeyguardManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.R
import com.whithin.voice.data.local.AppSettingsStore
import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.repository.ChatRepository
import com.whithin.voice.util.CALL_RING_TIMEOUT_MS
import com.whithin.voice.presentation.ui.components.AvatarWithPresenceIndicator
import com.whithin.voice.presentation.ui.components.resolveAvatarUrl
import com.whithin.voice.presentation.ui.theme.AppThemePresets
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import com.whithin.voice.presentation.ui.theme.VoiceTheme
import com.whithin.voice.presentation.ui.theme.setupIncomingCallWindow
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.map

@AndroidEntryPoint
class IncomingCallActivity : ComponentActivity() {
    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var chatRepository: ChatRepository

    @Inject
    lateinit var appSettingsStore: AppSettingsStore

    @Inject
    lateinit var chatNotificationManager: ChatNotificationManager

    private var callPayload: IncomingCallPayload? = null
    private var dismissReceiverRegistered = false
    private var ringtonePlayer: MediaPlayer? = null
    private val dismissReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == IncomingCallIntents.ACTION_DISMISS_INCOMING_CALL_UI) {
                Log.d(LOG_TAG, "Dismiss broadcast received")
                stopRingtoneLoop()
                finishAndRemoveTaskCompat()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val payload = intent.toIncomingCallPayload()
        Log.d(
            LOG_TAG,
            "onCreate: incoming=${intent.getBooleanExtra(IncomingCallIntents.EXTRA_INCOMING_CALL, false)} " +
                "chatId=${payload.chatId} roomId=${payload.roomId} callerId=${payload.callerId} " +
                "notificationId=${payload.notificationId} flags=${intent.flags}",
        )
        if (!intent.getBooleanExtra(IncomingCallIntents.EXTRA_INCOMING_CALL, false)) {
            Log.w(LOG_TAG, "Missing incoming call extras — closing")
            finish()
            return
        }

        callPayload = payload

        try {
            val initialThemePresetId = appSettingsStore.peekThemePresetId()
            val initialThemePreset =
                AppThemePresets.find(initialThemePresetId) ?: AppThemePresets.all.first()
            setupIncomingCallWindow(initialThemePreset)
            configureForLockscreen()
            Log.d(LOG_TAG, "Window configured for lockscreen")

            registerDismissReceiver()
            startRingtoneLoop()

            setContent {
                val themePresetId by appSettingsStore.settings
                    .map { it.themePresetId }
                    .collectAsState(initial = initialThemePresetId)
                val themePreset =
                    AppThemePresets.find(themePresetId) ?: initialThemePreset

                SideEffect {
                    setupIncomingCallWindow(themePreset)
                }

                var avatarUrl by remember(payload.callerAvatar) {
                    mutableStateOf(payload.callerAvatar?.takeIf { it.isNotBlank() })
                }
                var avatarColorHex by remember(payload.callerAvatarColor) {
                    mutableStateOf(payload.callerAvatarColor?.takeIf { it.isNotBlank() })
                }

                LaunchedEffect(payload.callerId) {
                    val callerId = payload.callerId?.trim().orEmpty()
                    if (callerId.isBlank() || !avatarUrl.isNullOrBlank()) return@LaunchedEffect
                    runCatching {
                        authRepository.getUserProfileVisuals(callerId)?.let { profile ->
                            profile.avatar?.takeIf { it.isNotBlank() }?.let { avatarUrl = it }
                            profile.avatarColor?.takeIf { it.isNotBlank() }?.let { avatarColorHex = it }
                        }
                    }
                }

                VoiceTheme(themePresetId = themePresetId) {
                    IncomingCallScreen(
                        callerName = payload.callerName,
                        avatarUrl = avatarUrl?.let(::resolveAvatarUrl),
                        avatarColorHex = avatarColorHex,
                        onAccept = { acceptCall(payload) },
                        onDecline = { declineCall(payload.notificationId) },
                        onMinimize = { minimizeCall() },
                    )
                }
            }
        } catch (error: Exception) {
            Log.e(LOG_TAG, "Failed to show incoming call UI", error)
            finish()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(IncomingCallIntents.EXTRA_INCOMING_CALL, false)) {
            callPayload = intent.toIncomingCallPayload()
            Log.d(
                LOG_TAG,
                "onNewIntent: chatId=${callPayload?.chatId} roomId=${callPayload?.roomId} " +
                    "notificationId=${callPayload?.notificationId} flags=${intent.flags}",
            )
            hideIncomingCallNotification()
        }
    }

    override fun onStart() {
        super.onStart()
        Log.d(LOG_TAG, "onStart")
        hideIncomingCallNotification()
    }

    override fun onDestroy() {
        Log.d(LOG_TAG, "onDestroy")
        stopRingtoneLoop()
        if (dismissReceiverRegistered) {
            unregisterReceiver(dismissReceiver)
        }
        super.onDestroy()
    }

    private fun hideIncomingCallNotification() {
        val payload = callPayload ?: return
        if (payload.notificationId == -1) return
        chatNotificationManager.cancelNotificationById(payload.notificationId)
    }

    private fun configureForLockscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(KeyguardManager::class.java)
            keyguardManager?.requestDismissKeyguard(this, null)
            Log.d(LOG_TAG, "configureForLockscreen: setShowWhenLocked/setTurnScreenOn requested")
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
            Log.d(LOG_TAG, "configureForLockscreen: legacy window flags added")
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun registerDismissReceiver() {
        if (dismissReceiverRegistered) return
        val filter = IntentFilter(IncomingCallIntents.ACTION_DISMISS_INCOMING_CALL_UI)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(dismissReceiver, filter)
        }
        dismissReceiverRegistered = true
    }

    private fun startRingtoneLoop() {
        if (ringtonePlayer != null) return
        val soundResId = resources.getIdentifier("den_den_mushi", "raw", packageName)
        if (soundResId == 0) return

        val player = MediaPlayer.create(this, soundResId) ?: return
        player.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        )
        player.isLooping = true
        try {
            player.start()
            ringtonePlayer = player
        } catch (_: Exception) {
            player.release()
            ringtonePlayer = null
        }
    }

    private fun stopRingtoneLoop() {
        val player = ringtonePlayer ?: return
        try {
            if (player.isPlaying) {
                player.stop()
            }
        } catch (_: Exception) {
            // Ignore stop errors.
        }
        player.release()
        ringtonePlayer = null
    }

    private fun acceptCall(payload: IncomingCallPayload) {
        stopRingtoneLoop()
        unregisterDismissReceiverSafely()
        payload.chatId?.takeIf { it.isNotBlank() }?.let { chatRepository.acceptCall(it) }

        if (payload.notificationId != -1) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.cancel(payload.notificationId)
        }
        IncomingCallRingingService.stop(this)

        IncomingCallAcceptStore.stage(payload)

        val openAppIntent = buildAcceptCallMainActivityIntent(this, payload)
        Log.d(
            "WhithinLaunch",
            "IncomingCallActivity accept chatId=${payload.chatId} roomId=${payload.roomId} caller=${payload.callerName}",
        )

        val launched =
            runCatching {
                val pendingIntent =
                    PendingIntent.getActivity(
                        this,
                        payload.notificationId + 10,
                        openAppIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                    )
                pendingIntent.send()
                true
            }.getOrElse { pendingError ->
                Log.w("IncomingCallActivity", "PendingIntent launch failed, trying startActivity", pendingError)
                runCatching {
                    startActivity(openAppIntent)
                    true
                }.getOrElse { startError ->
                    Log.e("IncomingCallActivity", "startActivity failed", startError)
                    false
                }
            }

        if (!launched) {
            IncomingCallAcceptStore.clear()
            return
        }

        finish()
    }

    private fun minimizeCall() {
        stopRingtoneLoop()
        callPayload?.let { chatNotificationManager.postIncomingCallNotification(it) }
        finishAndRemoveTaskCompat()
    }

    private fun declineCall(notificationId: Int) {
        stopRingtoneLoop()
        unregisterDismissReceiverSafely()
        callPayload?.chatId?.let { chatRepository.declineCall(it) }
        cancelNotification(notificationId, dismissUi = true)
        finishAndRemoveTaskCompat()
    }

    private fun unregisterDismissReceiverSafely() {
        if (!dismissReceiverRegistered) return
        runCatching { unregisterReceiver(dismissReceiver) }
        dismissReceiverRegistered = false
    }

    private fun cancelNotification(notificationId: Int, dismissUi: Boolean = true) {
        if (notificationId != -1) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.cancel(notificationId)
        }
        IncomingCallRingingService.stop(this)
        if (dismissUi) {
            sendBroadcast(Intent(IncomingCallIntents.ACTION_DISMISS_INCOMING_CALL_UI).setPackage(packageName))
        }
    }

    private fun finishAndRemoveTaskCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask()
        } else {
            finish()
        }
    }

    companion object {
        private const val LOG_TAG = "WhithinIncomingCall"
    }
}

@Composable
private fun IncomingCallScreen(
    callerName: String,
    avatarUrl: String?,
    avatarColorHex: String?,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onMinimize: () -> Unit,
) {
    LaunchedEffect(Unit) {
        delay(CALL_RING_TIMEOUT_MS)
        onDecline()
    }

    val preset = LocalAppThemePreset.current
    val colorScheme = MaterialTheme.colorScheme
    val onBackground = colorScheme.onBackground
    val mutedText = onBackground.copy(alpha = 0.72f)
    val acceptColor = colorScheme.secondary
    val declineColor = colorScheme.error

    val avatarColor =
        remember(avatarColorHex, preset.primary) {
            avatarColorHex?.let {
                runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
            } ?: preset.primary
        }

    val gradientColors =
        remember(preset) {
            val top = preset.primary.copy(alpha = if (preset.isLight) 0.72f else 0.88f)
            val mid = preset.primary.copy(alpha = if (preset.isLight) 0.38f else 0.52f)
                .compositeOver(preset.serverListBackground)
            listOf(
                top.compositeOver(preset.serverListBackground),
                mid,
                preset.serverListBackground,
                preset.background,
            )
        }

    val pulseTransition = rememberInfiniteTransition(label = "incoming-call-pulse")
    val pulseScale by pulseTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.14f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 1400, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "pulse-scale",
    )

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Brush.verticalGradient(colors = gradientColors)),
        )

        IconButton(
            onClick = onMinimize,
            modifier =
                Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(start = 4.dp, top = 4.dp),
        ) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = null,
                tint = onBackground.copy(alpha = 0.85f),
                modifier = Modifier.size(26.dp),
            )
        }

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(72.dp))

            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier =
                        Modifier
                            .size(200.dp)
                            .scale(pulseScale)
                            .clip(CircleShape)
                            .border(
                                width = 2.dp,
                                color = preset.primary.copy(alpha = 0.35f),
                                shape = CircleShape,
                            ),
                )
                Box(
                    modifier =
                        Modifier
                            .size(176.dp)
                            .clip(CircleShape)
                            .border(
                                width = 1.dp,
                                color = onBackground.copy(alpha = 0.12f),
                                shape = CircleShape,
                            ),
                )
                AvatarWithPresenceIndicator(
                    name = callerName,
                    avatarUrl = avatarUrl,
                    avatarColor = avatarColor,
                    status = null,
                    size = 156.dp,
                    showIndicator = false,
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            Text(
                text = callerName,
                color = onBackground,
                fontSize = 34.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = stringResource(R.string.incoming_call_screen_subtitle),
                color = mutedText,
                fontSize = 17.sp,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.weight(1f))

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 48.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CallActionButton(
                    label = stringResource(R.string.incoming_call_accept),
                    backgroundColor = acceptColor,
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Call,
                            contentDescription = stringResource(R.string.incoming_call_accept),
                            tint = Color.White,
                            modifier = Modifier.size(26.dp),
                        )
                    },
                    onClick = onAccept,
                )
                CallActionButton(
                    label = stringResource(R.string.incoming_call_decline),
                    backgroundColor = declineColor,
                    icon = {
                        Icon(
                            imageVector = Icons.Default.CallEnd,
                            contentDescription = stringResource(R.string.incoming_call_decline),
                            tint = Color.White,
                            modifier = Modifier.size(26.dp),
                        )
                    },
                    onClick = onDecline,
                )
            }
        }
    }
}

@Composable
private fun CallActionButton(
    label: String,
    backgroundColor: Color,
    icon: @Composable () -> Unit,
    onClick: () -> Unit,
) {
    val labelColor = MaterialTheme.colorScheme.onBackground
    val buttonSize = 56.dp
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier =
                Modifier
                    .size(buttonSize)
                    .clip(CircleShape)
                    .background(backgroundColor)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onClick,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            icon()
        }
        Text(
            text = label,
            color = labelColor.copy(alpha = 0.95f),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 10.dp),
        )
    }
}
