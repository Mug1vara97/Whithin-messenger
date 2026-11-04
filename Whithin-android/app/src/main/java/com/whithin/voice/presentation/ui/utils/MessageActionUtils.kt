package com.whithin.voice.presentation.ui.utils

import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.data.model.Message

data class MessageContextMenuActions(
    val canCopyText: Boolean = false,
    val canCopyImage: Boolean = false,
    val canCopyVideo: Boolean = false,
    val canSaveAs: Boolean = false,
    val images: List<MediaFile> = emptyList(),
    val videos: List<MediaFile> = emptyList(),
    val savableMedia: List<MediaFile> = emptyList(),
)

fun effectiveMessageMediaFiles(message: Message?): List<MediaFile> {
    if (message == null) return emptyList()
    val forwarded = message.forwardedMessageValue
    if (forwarded?.mediaFilesValue?.isNotEmpty() == true) {
        return forwarded.mediaFilesValue
    }
    return message.mediaFilesValue
}

fun getCopyableMessageText(message: Message?): String {
    if (message == null) return ""
    if (message.isStickerMessage || message.isPollMessage) return ""

    val forwarded = message.forwardedMessageValue
    if (forwarded != null && forwarded.bodyValue.isNotBlank()) {
        val parts = mutableListOf(forwarded.bodyValue.trim())
        val comment = message.contentValue.trim()
        if (comment.isNotBlank()) parts += comment
        return parts.joinToString("\n\n")
    }

    return message.contentValue.trim()
}

fun getMessageContextMenuActions(message: Message?): MessageContextMenuActions {
    val mediaFiles = effectiveMessageMediaFiles(message)
    val visualMedia =
        mediaFiles.filter {
            val type = it.contentTypeValue
            type.startsWith("image/") || type.startsWith("video/")
        }
    val voiceMedia = mediaFiles.filter { it.contentTypeValue.startsWith("audio/") }
    val fileMedia =
        mediaFiles.filter { media ->
            val type = media.contentTypeValue
            !type.startsWith("image/") && !type.startsWith("video/") && !type.startsWith("audio/")
        }
    val images = visualMedia.filter { it.contentTypeValue.startsWith("image/") }
    val videos = visualMedia.filter { it.contentTypeValue.startsWith("video/") }
    val savableMedia = visualMedia + voiceMedia + fileMedia

    return MessageContextMenuActions(
        canCopyText = getCopyableMessageText(message).isNotBlank(),
        canCopyImage = images.isNotEmpty(),
        canCopyVideo = videos.isNotEmpty(),
        canSaveAs = savableMedia.isNotEmpty(),
        images = images,
        videos = videos,
        savableMedia = savableMedia,
    )
}

fun getPinnedMessagePreview(message: Message?): String {
    if (message == null) return "Сообщение"

    if (message.isPollMessage) {
        return message.pollValue?.questionValue?.trim().orEmpty()
            .ifBlank { message.contentValue.trim() }
            .ifBlank { "Опрос" }
    }

    if (message.isStickerMessage) return "Стикер"

    val text = formatE2eMessageDisplayText(message).trim()
    if (text.isNotBlank()) {
        return text.replace("\\s+".toRegex(), " ")
    }

    val media = message.mediaFilesValue.firstOrNull()
    if (media != null) {
        return when {
            media.isVideoNoteValue -> "Видеосообщение"
            media.contentTypeValue.startsWith("image/") -> "Фото"
            media.contentTypeValue.startsWith("video/") -> "Видео"
            media.contentTypeValue.startsWith("audio/") -> "Голосовое сообщение"
            else -> "Вложение"
        }
    }

    return "Сообщение"
}

fun formatPollVotesLabel(totalVotes: Int): String {
    val mod10 = totalVotes % 10
    val mod100 = totalVotes % 100
    val word =
        when {
            mod100 in 11..14 -> "голосов"
            mod10 == 1 -> "голос"
            mod10 in 2..4 -> "голоса"
            else -> "голосов"
        }
    return "$totalVotes $word"
}

fun pollOptionPercent(voteCount: Int, totalVotes: Int): Int {
    if (totalVotes <= 0) return 0
    return ((voteCount.toFloat() / totalVotes.toFloat()) * 100f).toInt().coerceIn(0, 100)
}
