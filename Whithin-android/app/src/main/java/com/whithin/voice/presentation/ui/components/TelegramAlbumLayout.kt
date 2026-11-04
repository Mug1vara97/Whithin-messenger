package com.whithin.voice.presentation.ui.components

import androidx.compose.ui.unit.IntRect
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Port of Telegram Android `MessageObject.GroupedMessages.calculate()`.
 *
 * Works in Telegram's abstract units: width 800, height 814. Each cell gets a column/row
 * span, a width `pw` (in 1/800 of the album width) and a height `ph` (fraction of the
 * album max height). [albumRects] converts that into pixel rectangles.
 */
internal class AlbumPosition {
    var minX = 0
    var maxX = 0
    var minY = 0
    var maxY = 0
    var pw = 0
    var ph = 0f
    var flags = 0
    var aspectRatio = 1f
    var spanSize = 0
    var leftSpanOffset = 0
    var siblingHeights: FloatArray? = null

    fun set(minX: Int, maxX: Int, minY: Int, maxY: Int, w: Int, h: Float, flags: Int) {
        this.minX = minX
        this.maxX = maxX
        this.minY = minY
        this.maxY = maxY
        this.pw = w
        this.spanSize = w
        this.ph = h
        this.flags = flags
    }

    val isLeft: Boolean get() = flags and TelegramAlbumLayout.FLAG_LEFT != 0
    val isRight: Boolean get() = flags and TelegramAlbumLayout.FLAG_RIGHT != 0
    val isTop: Boolean get() = flags and TelegramAlbumLayout.FLAG_TOP != 0
    val isBottom: Boolean get() = flags and TelegramAlbumLayout.FLAG_BOTTOM != 0
}

internal object TelegramAlbumLayout {
    const val FLAG_LEFT = 1
    const val FLAG_RIGHT = 2
    const val FLAG_TOP = 4
    const val FLAG_BOTTOM = 8

    const val MAX_SIZE_WIDTH = 800
    const val MAX_SIZE_HEIGHT = 814f

    private class Attempt(val lineCounts: IntArray, val heights: FloatArray)

