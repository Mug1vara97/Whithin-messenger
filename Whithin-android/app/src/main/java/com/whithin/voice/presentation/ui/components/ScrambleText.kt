package com.whithin.voice.presentation.ui.components

import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import kotlinx.coroutines.delay
import java.util.concurrent.ConcurrentHashMap

/**
 * Как в веб-клиенте: `useGlobalTextScramble`.
 * В UI-файлах используйте `import ... AppText as Text` — тогда любой `Text(...)` в Compose
 * получает scramble (кроме [LocalTextScrambleEnabled] = false и коротких строк).
 */
const val DEFAULT_SCRAMBLE_CHARSET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789░▒▓█"

val LocalTextScrambleEnabled = compositionLocalOf { false }

object TextScrambleRegistry {
    private val completedKeys = ConcurrentHashMap.newKeySet<String>()

    /** @return true, если анимация для этого ключа ещё не проигрывалась */
    fun consumeAnimation(key: String): Boolean = completedKeys.add(key)

    fun clear() {
        completedKeys.clear()
    }
}

@Composable
fun ProvideTextScramble(
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalTextScrambleEnabled provides enabled) {
        content()
    }
}

/**
 * Текст с «расшифровкой» символов (scramble), как в WhithinMessenger.Client.
 */
@Composable
fun ScrambleText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    fontSize: TextUnit = TextUnit.Unspecified,
    fontStyle: FontStyle? = null,
    fontWeight: FontWeight? = null,
    fontFamily: FontFamily? = null,
    letterSpacing: TextUnit = TextUnit.Unspecified,
    textDecoration: TextDecoration? = null,
    textAlign: TextAlign? = null,
    lineHeight: TextUnit = TextUnit.Unspecified,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
    style: TextStyle = LocalTextStyle.current,
    durationMs: Long = 500,
    fps: Int = 20,
    charset: String = DEFAULT_SCRAMBLE_CHARSET,
    minAnimatedLength: Int = 2,
    animationKey: Any? = text,
    scrambleOnce: Boolean = true,
) {
    val resolvedColor =
        if (color != Color.Unspecified) color else MaterialTheme.colorScheme.onSurface
    val resolvedStyle = mergeTextStyle(
        base = style,
        color = resolvedColor,
        fontSize = fontSize,
        fontStyle = fontStyle,
        fontWeight = fontWeight,
        fontFamily = fontFamily,
        letterSpacing = letterSpacing,
        textDecoration = textDecoration,
        textAlign = textAlign,
        lineHeight = lineHeight,
    )
    val enabled = LocalTextScrambleEnabled.current
    val registryKey = animationKey?.toString()
    val shouldScramble =
        enabled &&
            text.trim().length >= minAnimatedLength &&
            text.length <= 80

    val shouldRunAnimation =
        remember(registryKey, text, shouldScramble, scrambleOnce) {
            if (!shouldScramble) {
                false
            } else if (!scrambleOnce || registryKey.isNullOrBlank()) {
                true
            } else {
                TextScrambleRegistry.consumeAnimation(registryKey)
            }
        }

    if (!shouldRunAnimation) {
        Text(
            text = text,
            modifier = modifier,
            maxLines = maxLines,
            overflow = overflow,
            style = resolvedStyle,
        )
        return
    }

    var displayed by remember(registryKey, text) {
        mutableStateOf(scramblePartial(text, charset, revealedCount = 0))
    }

    LaunchedEffect(registryKey, text) {
        val chars = text.toCharArray()
        val total = chars.size
        val frameInterval = 1000L / fps.coerceAtLeast(1)
        val startedAt = System.currentTimeMillis()

        while (true) {
            val elapsed = System.currentTimeMillis() - startedAt
            val progress = (elapsed.toFloat() / durationMs.coerceAtLeast(1L)).coerceIn(0f, 1f)
            val revealed = (progress * total).toInt()
            displayed = scramblePartial(text, charset, revealed)

            if (progress >= 1f) {
                displayed = text
                break
            }
            delay(frameInterval)
        }
    }

    Text(
        text = displayed,
        modifier = modifier,
        maxLines = maxLines,
        overflow = overflow,
        style = resolvedStyle,
    )
}

/** Обычный [Text], но с scramble, если включён [LocalTextScrambleEnabled]. */
@Composable
fun AppText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    fontSize: TextUnit = TextUnit.Unspecified,
    fontStyle: FontStyle? = null,
    fontWeight: FontWeight? = null,
    fontFamily: FontFamily? = null,
    letterSpacing: TextUnit = TextUnit.Unspecified,
    textDecoration: TextDecoration? = null,
    textAlign: TextAlign? = null,
    lineHeight: TextUnit = TextUnit.Unspecified,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
    style: TextStyle = LocalTextStyle.current,
    animationKey: Any? = text,
    scrambleOnce: Boolean = true,
    minAnimatedLength: Int = 2,
) {
    val resolvedColor =
        if (color != Color.Unspecified) color else MaterialTheme.colorScheme.onSurface
    if (LocalTextScrambleEnabled.current) {
        ScrambleText(
            text = text,
            modifier = modifier,
            color = resolvedColor,
            fontSize = fontSize,
            fontStyle = fontStyle,
            fontWeight = fontWeight,
            fontFamily = fontFamily,
            letterSpacing = letterSpacing,
            textDecoration = textDecoration,
            textAlign = textAlign,
            lineHeight = lineHeight,
            maxLines = maxLines,
            overflow = overflow,
            style = style,
            animationKey = animationKey,
            scrambleOnce = scrambleOnce,
            minAnimatedLength = minAnimatedLength,
        )
    } else {
        Text(
            text = text,
            modifier = modifier,
            maxLines = maxLines,
            overflow = overflow,
            style =
                mergeTextStyle(
                    base = style,
                    color = resolvedColor,
                    fontSize = fontSize,
                    fontStyle = fontStyle,
                    fontWeight = fontWeight,
                    fontFamily = fontFamily,
                    letterSpacing = letterSpacing,
                    textDecoration = textDecoration,
                    textAlign = textAlign,
                    lineHeight = lineHeight,
                ),
        )
    }
}

private fun mergeTextStyle(
    base: TextStyle,
    color: Color,
    fontSize: TextUnit,
    fontStyle: FontStyle?,
    fontWeight: FontWeight?,
    fontFamily: FontFamily?,
    letterSpacing: TextUnit,
    textDecoration: TextDecoration?,
    textAlign: TextAlign?,
    lineHeight: TextUnit,
): TextStyle {
    var merged =
        base.merge(
            TextStyle(
                color = color,
                fontSize = fontSize,
                fontStyle = fontStyle,
                fontWeight = fontWeight,
                fontFamily = fontFamily,
                letterSpacing = letterSpacing,
                textDecoration = textDecoration,
                lineHeight = lineHeight,
            ),
        )
    if (textAlign != null) {
        merged = merged.merge(TextStyle(textAlign = textAlign))
    }
    return merged
}

private fun scramblePartial(text: String, charset: String, revealedCount: Int): String {
    return text.mapIndexed { index, char ->
        when {
            char.isWhitespace() -> char
            index < revealedCount -> char
            else -> charset.random()
        }
    }.joinToString("")
}
