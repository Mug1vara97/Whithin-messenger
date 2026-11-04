package com.whithin.voice.presentation.notifications

import android.app.ActivityOptions
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log

internal object IncomingCallUiLauncher {
    private const val TAG = "WhithinIncomingCall"
    private const val WAKE_LOCK_TIMEOUT_MS = 10_000L

    /**
     * Brings [IncomingCallActivity] to the front when the device is locked / screen is off,
     * or when the app is already open (in-app ringing UI).
     */
    fun launchIncomingCallUi(context: Context, payload: IncomingCallPayload) {
        if (!shouldLaunchIncomingCallUi(context)) {
            Log.d(
                TAG,
                "Launcher skip: foreground=${AppVisibilityState.isAppInForeground} " +
                    "chatId=${payload.chatId} roomId=${payload.roomId} notificationId=${payload.notificationId}",
            )
            return
        }

        val appContext = context.applicationContext
        val powerManager = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val isInteractive = powerManager?.isInteractive
        val isLocked =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                (appContext.getSystemService(Context.KEYGUARD_SERVICE) as? android.app.KeyguardManager)
                    ?.isDeviceLocked
            } else {
                null
            }
        Log.d(
            TAG,
            "Launcher start: chatId=${payload.chatId} roomId=${payload.roomId} " +
                "notificationId=${payload.notificationId} sdk=${Build.VERSION.SDK_INT} " +
                "interactive=$isInteractive locked=$isLocked foreground=${AppVisibilityState.isAppInForeground}",
        )
        val wakeLock =
            powerManager?.newWakeLock(
                @Suppress("DEPRECATION")
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "whithin:incoming_call_wake",
            )

        runCatching {
            wakeLock?.acquire(WAKE_LOCK_TIMEOUT_MS)
            Log.d(TAG, "WakeLock acquired timeoutMs=$WAKE_LOCK_TIMEOUT_MS held=${wakeLock?.isHeld}")
        }.onFailure { error ->
            Log.w(TAG, "WakeLock acquire failed", error)
        }

        val intent =
            Intent(appContext, IncomingCallActivity::class.java).apply {
                flags =
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                putIncomingCallExtras(payload)
            }

        val launchedDirectly =
            runCatching {
                appContext.startActivity(intent)
                Log.d(TAG, "Activity startActivity success")
                true
            }.getOrElse { error ->
                Log.w(TAG, "Activity startActivity failed; trying PendingIntent", error)
                false
            }

        if (!launchedDirectly || isInteractive == false || isLocked == true) {
            val reason =
                if (launchedDirectly) {
                    "locked_or_screen_off_after_direct_success"
                } else {
                    "direct_start_failed"
                }
            Handler(Looper.getMainLooper()).post {
                sendActivityPendingIntent(appContext, payload, intent, reason)
            }
        }

        // Keep the wake lock until its timeout. Releasing immediately can let the
        // screen turn back off before the lock-screen activity is drawn on OEM ROMs.
    }

    private fun shouldLaunchIncomingCallUi(context: Context): Boolean {
        if (AppVisibilityState.isAppInForeground) return true
        return shouldLaunchOverLockScreen(context)
    }

    private fun shouldLaunchOverLockScreen(context: Context): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        if (powerManager?.isInteractive == false) return true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            val keyguardManager =
                context.getSystemService(Context.KEYGUARD_SERVICE) as? android.app.KeyguardManager
            if (keyguardManager?.isDeviceLocked == true) return true
        }

        return false
    }

    private fun sendActivityPendingIntent(
        context: Context,
        payload: IncomingCallPayload,
        intent: Intent,
        reason: String,
    ) {
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                payload.notificationId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val options = backgroundActivityStartOptions()
        runCatching {
            if (options != null) {
                pendingIntent.send(context, 0, null, null, null, null, options)
            } else {
                pendingIntent.send()
            }
            Log.d(
                TAG,
                "Activity PendingIntent send success reason=$reason hasOptions=${options != null}",
            )
        }.onFailure { error ->
            Log.w(
                TAG,
                "Activity PendingIntent send failed reason=$reason; relying on notification fullScreenIntent",
                error,
            )
        }
    }

    private fun backgroundActivityStartOptions(): Bundle? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return null
        return runCatching {
            ActivityOptions.makeBasic()
                .setPendingIntentBackgroundActivityStartMode(
                    ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED,
                )
                .toBundle()
        }.onFailure { error ->
            Log.w(TAG, "ActivityOptions background-start mode unavailable", error)
        }.getOrNull()
    }
}
