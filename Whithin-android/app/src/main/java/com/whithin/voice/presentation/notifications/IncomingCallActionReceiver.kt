package com.whithin.voice.presentation.notifications

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import dagger.hilt.android.EntryPointAccessors

class IncomingCallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        val payload = intent.toIncomingCallPayload()

        if (payload.notificationId != -1) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.cancel(payload.notificationId)
        }
        IncomingCallRingingService.stop(context)

        when (action) {
            IncomingCallIntents.ACTION_ACCEPT_CALL -> {
                IncomingCallAcceptStore.stage(payload)
                val openAppIntent = buildAcceptCallMainActivityIntent(context, payload)
                Log.d(
                    "WhithinLaunch",
                    "IncomingCallActionReceiver accept chatId=${payload.chatId} roomId=${payload.roomId}",
                )
                runCatching {
                    PendingIntent.getActivity(
                        context,
                        payload.notificationId + 11,
                        openAppIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                    ).send()
                }.onFailure { error ->
                    Log.w("IncomingCallActionReceiver", "PendingIntent launch failed", error)
                    runCatching {
                        context.startActivity(openAppIntent)
                    }
                }
            }

            IncomingCallIntents.ACTION_DECLINE_CALL -> {
                payload.chatId?.takeIf { it.isNotBlank() }?.let { chatId ->
                    runCatching {
                        EntryPointAccessors.fromApplication(
                            context.applicationContext,
                            IncomingCallSignalingEntryPoint::class.java,
                        ).chatRepository().declineCall(chatId)
                    }.onFailure { error ->
                        Log.w("IncomingCallActionReceiver", "declineCall failed", error)
                    }
                }
                context.sendBroadcast(
                    Intent(IncomingCallIntents.ACTION_DISMISS_INCOMING_CALL_UI).setPackage(context.packageName),
                )
            }
        }
    }
}
