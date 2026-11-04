package com.whithin.voice.presentation.ui.theme

import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.ui.components.ProvideTextScramble

val LocalAppThemePreset = staticCompositionLocalOf { AppThemePresets.all.first() }

private val DefaultThemeShapes = Shapes()
private val NeoVectorheartShapes =
    Shapes(
        extraSmall = RoundedCornerShape(8.dp),
        small = RoundedCornerShape(12.dp),
        medium = CutCornerShape(topStart = 14.dp, topEnd = 4.dp, bottomEnd = 14.dp, bottomStart = 4.dp),
        large = RoundedCornerShape(20.dp),
        extraLarge = RoundedCornerShape(24.dp),
    )

@Composable
fun VoiceTheme(
    themePresetId: String = AppThemePresets.DEFAULT_ID,
    content: @Composable () -> Unit
) {
    val preset = AppThemePresets.find(themePresetId) ?: AppThemePresets.all.first()
    val colorScheme = preset.toColorScheme()
    val shapes =
        if (preset.id == AppThemePresets.NEO_VECTORHEART_ID) {
            NeoVectorheartShapes
        } else {
            DefaultThemeShapes
        }

    ProvideTextScramble(enabled = false) {
        CompositionLocalProvider(LocalAppThemePreset provides preset) {
            MaterialTheme(
                colorScheme = colorScheme,
                typography = Typography,
                shapes = shapes,
            ) {
                CompositionLocalProvider(LocalContentColor provides colorScheme.onSurface) {
                    content()
                }
            }
        }
    }
}

/** Фон полосы серверов из текущей темы. */
val currentServerListBackground: Color
    @Composable get() = LocalAppThemePreset.current.serverListBackground
