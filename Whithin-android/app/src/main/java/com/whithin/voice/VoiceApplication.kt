package com.whithin.voice

import android.app.Application
import android.os.Bundle
import coil.Coil
import coil.ImageLoader
import com.whithin.voice.data.local.ColdStartBootstrap
import com.whithin.voice.presentation.notifications.AppVisibilityState
import com.whithin.voice.presentation.notifications.ChatNotificationManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@HiltAndroidApp
class VoiceApplication : Application() {
    @Inject
    lateinit var chatNotificationManager: ChatNotificationManager

    @Inject
    lateinit var imageLoader: ImageLoader

    @Inject
    lateinit var coldStartBootstrap: ColdStartBootstrap

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var startedActivityCount: Int = 0

    override fun onCreate() {
        super.onCreate()
        coldStartBootstrap.startEarly()
        Coil.setImageLoader(imageLoader)
        // Notification channel is not needed for first paint.
        appScope.launch {
            chatNotificationManager.createChannel()
        }
        trackAppVisibility()
    }

    private fun trackAppVisibility() {
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: android.app.Activity, savedInstanceState: Bundle?) = Unit
            override fun onActivityPaused(activity: android.app.Activity) = Unit
            override fun onActivitySaveInstanceState(activity: android.app.Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: android.app.Activity) = Unit

            override fun onActivityStarted(activity: android.app.Activity) {
                startedActivityCount++
                AppVisibilityState.isAppInForeground = startedActivityCount > 0
            }

            override fun onActivityStopped(activity: android.app.Activity) {
                startedActivityCount = (startedActivityCount - 1).coerceAtLeast(0)
                AppVisibilityState.isAppInForeground = startedActivityCount > 0
            }

            override fun onActivityResumed(activity: android.app.Activity) = Unit
        })
    }
}
