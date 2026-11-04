package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.presentation.ui.media.MediaAspectCache
import com.whithin.voice.presentation.ui.media.buildChatPhotoImageRequest
import com.whithin.voice.presentation.ui.media.reportMediaThumbnailBounds
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlin.math.max

internal fun buildMessageMediaUrl(filePath: String?): String {
    val path = filePath.orEmpty()
    return when {
        path.startsWith("http://") || path.startsWith("https://") -> path
        path.startsWith("content://") || path.startsWith("file://") -> path
        path.startsWith("/uploads/") -> "https://whithin.ru$path"
        path.startsWith("uploads/") -> "https://whithin.ru/$path"
        path.isNotBlank() -> "https://whithin.ru/uploads/$path"
        else -> ""
    }
}

/**
 * Photo/video album laid out with Telegram's `GroupedMessages.calculate()` algorithm
 * (see [TelegramAlbumLayout]). Aspect ratios come from the server or [MediaAspectCache];
 * unknown ones are probed once from the thumbnails and then the album re-flows.
 */
@Composable
fun MessageMediaAlbumGrid(
    mediaFiles: List<MediaFile>,
    layoutMaxWidth: Dp,
    clipShape: Shape = RoundedCornerShape(TelegramMessageUi.MediaCornerRadius),
    showTimeBadge: Boolean = true,
    timestamp: String = "",
    isOwn: Boolean = false,
    status: String? = null,
    onImageClick: (String) -> Unit,
    onVideoClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (mediaFiles.isEmpty()) return
    val context = LocalContext.current
    val density = LocalDensity.current
    val configuration = LocalConfiguration.current
    remember(context) { MediaAspectCache.ensureLoaded(context); Unit }

    // Stable per-item keys and URLs.
    val urls =
        remember(mediaFiles) {
            mediaFiles.map { media ->
                val full = buildMessageMediaUrl(media.filePathValue)
                val thumb = media.thumbnailPathValue?.let { buildMessageMediaUrl(it) }?.takeIf { it.isNotBlank() }
                MediaAspectCache.seed(full, media)
                AlbumItemUrls(full = full, thumb = thumb ?: full, isVideo = media.contentTypeValue.startsWith("video/"))
            }
        }

    var aspects by
        remember(urls) {
            mutableStateOf(
                urls.map { u ->
                    val size = MediaAspectCache.get(u.full) ?: MediaAspectCache.get(u.thumb)
                    if (size != null && size.width > 0 && size.height > 0) size.width.toFloat() / size.height else 0f
                },
            )
        }

    // Probe unknown aspect ratios once (cheap tiny decodes), then re-flow a single time.
    LaunchedEffect(urls) {
        if (aspects.none { it <= 0f }) return@LaunchedEffect
        val probed =
            coroutineScope {
                urls.mapIndexed { index, u ->
                    async {
                        if (aspects[index] > 0f) {
                            aspects[index]
                        } else {
                            val size = MediaAspectCache.probe(context, u.thumb)
                            if (size != null) {
                                MediaAspectCache.put(u.full, size.width, size.height)
                                size.width.toFloat() / size.height
                            } else {
                                0f
                            }
                        }
                    }
                }.awaitAll()
            }
        aspects = probed
    }

    val screenMinSide = minOf(configuration.screenWidthDp, configuration.screenHeightDp).toFloat()
    val albumMaxHeight = rememberTelegramAlbumMaxHeight()
    val positions =
        remember(aspects, screenMinSide, albumMaxHeight) {
            TelegramAlbumLayout.calculate(
                aspects = aspects.map { if (it > 0f) it else 1f },
                screenMinSideDp = screenMinSide,
                albumMaxHeightDp = albumMaxHeight.value,
            )
        }
    val widthPx = with(density) { layoutMaxWidth.roundToPx() }
    val maxHeightPx = with(density) { albumMaxHeight.roundToPx() }
    val gapPx = with(density) { TelegramMessageUi.AlbumCellGap.roundToPx() }
    val (rects, albumSize) =
        remember(positions, widthPx, maxHeightPx, gapPx) {
            TelegramAlbumLayout.albumRects(positions, widthPx, maxHeightPx, gapPx)
        }
    if (rects.size != mediaFiles.size) return

    val innerRadius = TelegramMessageUi.AlbumInnerRadius
    val outerRadius = TelegramMessageUi.MediaCornerRadius

    Box(modifier = modifier.clip(clipShape)) {
        Layout(
            content = {
                mediaFiles.forEachIndexed { index, media ->
                    val pos = positions[index]
                    val rect = rects[index]
                    val shape =
                        remember(pos.flags) {
                            RoundedCornerShape(
                                topStart = if (pos.isTop && pos.isLeft) outerRadius else innerRadius,
                                topEnd = if (pos.isTop && pos.isRight) outerRadius else innerRadius,
                                bottomEnd = if (pos.isBottom && pos.isRight) outerRadius else innerRadius,
                                bottomStart = if (pos.isBottom && pos.isLeft) outerRadius else innerRadius,
                            )
                        }
                    AlbumMediaCell(
                        media = media,
                        urls = urls[index],
                        cellWidthPx = rect.width,
                        cellHeightPx = rect.height,
                        shape = shape,
                        onImageClick = onImageClick,
                        onVideoClick = onVideoClick,
                    )
                }
            },
        ) { measurables, _ ->
            val placeables =
                measurables.mapIndexed { index, measurable ->
                    val r = rects[index]
                    measurable.measure(Constraints.fixed(max(1, r.width), max(1, r.height)))
                }
            layout(max(1, albumSize.width), max(1, albumSize.height)) {
                placeables.forEachIndexed { index, placeable ->
                    val r: IntRect = rects[index]
                    placeable.place(r.left, r.top)
                }
            }
        }

        if (showTimeBadge && timestamp.isNotBlank()) {
            MediaTimeBadge(
                time = timestamp,
                isOwn = isOwn,
                status = status,
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .padding(6.dp),
            )
        }
    }
}

