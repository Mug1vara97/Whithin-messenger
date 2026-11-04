package com.whithin.voice.presentation.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Статические значения для сборки ColorScheme и не-composable контекста. */
internal val StaticDiscordSuccess = Color(0xFF3BA55C)
internal val StaticDiscordError = Color(0xFFED4245)

val DiscordSuccess = StaticDiscordSuccess

val DiscordError: Color
    @Composable get() = MaterialTheme.colorScheme.error

val DiscordDark: Color
    @Composable get() = MaterialTheme.colorScheme.background

val DiscordDarker: Color
    @Composable get() = LocalAppThemePreset.current.serverListBackground

val DiscordDarkest: Color
    @Composable get() = MaterialTheme.colorScheme.surface

val DiscordText: Color
    @Composable get() = MaterialTheme.colorScheme.onBackground

val DiscordTextSecondary: Color
    @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant

val DiscordAccent: Color
    @Composable get() = MaterialTheme.colorScheme.primary

/** Основной фон чата и списка. */
val DiscordBackground: Color
    @Composable get() = MaterialTheme.colorScheme.background

/** Поверхность панелей, карточек и bottom sheet. */
val DiscordSurface: Color
    @Composable get() = MaterialTheme.colorScheme.surface

/** Фон модальных экранов профиля / настроек. */
val DiscordModalBackground: Color
    @Composable get() = MaterialTheme.colorScheme.background

/** Карточки внутри модальных экранов. */
val DiscordModalCard: Color
    @Composable get() = MaterialTheme.colorScheme.surface

/** Выбранная вкладка / chip. */
val DiscordTabSelected: Color
    @Composable get() = MaterialTheme.colorScheme.surfaceVariant

/** Границы, разделители, обводки элементов. */
val DiscordOutline: Color
    @Composable get() = MaterialTheme.colorScheme.outline

/** Вторичные границы / тонкие разделители. */
val DiscordOutlineVariant: Color
    @Composable get() = MaterialTheme.colorScheme.outlineVariant

val IsNeoVectorheartTheme: Boolean
    @Composable get() = LocalAppThemePreset.current.id == AppThemePresets.NEO_VECTORHEART_ID

val NeoVectorheartPanelBorder: Color
    @Composable
    get() =
        if (IsNeoVectorheartTheme) {
            Color(0x73FF2EA6)
        } else {
            DiscordOutlineVariant
        }

val NeoVectorheartGlow: Color
    @Composable
    get() =
        if (IsNeoVectorheartTheme) {
            Color(0x4D37E7FF)
        } else {
            Color.Transparent
        }
