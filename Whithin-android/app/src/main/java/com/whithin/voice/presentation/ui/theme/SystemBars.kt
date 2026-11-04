package com.whithin.voice.presentation.ui.theme

import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.ui.graphics.toArgb
import androidx.core.view.WindowCompat

fun ComponentActivity.setupWhithinSystemBars(
    sidebarArgb: Int = 0xFF202225.toInt(),
    backgroundArgb: Int = 0xFF36393F.toInt(),
) {
    enableEdgeToEdge(
        statusBarStyle = SystemBarStyle.dark(sidebarArgb),
        navigationBarStyle = SystemBarStyle.dark(backgroundArgb),
    )
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.statusBarColor = sidebarArgb
    window.navigationBarColor = backgroundArgb
}

fun ComponentActivity.updateWhithinSystemBars(preset: AppThemePreset) {
    val sidebarArgb = preset.serverListBackground.toArgb()
    val backgroundArgb = preset.background.toArgb()
    enableEdgeToEdge(
        statusBarStyle = if (preset.isLight) {
            SystemBarStyle.light(sidebarArgb, sidebarArgb)
        } else {
            SystemBarStyle.dark(sidebarArgb)
        },
        navigationBarStyle = if (preset.isLight) {
            SystemBarStyle.light(backgroundArgb, backgroundArgb)
        } else {
            SystemBarStyle.dark(backgroundArgb)
        },
    )
    window.statusBarColor = sidebarArgb
    window.navigationBarColor = backgroundArgb
}

/** Full-screen incoming call — opaque window using the active app theme. */
fun ComponentActivity.setupIncomingCallWindow(preset: AppThemePreset) {
    val backgroundArgb = preset.background.toArgb()
    val navigationArgb = preset.serverListBackground.toArgb()
    window.statusBarColor = backgroundArgb
    window.navigationBarColor = navigationArgb
    window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(backgroundArgb))
    WindowCompat.setDecorFitsSystemWindows(window, true)
    WindowCompat.getInsetsController(window, window.decorView)?.apply {
        isAppearanceLightStatusBars = preset.isLight
        isAppearanceLightNavigationBars = preset.isLight
    }
}
