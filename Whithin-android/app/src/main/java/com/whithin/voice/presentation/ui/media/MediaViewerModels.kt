package com.whithin.voice.presentation.ui.media

import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.data.model.Message
import com.whithin.voice.presentation.ui.components.buildMessageMediaUrl

data class MediaViewerItem(
    val url: String,
    val filePath: String,
    val contentType: String,
    val isVideo: Boolean,
    val senderUsername: String = "",
    val createdAt: String = "",
    val caption: String = "",
    val fileName: String = "",
    /** Low-res preview shown while the full image/video loads (Telegram shows the chat thumb). */
    val thumbnailUrl: String = "",
    val durationSeconds: Double? = null,
    val fileSize: Long? = null,
    val isVideoNote: Boolean = false,
)

data class MediaViewerState(
    val items: List<MediaViewerItem>,
    val initialIndex: Int,
) {
    val currentIndex: Int get() = initialIndex.coerceIn(0, (items.size - 1).coerceAtLeast(0))
}

fun mediaFileToViewerItem(
    mediaFile: MediaFile,
    message: Message? = null,
    captionOverride: String? = null,
): MediaViewerItem {
    val contentType = mediaFile.contentTypeValue
    val isVideo = contentType.startsWith("video/")
    return MediaViewerItem(
        url = buildMessageMediaUrl(mediaFile.filePath),
        filePath = mediaFile.filePathValue,
        contentType = contentType,
        isVideo = isVideo,
        senderUsername =
            mediaFile.senderUsernameValue.ifBlank {
                message?.senderUsernameValue.orEmpty()
            },
        createdAt =
            mediaFile.createdAtValue.ifBlank {
                message?.createdAtValue.orEmpty()
            },
        caption =
            captionOverride?.trim().orEmpty().ifBlank {
                mediaFile.captionValue.ifBlank { message?.contentValue.orEmpty() }
            },
        fileName = mediaFile.displayNameValue,
        thumbnailUrl = mediaFile.thumbnailPathValue?.let { buildMessageMediaUrl(it) }.orEmpty(),
        durationSeconds = mediaFile.durationSecondsValue,
        fileSize = mediaFile.fileSize ?: mediaFile.fileSizeAlt,
        isVideoNote = mediaFile.isVideoNoteValue,
    )
}

fun buildViewerStateFromMessage(
    message: Message,
    clickedUrl: String,
): MediaViewerState? {
    val visual =
        message.mediaFilesValue.filter {
            val type = it.contentTypeValue
            type.startsWith("image/") || type.startsWith("video/")
        }
    if (visual.isEmpty()) return null
    val caption = message.contentValue
    val items = visual.map { mediaFileToViewerItem(it, message, caption) }
    val index =
        visual.indexOfFirst { buildMessageMediaUrl(it.filePath) == clickedUrl }
            .takeIf { it >= 0 }
            ?: items.indexOfFirst { it.url == clickedUrl }
    if (index < 0) return null
    return MediaViewerState(items = items, initialIndex = index)
}

fun buildViewerStateFromMediaList(
    mediaFiles: List<MediaFile>,
    initialIndex: Int,
    includeVideos: Boolean,
    includeImages: Boolean,
): MediaViewerState? {
    val filtered =
        mediaFiles.filter { file ->
            val type = file.contentTypeValue
            (includeImages && type.startsWith("image/")) ||
                (includeVideos && type.startsWith("video/"))
        }
    if (filtered.isEmpty() || initialIndex !in filtered.indices) return null
    return MediaViewerState(
        items = filtered.map { mediaFileToViewerItem(it) },
        initialIndex = initialIndex,
    )
}

fun buildViewerStateFromMediaListByUrl(
    mediaFiles: List<MediaFile>,
    clickedUrl: String,
    caption: String = "",
    senderUsername: String = "",
    createdAt: String = "",
): MediaViewerState? {
    val visuals =
        mediaFiles.filter {
            val type = it.contentTypeValue
            type.startsWith("image/") || type.startsWith("video/")
        }
    if (visuals.isEmpty()) return null
    val items =
        visuals.map { media ->
            mediaFileToViewerItem(media, captionOverride = caption).copy(
                senderUsername = senderUsername.ifBlank { media.senderUsernameValue },
                createdAt = createdAt.ifBlank { media.createdAtValue },
            )
        }
    val index =
        visuals.indexOfFirst { buildMessageMediaUrl(it.filePath) == clickedUrl }
            .takeIf { it >= 0 }
            ?: items.indexOfFirst { it.url == clickedUrl }
    if (index < 0) return null
    return MediaViewerState(items = items, initialIndex = index)
}
