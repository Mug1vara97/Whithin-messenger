package com.whithin.voice.presentation.ui.screens.ideasboard

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

internal object IdeasBoardColors {
    val OuterBg = Color(0xFF1A1410)
    val BoardBg = Color(0xFFB58A4E)
    val BoardBorder = Color(0xFF5B3A1A)
    val BoardBorderLight = Color(0xFF6B4423)
    val BoardBorderDark = Color(0xFF3D2710)
    val StampRed = Color(0xFFA01818)
    val MetaRed = Color(0xFF7A1010)
    val Cream = Color(0xFFF4ECD8)
    val CardPaper = Color(0xFFF8F4E9)
    val InputBg = Color(0xFFFFFEF8)
    val CardInk = Color(0xFF111111)
    val BodyInk = Color(0xFF222222)
    val MutedBrown = Color(0xFF3D2710)
    val DashedMeta = Color(0xFFBBBAAA)
    val ModalFrame = Color(0xFFB8AF96)
    val ActionBorder = Color(0xFF555555)
    val TitleCutDefault = Color(0xFFE8E2D0)
    val Tape = Color(0xB8DCD2AA)
    val Overlay = Color(0xB80A0603)
    val PinHighlight = Color(0xFFFF6B6B)
    val PinShadow = Color(0xFFB01515)
}

internal val StringLineColors = listOf(
    Color(0xFF9E1B1B),
    Color(0xFF1B4D9E),
    Color(0xFF1B6B3A),
    Color(0xFF7A4A12),
    Color(0xFF5B2D82),
    Color(0xFFA16207),
    Color(0xFF0F6E7A),
    Color(0xFF9F1239),
    Color(0xFF4338CA),
    Color(0xFF047857),
)

internal object IdeasBoardFonts {
    val Stamp = FontFamily.Serif
    val Title = FontFamily.SansSerif
    val Body = FontFamily.Monospace
}

internal object IdeasBoardDimens {
    val BoardBorder = 14.dp
    val BoardMaxWidth = 1100.dp
    val MinCardWidth = 240.dp
    val MaxCardHeight = 190.dp
    val GridGapX = 15.dp
    val GridGapY = 14.dp
    val PinSize = 14.dp
    val TapeWidth = 40.dp
    val TapeHeight = 14.dp
}

internal data class IdeasBoardGridLayout(
    val cols: Int,
    val rows: Int,
    val cardMaxHeight: androidx.compose.ui.unit.Dp,
) {
    val cardsPerPage: Int get() = cols * rows
}

internal fun titleLetterStyle(index: Int): Pair<Color, Color> {
    return when ((index % 8) + 1) {
        2, 8 -> IdeasBoardColors.CardInk to IdeasBoardColors.Cream
        5 -> IdeasBoardColors.StampRed to Color.White
        else -> IdeasBoardColors.Cream to IdeasBoardColors.CardInk
    }
}

internal fun titleLetterRotation(index: Int): Float {
    return when ((index % 8) + 1) {
        1 -> -5f
        2 -> 3f
        3 -> -2f
        4 -> 4f
        5 -> -3f
        6 -> 2f
        7 -> -4f
        8 -> 3f
        else -> 0f
    }
}

internal fun cutTitleStyle(index: Int): Pair<Color, Color> {
    val oneBased = index + 1
    return when {
        oneBased % 3 == 0 -> IdeasBoardColors.CardInk to IdeasBoardColors.Cream
        oneBased % 4 == 0 -> IdeasBoardColors.StampRed to Color.White
        else -> IdeasBoardColors.TitleCutDefault to IdeasBoardColors.CardInk
    }
}

internal fun cutTitleRotation(index: Int): Float {
    val oneBased = index + 1
    return when {
        oneBased % 3 == 0 -> -3f
        oneBased % 4 == 0 -> 2f
        else -> 0f
    }
}

internal fun tagStringColor(tag: String): Color {
    var hash = 0
    tag.forEach { hash = it.code + ((hash shl 5) - hash) }
    return StringLineColors[kotlin.math.abs(hash) % StringLineColors.size]
}
