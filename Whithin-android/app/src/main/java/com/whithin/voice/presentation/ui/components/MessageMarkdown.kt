package com.whithin.voice.presentation.ui.components

import android.util.LruCache
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.em

/**
 * Лёгкий Markdown → [AnnotatedString] для текста сообщений.
 *
 * Поддерживает тот же набор, что и веб-клиент (react-markdown + gfm + breaks)
 * в объёме, нужном чату: **жирный**, *курсив*, ~~зачёркнутый~~, `код`,
 * ```блоки кода```, [ссылки](url), автоссылки, заголовки, цитаты, списки.
 *
 * Результат кешируется — элемент списка при повторном появлении на экране
 * не парсится заново. Это заменяет AndroidView+Markwon, которые создавали
 * TextView и экземпляр Markwon на каждую строку LazyColumn.
 */
object MessageMarkdown {
    private const val MAX_DEPTH = 6
    private val cache = LruCache<String, AnnotatedString>(600)

    private val boldStyle = SpanStyle(fontWeight = FontWeight.Bold)
    private val italicStyle = SpanStyle(fontStyle = FontStyle.Italic)
    private val strikeStyle = SpanStyle(textDecoration = TextDecoration.LineThrough)

    private val headingRegex = Regex("^#{1,6}\\s+")
    private val bulletRegex = Regex("^(\\s*)[-*+]\\s+")
    private val orderedRegex = Regex("^\\s*\\d+[.)]\\s+")
    private val hrRegex = Regex("^\\s*([-*_])\\1{2,}\\s*$")

    fun render(
        text: String,
        linkColor: Color,
        codeBackground: Color,
    ): AnnotatedString {
        val key = "${linkColor.value}|${codeBackground.value}|$text"
        cache.get(key)?.let { return it }
        val result = parse(text, linkColor, codeBackground)
        cache.put(key, result)
        return result
    }

    fun clearCache() {
        cache.evictAll()
    }

