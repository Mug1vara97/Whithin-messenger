package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.presentation.ui.media.CHAT_PHOTO_MAX_DECODE_PX
import com.whithin.voice.presentation.ui.media.MediaAspectCache
import com.whithin.voice.presentation.ui.media.buildChatPhotoImageRequest
import com.whithin.voice.presentation.ui.media.reportMediaThumbnailBounds
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

/**
 * Single photo in a message, sized like Telegram's `ChatMessageCell` (see [telegramPhotoSizeDp]).
 * Intrinsic size comes from the server when available, otherwise from [MediaAspectCache]
 * (filled on first decode and persisted).
 *
 * Декод стабилен: размер запроса завязан на max ширину колонки, а не на текущий бокс после
 * узнавания aspect — иначе фото грузилось дважды и «залипало» на сером плейсхолдере.
 */
@Composable
fun ImageMessageItem(
    mediaFile: MediaFile,
    timestamp: String = "",
    modifier: Modifier = Modifier,
    /** When false, time is shown in the caption/header row. */
    showTimeBadge: Boolean = true,
    /** Clip shape; use flat bottom when a caption sits below inside one bubble. */
    clipShape: Shape = RoundedCornerShape(TelegramMessageUi.MediaCornerRadius),
    /** Если задан — ограничение ширины карточки (напр. канал без «пузырей»). */
    layoutMaxWidth: Dp? = null,
    isOwn: Boolean = false,
    status: String? = null,
    onImageClick: () -> Unit = {},
) {
    val context = LocalContext.current
    val telegramMax = rememberTelegramBubbleMaxWidth()
    val maxBubbleW = layoutMaxWidth ?: telegramMax
    val screenW = LocalConfiguration.current.screenWidthDp.dp
    val density = LocalDensity.current

    val imageUrl = remember(mediaFile.filePath, mediaFile.filePathAlt) { buildMessageMediaUrl(mediaFile.filePathValue) }
    val thumbnailUrl =
        remember(mediaFile.thumbnailPath, mediaFile.thumbnailPathAlt, imageUrl) {
            mediaFile.thumbnailPathValue?.let { buildMessageMediaUrl(it) }?.takeIf { it.isNotBlank() }
        }
    // Для чата всегда предпочитаем thumbnail — полный файл только если thumb нет.
    val displayUrl = thumbnailUrl ?: imageUrl

    remember(context) {
        MediaAspectCache.ensureLoaded(context)
        Unit
    }
    var intrinsic by
        remember(imageUrl) {
            MediaAspectCache.seed(imageUrl, mediaFile)
            mutableStateOf(MediaAspectCache.get(imageUrl) ?: MediaAspectCache.get(displayUrl))
        }

    val (boxW, boxH) =
        remember(maxBubbleW, screenW, intrinsic) {
            telegramPhotoSizeDp(
                intrinsicW = intrinsic?.width ?: 0,
                intrinsicH = intrinsic?.height ?: 0,
                maxWidth = maxBubbleW,
                screenWidth = screenW,
            )
        }

    // Стабильный decode target: max ширина колонки (не текущий box после aspect).
    val decodeTargetPx =
        remember(maxBubbleW, density) {
            with(density) { maxBubbleW.toPx().roundToInt() }
                .coerceAtLeast(1)
                .coerceAtMost(CHAT_PHOTO_MAX_DECODE_PX)
        }
    val request =
        remember(displayUrl, decodeTargetPx) {
            buildChatPhotoImageRequest(context, displayUrl, decodeTargetPx, decodeTargetPx)
        }

    Box(
        modifier =
            modifier
                .width(boxW)
                .height(boxH)
                .clip(clipShape)
                .background(Color(0xFF2B2D31))
                .reportMediaThumbnailBounds(imageUrl)
                .clickable(onClick = onImageClick),
    ) {
        AsyncImage(
            model = request,
            contentDescription = mediaFile.fileName ?: "Image",
            contentScale = ContentScale.Crop,
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .width(boxW)
                    .height(boxH),
            onSuccess = { success: AsyncImagePainter.State.Success ->
                if (intrinsic == null) {
                    val d = success.result.drawable
                    if (d.intrinsicWidth > 0 && d.intrinsicHeight > 0) {
                        MediaAspectCache.put(imageUrl, d.intrinsicWidth, d.intrinsicHeight)
                        if (displayUrl != imageUrl) {
                            MediaAspectCache.put(displayUrl, d.intrinsicWidth, d.intrinsicHeight)
                        }
                        intrinsic = IntSize(d.intrinsicWidth, d.intrinsicHeight)
                    }
                }
            },
        )

        if (showTimeBadge && timestamp.isNotEmpty()) {
            val formattedTime = remember(timestamp) { formatTimestamp(timestamp) }
            MediaTimeBadge(
                time = formattedTime,
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

private fun formatTimestamp(timestamp: String): String {
    return try {
        val instant = Instant.parse(timestamp)
        val localTime = instant.atZone(ZoneId.systemDefault())
        localTime.format(DateTimeFormatter.ofPattern("HH:mm"))
    } catch (e: Exception) {
        timestamp.takeIf { it.length <= 5 }
            ?: timestamp.substringAfterLast("T").substringBefore(".").take(5)
    }
}