    /**
     * @param aspects width/height per item (1.0 when unknown)
     * @param screenMinSideDp min(screenWidthDp, screenHeightDp) — Telegram converts its dp
     *   minimums into layout units via this value
     * @param albumMaxHeightDp the height that `ph == 1` maps to
     */
    fun calculate(
        aspects: List<Float>,
        screenMinSideDp: Float,
        albumMaxHeightDp: Float,
    ): List<AlbumPosition> {
        val count = aspects.size
        val posArray = ArrayList<AlbumPosition>(count)
        if (count == 0) return posArray

        val maxSizeWidth = MAX_SIZE_WIDTH
        val maxSizeHeight = MAX_SIZE_HEIGHT

        val proportions = StringBuilder()
        var averageAspectRatio = 1f
        var forceCalc = false
        var maxX = 0

        for (a in 0 until count) {
            val position = AlbumPosition()
            val ar = aspects[a].takeIf { it > 0f && it.isFinite() } ?: 1f
            position.aspectRatio = ar
            when {
                ar > 1.2f -> proportions.append('w')
                ar < 0.8f -> proportions.append('n')
                else -> proportions.append('q')
            }
            averageAspectRatio += ar
            if (ar > 2.0f) forceCalc = true
            posArray.add(position)
        }

        // dp → layout units (Telegram divides dp by screenMinSide / maxSizeWidth).
        val unitPerDp = maxSizeWidth / screenMinSideDp.coerceAtLeast(1f)
        val minWidth = (120f * unitPerDp).toInt()
        val minHeight = (120f * unitPerDp).toInt()
        val paddingsWidth = (40f * unitPerDp).toInt()
        val dp58 = (58f * unitPerDp).toInt()

        val maxAspectRatio = maxSizeWidth / maxSizeHeight
        averageAspectRatio /= count
        val minH = (100f / albumMaxHeightDp.coerceAtLeast(1f)).coerceAtMost(0.5f)

        if (count == 1) {
            val p1 = posArray[0]
            val height =
                min(maxSizeWidth / p1.aspectRatio, min(maxSizeWidth / p1.aspectRatio, maxSizeHeight / 2f))
                    .roundToInt() / maxSizeHeight
            p1.set(0, 0, 0, 0, maxSizeWidth, height, FLAG_LEFT or FLAG_RIGHT or FLAG_TOP or FLAG_BOTTOM)
        } else if (!forceCalc && (count == 2 || count == 3 || count == 4)) {
            if (count == 2) {
                val p1 = posArray[0]
                val p2 = posArray[1]
                val pString = proportions.toString()
                if (pString == "ww" && averageAspectRatio > 1.4 * maxAspectRatio && p1.aspectRatio - p2.aspectRatio < 0.2) {
                    val height =
                        min(maxSizeWidth / p1.aspectRatio, min(maxSizeWidth / p2.aspectRatio, maxSizeHeight / 2f))
                            .roundToInt() / maxSizeHeight
                    p1.set(0, 0, 0, 0, maxSizeWidth, height, FLAG_LEFT or FLAG_RIGHT or FLAG_TOP)
                    p2.set(0, 0, 1, 1, maxSizeWidth, height, FLAG_LEFT or FLAG_RIGHT or FLAG_BOTTOM)
                } else if (pString == "ww" || pString == "qq") {
                    val width = maxSizeWidth / 2
                    val height =
                        min(width / p1.aspectRatio, min(width / p2.aspectRatio, maxSizeHeight))
                            .roundToInt() / maxSizeHeight
                    p1.set(0, 0, 0, 0, width, height, FLAG_LEFT or FLAG_BOTTOM or FLAG_TOP)
                    p2.set(1, 1, 0, 0, width, height, FLAG_RIGHT or FLAG_BOTTOM or FLAG_TOP)
                    maxX = 1
                } else {
                    var secondWidth =
                        max(
                            0.4f * maxSizeWidth,
                            (maxSizeWidth / p1.aspectRatio / (1f / p1.aspectRatio + 1f / p2.aspectRatio)).roundToInt().toFloat(),
                        ).toInt()
                    var firstWidth = maxSizeWidth - secondWidth
                    if (firstWidth < minWidth) {
                        val diff = minWidth - firstWidth
                        firstWidth = minWidth
                        secondWidth -= diff
                    }
                    val height =
                        min(
                            maxSizeHeight,
                            min(firstWidth / p1.aspectRatio, secondWidth / p2.aspectRatio).roundToInt().toFloat(),
                        ) / maxSizeHeight
                    p1.set(0, 0, 0, 0, firstWidth, height, FLAG_LEFT or FLAG_BOTTOM or FLAG_TOP)
                    p2.set(1, 1, 0, 0, secondWidth, height, FLAG_RIGHT or FLAG_BOTTOM or FLAG_TOP)
                    maxX = 1
                }
            } else if (count == 3) {
                val p1 = posArray[0]
                val p2 = posArray[1]
                val p3 = posArray[2]
                if (proportions[0] == 'n') {
                    val thirdHeight =
                        min(
                            maxSizeHeight * 0.5f,
                            (p2.aspectRatio * maxSizeWidth / (p3.aspectRatio + p2.aspectRatio)).roundToInt().toFloat(),
                        )
                    val secondHeight = maxSizeHeight - thirdHeight
                    val rightWidth =
                        max(
                            minWidth.toFloat(),
                            min(
                                maxSizeWidth * 0.5f,
                                min(thirdHeight * p3.aspectRatio, secondHeight * p2.aspectRatio).roundToInt().toFloat(),
                            ),
                        ).toInt()
                    val leftWidth =
                        min(maxSizeHeight * p1.aspectRatio + paddingsWidth, (maxSizeWidth - rightWidth).toFloat()).roundToInt()
                    p1.set(0, 0, 0, 1, leftWidth, 1f, FLAG_LEFT or FLAG_BOTTOM or FLAG_TOP)
                    p2.set(1, 1, 0, 0, rightWidth, secondHeight / maxSizeHeight, FLAG_RIGHT or FLAG_TOP)
                    p3.set(0, 1, 1, 1, rightWidth, thirdHeight / maxSizeHeight, FLAG_RIGHT or FLAG_BOTTOM)
                    p3.spanSize = maxSizeWidth
                    p1.siblingHeights = floatArrayOf(thirdHeight / maxSizeHeight, secondHeight / maxSizeHeight)
                    p2.spanSize = maxSizeWidth - leftWidth
                    p3.leftSpanOffset = leftWidth
                    maxX = 1
                } else {
                    val firstHeight =
                        min(maxSizeWidth / p1.aspectRatio, maxSizeHeight * 0.66f).roundToInt() / maxSizeHeight
                    p1.set(0, 1, 0, 0, maxSizeWidth, firstHeight, FLAG_LEFT or FLAG_RIGHT or FLAG_TOP)
                    val width = maxSizeWidth / 2
                    var secondHeight =
                        min(
                            maxSizeHeight - firstHeight,
                            min(width / p2.aspectRatio, width / p3.aspectRatio).roundToInt().toFloat(),
                        ) / maxSizeHeight
                    if (secondHeight < minH) secondHeight = minH
                    p2.set(0, 0, 1, 1, width, secondHeight, FLAG_LEFT or FLAG_BOTTOM)
                    p3.set(1, 1, 1, 1, width, secondHeight, FLAG_RIGHT or FLAG_BOTTOM)
                    maxX = 1
                }
            } else {
                val p1 = posArray[0]
                val p2 = posArray[1]
                val p3 = posArray[2]
                val p4 = posArray[3]
                if (proportions[0] == 'w') {
                    val h0 = min(maxSizeWidth / p1.aspectRatio, maxSizeHeight * 0.66f).roundToInt() / maxSizeHeight
                    p1.set(0, 2, 0, 0, maxSizeWidth, h0, FLAG_LEFT or FLAG_RIGHT or FLAG_TOP)
                    var h = (maxSizeWidth / (p2.aspectRatio + p3.aspectRatio + p4.aspectRatio)).roundToInt().toFloat()
                    var w0 = max(minWidth.toFloat(), min(maxSizeWidth * 0.4f, h * p2.aspectRatio)).toInt()
                    var w2 = max(max(minWidth.toFloat(), maxSizeWidth * 0.33f), h * p4.aspectRatio).toInt()
                    var w1 = maxSizeWidth - w0 - w2
                    if (w1 < dp58) {
                        val diff = dp58 - w1
                        w1 = dp58
                        w0 -= diff / 2
                        w2 -= (diff - diff / 2)
                    }
                    h = min(maxSizeHeight - h0, h)
                    h /= maxSizeHeight
                    if (h < minH) h = minH
                    p2.set(0, 0, 1, 1, w0, h, FLAG_LEFT or FLAG_BOTTOM)
                    p3.set(1, 1, 1, 1, w1, h, FLAG_BOTTOM)
                    p4.set(2, 2, 1, 1, w2, h, FLAG_RIGHT or FLAG_BOTTOM)
                    maxX = 2
                } else {
                    val w =
                        max(
                            minWidth,
                            (maxSizeHeight / (1f / p2.aspectRatio + 1f / p3.aspectRatio + 1f / p4.aspectRatio)).roundToInt(),
                        )
                    val h0 = min(0.33f, max(minHeight.toFloat(), w / p2.aspectRatio) / maxSizeHeight)
                    val h1 = min(0.33f, max(minHeight.toFloat(), w / p3.aspectRatio) / maxSizeHeight)
                    val h2 = 1f - h0 - h1
                    val w0 = min(maxSizeHeight * p1.aspectRatio + paddingsWidth, (maxSizeWidth - w).toFloat()).roundToInt()
                    p1.set(0, 0, 0, 2, w0, h0 + h1 + h2, FLAG_LEFT or FLAG_TOP or FLAG_BOTTOM)
                    p2.set(1, 1, 0, 0, w, h0, FLAG_RIGHT or FLAG_TOP)
                    p3.set(0, 1, 1, 1, w, h1, FLAG_RIGHT)
                    p3.spanSize = maxSizeWidth
                    p4.set(0, 1, 2, 2, w, h2, FLAG_RIGHT or FLAG_BOTTOM)
                    p4.spanSize = maxSizeWidth
                    p2.spanSize = maxSizeWidth - w0
                    p3.leftSpanOffset = w0
                    p4.leftSpanOffset = w0
                    p1.siblingHeights = floatArrayOf(h0, h1, h2)
                    maxX = 1
                }
            }
        } else {
            val croppedRatios = FloatArray(count)
            for (a in 0 until count) {
                croppedRatios[a] =
                    if (averageAspectRatio > 1.1f) {
                        max(1f, posArray[a].aspectRatio)
                    } else {
                        min(1f, posArray[a].aspectRatio)
                    }
                croppedRatios[a] = max(0.66667f, min(1.7f, croppedRatios[a]))
            }

            fun multiHeight(start: Int, end: Int): Float {
                var sum = 0f
                for (a in start until end) sum += croppedRatios[a]
                return maxSizeWidth / sum
            }

            val attempts = ArrayList<Attempt>()
            val n = croppedRatios.size
            for (firstLine in 1 until n) {
                val secondLine = n - firstLine
                if (firstLine > 3 || secondLine > 3) continue
                attempts.add(
                    Attempt(
                        intArrayOf(firstLine, secondLine),
                        floatArrayOf(multiHeight(0, firstLine), multiHeight(firstLine, n)),
                    ),
                )
            }
            for (firstLine in 1 until n - 1) {
                for (secondLine in 1 until n - firstLine) {
                    val thirdLine = n - firstLine - secondLine
                    if (firstLine > 3 || secondLine > (if (averageAspectRatio < 0.85f) 4 else 3) || thirdLine > 3) continue
                    attempts.add(
                        Attempt(
                            intArrayOf(firstLine, secondLine, thirdLine),
                            floatArrayOf(
                                multiHeight(0, firstLine),
                                multiHeight(firstLine, firstLine + secondLine),
                                multiHeight(firstLine + secondLine, n),
                            ),
                        ),
                    )
                }
            }
            for (firstLine in 1 until n - 2) {
                for (secondLine in 1 until n - firstLine) {
                    for (thirdLine in 1 until n - firstLine - secondLine) {
                        val fourthLine = n - firstLine - secondLine - thirdLine
                        if (firstLine > 3 || secondLine > 3 || thirdLine > 3 || fourthLine > 3) continue
                        attempts.add(
                            Attempt(
                                intArrayOf(firstLine, secondLine, thirdLine, fourthLine),
                                floatArrayOf(
                                    multiHeight(0, firstLine),
                                    multiHeight(firstLine, firstLine + secondLine),
                                    multiHeight(firstLine + secondLine, firstLine + secondLine + thirdLine),
                                    multiHeight(firstLine + secondLine + thirdLine, n),
                                ),
                            ),
                        )
                    }
                }
            }

            var optimal: Attempt? = null
            var optimalDiff = 0f
            val maxHeight = maxSizeWidth / 3f * 4f
            for (attempt in attempts) {
                var height = 0f
                var minLineHeight = Float.MAX_VALUE
                for (h in attempt.heights) {
                    height += h
                    if (h < minLineHeight) minLineHeight = h
                }
                var diff = abs(height - maxHeight)
                val lc = attempt.lineCounts
                if (lc.size > 1) {
                    if (lc[0] > lc[1] || (lc.size > 2 && lc[1] > lc[2]) || (lc.size > 3 && lc[2] > lc[3])) {
                        diff *= 1.2f
                    }
                }
                if (minLineHeight < minWidth) diff *= 1.5f
                if (optimal == null || diff < optimalDiff) {
                    optimal = attempt
                    optimalDiff = diff
                }
            }
            val chosen = optimal ?: return posArray

            var index = 0
            for (i in chosen.lineCounts.indices) {
                val c = chosen.lineCounts[i]
                val lineHeight = chosen.heights[i]
                var spanLeft = maxSizeWidth
                var posToFix: AlbumPosition? = null
                maxX = max(maxX, c - 1)
                for (k in 0 until c) {
                    val ratio = croppedRatios[index]
                    val width = (ratio * lineHeight).toInt()
                    spanLeft -= width
                    val pos = posArray[index]
                    var flags = 0
                    if (i == 0) flags = flags or FLAG_TOP
                    if (i == chosen.lineCounts.size - 1) flags = flags or FLAG_BOTTOM
                    if (k == 0) flags = flags or FLAG_LEFT
                    if (k == c - 1) {
                        flags = flags or FLAG_RIGHT
                        posToFix = pos
                    }
                    pos.set(k, k, i, i, width, max(minH, lineHeight / maxSizeHeight), flags)
                    index++
                }
                posToFix?.let {
                    it.pw += spanLeft
                    it.spanSize += spanLeft
                }
            }
        }
        return posArray
    }