internal class AlbumItemUrls(
    val full: String,
    val thumb: String,
    val isVideo: Boolean,
)

@Composable
private fun AlbumMediaCell(
    media: MediaFile,
    urls: AlbumItemUrls,
    cellWidthPx: Int,
    cellHeightPx: Int,
    shape: Shape,
    onImageClick: (String) -> Unit,
    onVideoClick: (String) -> Unit,
) {
    val context = LocalContext.current
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .clip(shape)
                .background(Color(0xFF2B2D31))
                .reportMediaThumbnailBounds(urls.full)
                .clickable {
                    if (urls.isVideo) onVideoClick(urls.full) else onImageClick(urls.full)
                },
        contentAlignment = Alignment.Center,
    ) {
        if (urls.isVideo) {
            VideoThumbnailBox(
                videoUrl = urls.full,
                thumbnailUrl = urls.thumb.takeIf { it != urls.full },
                contentDescription = media.fileName,
                modifier = Modifier.fillMaxSize(),
                playButtonSize = 36.dp,
                playIconSize = 22.dp,
                onThumbnailSize = { w, h -> MediaAspectCache.put(urls.full, w, h) },
            )
            val badge = remember(media) { videoBadgeLabel(media) }
            if (badge.isNotBlank()) {
                MediaPill(
                    text = badge,
                    modifier =
                        Modifier
                            .align(Alignment.TopStart)
                            .padding(4.dp),
                )
            }
        } else {
            // Декод от длинной стороны ячейки, capped — стабильный bucket с ImageMessageItem.
            val request =
                remember(urls.thumb, cellWidthPx, cellHeightPx) {
                    val side = maxOf(cellWidthPx, cellHeightPx).coerceAtLeast(1)
                    buildChatPhotoImageRequest(context, urls.thumb, side, side)
                }
            AsyncImage(
                model = request,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
fun MessageFileGroup(
    files: List<MediaFile>,
    modifier: Modifier = Modifier,
    onFileClick: ((MediaFile) -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        files.forEach { file ->
            FileMessageItem(
                mediaFile = file,
                onDownload = onFileClick?.let { callback -> { callback(file) } },
            )
        }
    }
}