    private class Styles(
        linkColor: Color,
        codeBackground: Color,
    ) {
        val link = TextLinkStyles(
            style = SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline),
        )
        val code = SpanStyle(
            fontFamily = FontFamily.Monospace,
            background = codeBackground,
            fontSize = 0.92.em,
        )
    }

    private fun parse(
        raw: String,
        linkColor: Color,
        codeBackground: Color,
    ): AnnotatedString {
        val styles = Styles(linkColor, codeBackground)
        val text = raw.replace("\r\n", "\n").replace('\r', '\n')
        val lines = text.split('\n')

        return buildAnnotatedString {
            var inFence = false
            var firstLine = true
            for (line in lines) {
                val trimmed = line.trimStart()
                if (trimmed.startsWith("```")) {
                    inFence = !inFence
                    continue
                }
                if (!firstLine) append('\n')
                firstLine = false

                if (inFence) {
                    withStyle(styles.code) { append(line) }
                    continue
                }

                when {
                    hrRegex.matches(line) -> append("———")
                    headingRegex.containsMatchIn(line) -> {
                        val body = line.replaceFirst(headingRegex, "")
                        withStyle(boldStyle) { appendInline(body, styles, 0) }
                    }
                    trimmed.startsWith(">") -> {
                        val body = trimmed.removePrefix(">").removePrefix(" ")
                        append("▎ ")
                        withStyle(italicStyle) { appendInline(body, styles, 0) }
                    }
                    bulletRegex.containsMatchIn(line) -> {
                        val match = bulletRegex.find(line)!!
                        append(match.groupValues[1])
                        append("• ")
                        appendInline(line.substring(match.range.last + 1), styles, 0)
                    }
                    orderedRegex.containsMatchIn(line) -> {
                        val match = orderedRegex.find(line)!!
                        append(line.substring(0, match.range.last + 1))
                        appendInline(line.substring(match.range.last + 1), styles, 0)
                    }
                    else -> appendInline(line, styles, 0)
                }
            }
        }
    }

    private fun AnnotatedString.Builder.appendInline(
        s: String,
        styles: Styles,
        depth: Int,
    ) {
        if (s.isEmpty()) return
        if (depth > MAX_DEPTH) {
            append(s)
            return
        }
        var i = 0
        val n = s.length
        while (i < n) {
            val c = s[i]
            when {
                c == '\\' && i + 1 < n -> {
                    append(s[i + 1])
                    i += 2
                }

                c == '`' -> {
                    val close = s.indexOf('`', i + 1)
                    if (close > i + 1) {
                        withStyle(styles.code) { append(s, i + 1, close) }
                        i = close + 1
                    } else {
                        append(c)
                        i++
                    }
                }

                s.startsWith("**", i) || s.startsWith("__", i) -> {
                    val delim = s.substring(i, i + 2)
                    val close = findClosing(s, delim, i + 2)
                    if (close > 0) {
                        withStyle(boldStyle) { appendInline(s.substring(i + 2, close), styles, depth + 1) }
                        i = close + 2
                    } else {
                        append(delim)
                        i += 2
                    }
                }

                s.startsWith("~~", i) -> {
                    val close = findClosing(s, "~~", i + 2)
                    if (close > 0) {
                        withStyle(strikeStyle) { appendInline(s.substring(i + 2, close), styles, depth + 1) }
                        i = close + 2
                    } else {
                        append("~~")
                        i += 2
                    }
                }

                (c == '*' || c == '_') && canOpenEmphasis(s, i) -> {
                    val close = findEmphasisClose(s, c, i + 1)
                    if (close > 0) {
                        withStyle(italicStyle) { appendInline(s.substring(i + 1, close), styles, depth + 1) }
                        i = close + 1
                    } else {
                        append(c)
                        i++
                    }
                }

                c == '[' -> {
                    val consumed = tryAppendMarkdownLink(s, i, styles, depth)
                    if (consumed > 0) {
                        i += consumed
                    } else {
                        append(c)
                        i++
                    }
                }

                c == '<' -> {
                    val close = s.indexOf('>', i + 1)
                    val inner = if (close > i + 1) s.substring(i + 1, close) else null
                    if (inner != null && isHttpUrl(inner) && inner.none { it.isWhitespace() }) {
                        appendLink(inner, inner, styles)
                        i = close + 1
                    } else {
                        append(c)
                        i++
                    }
                }

                isAutolinkStart(s, i) -> {
                    val end = autolinkEnd(s, i)
                    val urlText = s.substring(i, end)
                    val href = if (urlText.startsWith("www.", ignoreCase = true)) "https://$urlText" else urlText
                    appendLink(urlText, href, styles)
                    i = end
                }

                else -> {
                    append(c)
                    i++
                }
            }
        }
    }

    private fun AnnotatedString.Builder.appendLink(
        label: String,
        href: String,
        styles: Styles,
    ) {
        val start = length
        append(label)
        addLink(LinkAnnotation.Url(url = href, styles = styles.link), start, length)
    }

    /** Возвращает количество потреблённых символов или 0, если это не ссылка. */
    private fun AnnotatedString.Builder.tryAppendMarkdownLink(
        s: String,
        start: Int,
        styles: Styles,
        depth: Int,
    ): Int {
        val closeBracket = s.indexOf(']', start + 1)
        if (closeBracket <= start + 1) return 0
        if (closeBracket + 1 >= s.length || s[closeBracket + 1] != '(') return 0
        val closeParen = s.indexOf(')', closeBracket + 2)
        if (closeParen < 0) return 0
        val label = s.substring(start + 1, closeBracket)
        var href = s.substring(closeBracket + 2, closeParen).trim()
        // [text](url "title") — отбрасываем title
        val spaceIdx = href.indexOf(' ')
        if (spaceIdx > 0) href = href.substring(0, spaceIdx)
        if (href.isEmpty()) return 0
        if (href.startsWith("www.", ignoreCase = true)) href = "https://$href"
        if (!isHttpUrl(href) && !href.startsWith("mailto:", ignoreCase = true)) return 0

        val linkStart = length
        appendInline(label, styles, depth + 1)
        addLink(LinkAnnotation.Url(url = href, styles = styles.link), linkStart, length)
        return closeParen - start + 1
    }

    private fun findClosing(s: String, delim: String, from: Int): Int {
        var idx = s.indexOf(delim, from)
        while (idx > 0) {
            if (idx > from && !s[idx - 1].isWhitespace()) return idx
            idx = s.indexOf(delim, idx + 1)
        }
        return -1
    }

    private fun canOpenEmphasis(s: String, i: Int): Boolean {
        val c = s[i]
        if (i + 1 >= s.length) return false
        val next = s[i + 1]
        if (next.isWhitespace() || next == c) return false
        if (c == '_') {
            val prev = if (i > 0) s[i - 1] else ' '
            if (prev.isLetterOrDigit()) return false
        }
        return true
    }

    private fun findEmphasisClose(s: String, c: Char, from: Int): Int {
        var idx = s.indexOf(c, from)
        while (idx > 0) {
            val prev = s[idx - 1]
            val next = if (idx + 1 < s.length) s[idx + 1] else ' '
            val ok =
                idx > from &&
                    !prev.isWhitespace() &&
                    next != c &&
                    (c != '_' || !next.isLetterOrDigit())
            if (ok) return idx
            idx = s.indexOf(c, idx + 1)
        }
        return -1
    }

    private fun isHttpUrl(s: String): Boolean =
        s.startsWith("http://", ignoreCase = true) || s.startsWith("https://", ignoreCase = true)

    private fun isAutolinkStart(s: String, i: Int): Boolean {
        val prev = if (i > 0) s[i - 1] else ' '
        if (prev.isLetterOrDigit() || prev == '/' || prev == '@') return false
        return s.startsWith("http://", i, ignoreCase = true) ||
            s.startsWith("https://", i, ignoreCase = true) ||
            s.startsWith("www.", i, ignoreCase = true)
    }

    private fun autolinkEnd(s: String, start: Int): Int {
        var end = start
        while (end < s.length) {
            val ch = s[end]
            if (ch.isWhitespace() || ch == '<' || ch == '>' || ch == '"' || ch == '\'') break
            end++
        }
        // Хвостовая пунктуация и несбалансированные скобки не входят в ссылку.
        while (end > start) {
            val last = s[end - 1]
            if (last in ".,;:!?*_~") {
                end--
                continue
            }
            if (last == ')') {
                val slice = s.substring(start, end)
                if (slice.count { it == '(' } < slice.count { it == ')' }) {
                    end--
                    continue
                }
            }
            break
        }
        val minLen = if (s.startsWith("www.", start, ignoreCase = true)) 5 else 9
        return if (end - start < minLen) start + 1 else end
    }
}
