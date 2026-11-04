package com.whithin.voice.presentation.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * Текст сообщения с Markdown. Нативный Compose [Text] + кешированный
 * [AnnotatedString][androidx.compose.ui.text.AnnotatedString] из [MessageMarkdown]:
 * строка списка стоит как обычный Text, а не как AndroidView с Markwon.
 */
@Composable
fun MessageMarkdownText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color? = null,
    fontSize: TextUnit = 16.sp,
    lineHeight: TextUnit = 22.sp,
    linkColor: Color? = null,
    @Suppress("UNUSED_PARAMETER") compact: Boolean = false,
) {
    if (text.isBlank()) return

    val resolvedColor = color ?: MaterialTheme.colorScheme.onBackground
    val resolvedLinkColor = linkColor ?: TelegramMessageUi.AccentBlue
    val codeBackground = resolvedColor.copy(alpha = 0.10f)

    val annotated =
        remember(text, resolvedLinkColor, codeBackground) {
            MessageMarkdown.render(text, resolvedLinkColor, codeBackground)
        }
    val style =
        remember(resolvedColor, fontSize, lineHeight) {
            TextStyle(
                color = resolvedColor,
                fontSize = fontSize,
                lineHeight = lineHeight,
            )
        }

    Text(
        text = annotated,
        modifier = modifier,
        style = style,
    )
}
