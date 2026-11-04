package com.whithin.voice.presentation.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.whithin.voice.MainActivity

class VoiceCallService : Service() {

    companion object {
        private const val TAG = "VoiceCallService"
        private const val CHANNEL_ID = "VoiceCallServiceChannel"
        private const val NOTIFICATION_ID = 1

        fun startService(context: Context, roomName: String): Boolean {
            if (!hasMicrophoneForegroundPermission(context)) {
                Log.w(TAG, "Cannot start voice FGS: RECORD_AUDIO not granted")
                return false
            }
            val intent =
                Intent(context, VoiceCallService::class.java).apply {
                    putExtra(EXTRA_ROOM_NAME, roomName)
                    putExtra(EXTRA_SCREEN_SHARING, false)
                }
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                true
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start voice foreground service", e)
                false
            }
        }

        fun setScreenSharingActive(context: Context, roomName: String, active: Boolean) {
            if (!hasMicrophoneForegroundPermission(context)) return
            val intent =
                Intent(context, VoiceCallService::class.java).apply {
                    putExtra(EXTRA_ROOM_NAME, roomName)
                    putExtra(EXTRA_SCREEN_SHARING, active)
                }
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }.onFailure { Log.w(TAG, "Failed to update screen-share FGS type", it) }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, VoiceCallService::class.java)
            context.stopService(intent)
        }

        private fun hasMicrophoneForegroundPermission(context: Context): Boolean =
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED

        private const val EXTRA_ROOM_NAME = "roomName"
        private const val EXTRA_SCREEN_SHARING = "screenSharing"
    }

    private var screenSharing = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val roomName = intent?.getStringExtra(EXTRA_ROOM_NAME) ?: "Voice Call"
        screenSharing = intent?.getBooleanExtra(EXTRA_SCREEN_SHARING, false) ?: false

        val notification = createNotification(roomName)
        if (!promoteToForeground(notification)) {
            stopSelf()
            return START_NOT_STICKY
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun promoteToForeground(notification: Notification): Boolean {
        if (!hasMicrophoneForegroundPermission(this)) {
            Log.w(TAG, "RECORD_AUDIO not granted — skipping foreground promotion")
            return false
        }

        val serviceType = foregroundServiceType()
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    notification,
                    serviceType,
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting foreground service type=$serviceType", e)
            false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start foreground service", e)
            false
        }
    }

    private fun foregroundServiceType(): Int {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return 0
        }
        var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        if (screenSharing && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        }
        return type
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel =
                NotificationChannel(
                    CHANNEL_ID,
                    "Voice Call Service",
                    NotificationManager.IMPORTANCE_LOW,
                ).apply {
                    description = "Keeps voice call active when screen is off"
                    setShowBadge(false)
                }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(roomName: String): Notification {
        val intent =
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }

        val pendingIntent =
            PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Voice Call Active")
            .setContentText("Room: $roomName")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }
}
