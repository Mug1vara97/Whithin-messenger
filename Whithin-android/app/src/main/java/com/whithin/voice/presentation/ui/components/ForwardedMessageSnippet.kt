package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Forward
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.ForwardedMessage
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

@Composable
fun ForwardedMessageSnippet(
    forwarded: ForwardedMessage,
    modifier: Modifier = Modifier,
    mediaLayoutMaxWidth: Dp = 320.dp,
    onImageClick: (String) -> Unit = {},
    onVideoClick: (String) -> Unit = {},
    onVideoNoteOpen: () -> Unit = {},
) {
    val body = forwarded.bodyValue
    val chatName = forwarded.originalChatNameValue.trim()
    val mediaFiles = forwarded.mediaFilesValue
    val visualMedia =
        mediaFiles.filter {
            it.contentType?.startsWith("image/") == true || it.contentType?.startsWith("video/") == true
        }
    val voiceMedia = mediaFiles.filter { it.contentType?.startsWith("audio/") == true }
    val fileMedia =
        mediaFiles.filter { media ->
            val type = media.contentType ?: ""
            !type.startsWith("image/") && !type.startsWith("video/") && !type.startsWith("audio/")
        }
    val hasWideContent =
        body.isNotBlank() || voiceMedia.isNotEmpty() || fileMedia.isNotEmpty()

    Row(
        modifier =
            modifier
                .then(
                    if (hasWideContent) {
                        Modifier.fillMaxWidth()
                    } else {
                        Modifier.wrapContentWidth(Alignment.Start)
                    },
                )
                .height(IntrinsicSize.Min)
                .padding(bottom = 6.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxHeight()
                    .width(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(TelegramMessageUi.AccentBlue),
        )
        Spacer(modifier = Modifier.width(8.dp))
        Column(
            modifier =
                Modifier
                    .then(
                        if (hasWideContent) {
                            Modifier.weight(1f).fillMaxWidth()
                        } else {
                            Modifier.wrapContentWidth(Alignment.Start)
                        },
                    )
                    .widthIn(max = mediaLayoutMaxWidth),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Forward,
                    contentDescription = null,
                    tint = TelegramMessageUi.AccentBlue,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Переслано от ${forwarded.senderUsernameValue}",
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (chatName.isNotBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "из $chatName",
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (body.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                LinkifiedMessageText(
                    text = body,
                    color = DiscordText,
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                )
            }

            if (forwarded.isStickerMessage) {
                Spacer(modifier = Modifier.height(6.dp))
                forwarded.stickerValue?.let { sticker ->
                    StickerMedia(
                        filePath = sticker.filePathValue,
                        contentType = sticker.contentTypeValue,
                        contentDescription = "Стикер",
                        contentScale = ContentScale.Fit,
                        previewSizeDp = 160.dp,
                        modifier =
                            Modifier
                                .defaultMinSize(minWidth = 160.dp, minHeight = 160.dp)
                                .size(160.dp),
                    )
                }
            } else if (visualMedia.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Column(
                    modifier = Modifier.wrapContentWidth(Alignment.Start),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    visualMedia.forEach { media ->
                        val url = buildForwardedMediaUrl(media.filePath ?: "")
                        if (media.contentType?.startsWith("image/") == true) {
                            ImageMessageItem(
                                mediaFile = media,
                                timestamp = "",
                                showTimeBadge = false,
                                clipShape = RoundedCornerShape(8.dp),
                                layoutMaxWidth = mediaLayoutMaxWidth,
                                onImageClick = { onImageClick(url) },
                            )
                        } else if (media.contentType?.startsWith("video/") == true) {
                            VideoMessageItem(
                                mediaFile = media,
                                timestamp = "",
                                showTimeBadge = false,
                                clipShape = RoundedCornerShape(8.dp),
                                layoutMaxWidth = mediaLayoutMaxWidth,
                                isVideoNote = media.isVideoNoteValue,
                                onVideoNoteOpen = onVideoNoteOpen,
                                onVideoClick = { onVideoClick(url) },
                            )
                        }
                    }
                }
            }

            if (voiceMedia.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    voiceMedia.forEach { voice ->
                        VoiceMessageItem(mediaFile = voice, modifier = Modifier.fillMaxWidth())
                    }
                }
            }

            if (fileMedia.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    fileMedia.forEach { file ->
                        FileMessageItem(mediaFile = file, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}

private fun buildForwardedMediaUrl(filePath: String): String =
    when {
        filePath.startsWith("http://") || filePath.startsWith("https://") -> filePath
        filePath.startsWith("/uploads/") -> "https://whithin.ru$filePath"
        filePath.startsWith("uploads/") -> "https://whithin.ru/$filePath"
        else -> "https://whithin.ru/uploads/$filePath"
    }