    /**
     * Converts abstract positions to pixel rects inside an album of [widthPx] where
     * `ph == 1f` maps to [maxHeightPx]. [gapPx] is removed from the right/bottom edge of
     * cells that have a neighbour on that side.
     *
     * Returns the rects and the resulting album size.
     */
    fun albumRects(
        positions: List<AlbumPosition>,
        widthPx: Int,
        maxHeightPx: Int,
        gapPx: Int,
    ): Pair<List<IntRect>, androidx.compose.ui.unit.IntSize> {
        if (positions.isEmpty()) return emptyList<IntRect>() to androidx.compose.ui.unit.IntSize.Zero
        val rowCount = positions.maxOf { it.maxY } + 1
        val rowHeights = FloatArray(rowCount)
        for (p in positions) {
            if (p.minY == p.maxY) {
                rowHeights[p.minY] = max(rowHeights[p.minY], p.ph * maxHeightPx)
            }
        }
        // Rows only covered by spanning cells: split evenly using siblingHeights when available.
        for (p in positions) {
            if (p.minY != p.maxY) {
                val sib = p.siblingHeights
                for (y in p.minY..p.maxY) {
                    if (rowHeights[y] <= 0f) {
                        rowHeights[y] =
                            if (sib != null && y - p.minY < sib.size) {
                                sib[y - p.minY] * maxHeightPx
                            } else {
                                p.ph * maxHeightPx / (p.maxY - p.minY + 1)
                            }
                    }
                }
            }
        }
        val rowTops = FloatArray(rowCount + 1)
        for (y in 0 until rowCount) rowTops[y + 1] = rowTops[y] + rowHeights[y]

        fun unitsToPx(units: Int): Int = ceil(units / MAX_SIZE_WIDTH.toFloat() * widthPx).toInt()

        val rects = ArrayList<IntRect>(positions.size)
        var albumW = 0
        var albumH = 0
        for (p in positions) {
            val x =
                if (p.leftSpanOffset != 0) {
                    unitsToPx(p.leftSpanOffset)
                } else {
                    var sum = 0
                    for (o in positions) {
                        if (o === p) continue
                        if (o.maxX < p.minX && o.minY <= p.maxY && o.maxY >= p.minY) {
                            sum += unitsToPx(o.pw)
                        }
                    }
                    sum
                }
            val w = unitsToPx(p.pw)
            val top = rowTops[p.minY].roundToInt()
            val bottom = rowTops[p.maxY + 1].roundToInt()
            var right = x + w
            var b = bottom
            albumW = max(albumW, right)
            albumH = max(albumH, b)
            if (!p.isRight) right -= gapPx
            if (!p.isBottom) b -= gapPx
            rects.add(IntRect(left = x, top = top, right = max(x + 1, right), bottom = max(top + 1, b)))
        }
        return rects to androidx.compose.ui.unit.IntSize(albumW.coerceAtMost(widthPx), albumH)
    }
}
