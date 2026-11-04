package com.whithin.voice.presentation.notifications

import com.whithin.voice.data.e2e.E2eConstants
import com.whithin.voice.data.e2e.E2eCryptoService
import com.whithin.voice.data.e2e.E2eEnvelope
import com.whithin.voice.data.model.Message
import com.whithin.voice.util.formatCallLogText
import com.whithin.voice.util.parseCallLogPayload

object MessageNotificationPreview {
    const val TYPE_TEXT = "text"
    const val TYPE_IMAGE = "image"
    const val TYPE_STICKER = "sticker"
    const val TYPE_VOICE = "voice"
    const val TYPE_VIDEO = "video"
    const val TYPE_VIDEO_NOTE = "video_note"
    const val TYPE_FILE = "file"

    fun previewForMessage(message: Message, currentUserId: String = ""): String {
        parseCallLogPayload(message.contentValue)?.let { payload ->
            formatCallLogText(payload, currentUserId)?.let { return it }
        }
        if (message.encryptionVersionValue > 0 && E2eEnvelope.isE2eEnvelope(message.contentValue)) {
            return "Зашифрованное сообщение"
        }
        val content = message.contentValue.trim()
        if (content.isNotBlank()) return content
        if (message.isStickerMessage) return "Стикер"

        val media = message.mediaFilesValue.firstOrNull() ?: return ""
        return previewForMedia(
            mediaContentType = media.contentTypeValue,
            isVideoNote = media.isVideoNoteValue,
            caption = "",
        )
    }

    fun previewForMedia(
        mediaContentType: String,
        isVideoNote: Boolean,
        caption: String = "",
    ): String {
        val trimmedCaption = caption.trim()
        if (isVideoNote) return withCaption("Видеосообщение", trimmedCaption)

        val type = mediaContentType.lowercase()
        return when {
            type.startsWith("image/") -> withCaption("Фото", trimmedCaption)
            type.startsWith("audio/") || type.startsWith("voice/") -> withCaption("Голосовое сообщение", trimmedCaption)
            type.startsWith("video/") -> withCaption("Видео", trimmedCaption)
            trimmedCaption.isNotBlank() -> trimmedCaption
            else -> "Вложение"
        }
    }

    suspend fun resolveEncryptedPushBody(
        data: Map<String, String>,
        userId: String,
        e2eCrypto: E2eCryptoService,
    ): String? {
        val encryptionVersion =
            data["encryption_version"]?.toIntOrNull()
                ?: data["encryptionVersion"]?.toIntOrNull()
                ?: 0
        if (encryptionVersion <= 0 || userId.isBlank()) return null

        val ciphertext = resolveEncryptedPayloadFromPush(data) ?: return null
        val chatId =
            data["chat_id"]?.trim().orEmpty()
                .ifBlank { data["chatId"]?.trim().orEmpty() }
        if (chatId.isBlank()) return null

        val senderId =
            data["sender_id"]?.trim().orEmpty()
                .ifBlank { data["senderId"]?.trim().orEmpty() }
                .ifBlank { null }

        val decrypted =
            e2eCrypto.decryptNotificationPreview(
                userId = userId,
                chatId = chatId,
                ciphertext = ciphertext,
                encryptionVersion = encryptionVersion,
                senderId = senderId,
            )
        return decrypted?.trim()?.takeIf { it.isNotBlank() }?.let(::truncateForNotification)
    }

    fun resolveEncryptedPayloadFromPush(data: Map<String, String>): String? {
        val explicit =
            data["encrypted_payload"]?.trim().orEmpty()
                .ifBlank { data["encryptedPayload"]?.trim().orEmpty() }
        if (explicit.isNotBlank()) return explicit

        val message =
            data["message"]?.trim().orEmpty()
                .ifBlank { data["body"]?.trim().orEmpty() }
                .ifBlank { data["content"]?.trim().orEmpty() }
        return message.takeIf { E2eEnvelope.isE2eEnvelope(it) }
    }

    fun previewForPush(
        messageType: String?,
        fallbackMessage: String,
        previewText: String?,
        encrypted: Boolean = false,
    ): String {
        previewText
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?.takeUnless { encrypted && isEncryptedPlaceholder(it) }
            ?.let { return it }

        val normalizedType = messageType?.trim()?.lowercase().orEmpty()
        if (normalizedType.isNotBlank()) {
            return when (normalizedType) {
                TYPE_STICKER -> "Стикер"
                TYPE_IMAGE -> "Фото"
                TYPE_VOICE -> "Голосовое сообщение"
                TYPE_VIDEO -> "Видео"
                TYPE_VIDEO_NOTE -> "Видеосообщение"
                TYPE_FILE -> "Вложение"
                TYPE_TEXT ->
                    if (encrypted) {
                        E2eConstants.ENCRYPTED_PLACEHOLDER
                    } else {
                        fallbackMessage
                    }
                else -> if (encrypted) E2eConstants.ENCRYPTED_PLACEHOLDER else fallbackMessage
            }
        }

        if (encrypted) {
            return E2eConstants.ENCRYPTED_PLACEHOLDER
        }

        return fallbackMessage
    }

    fun truncateForNotification(text: String, maxLength: Int = 140): String {
        val trimmed = text.trim()
        if (trimmed.length <= maxLength) return trimmed
        return trimmed.take(maxLength)
    }

    private fun isEncryptedPlaceholder(text: String): Boolean {
        val normalized = text.trim()
        return normalized.equals(E2eConstants.ENCRYPTED_PLACEHOLDER, ignoreCase = true) ||
            normalized.equals("Encrypted message", ignoreCase = true) ||
            normalized.contains("Зашифрованное сообщение", ignoreCase = true)
    }

    fun shouldLoadThumbnail(messageType: String?, thumbnailUrl: String?): Boolean {
        if (thumbnailUrl.isNullOrBlank()) return false
        val type = messageType?.trim()?.lowercase().orEmpty()
        return type == TYPE_IMAGE || type == TYPE_STICKER || type == TYPE_VIDEO || type == TYPE_VIDEO_NOTE
    }

    private fun withCaption(label: String, caption: String): String =
        if (caption.isBlank()) label else "$label: $caption"
}
