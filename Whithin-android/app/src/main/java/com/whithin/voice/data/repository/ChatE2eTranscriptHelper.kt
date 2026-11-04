package com.whithin.voice.data.repository

import com.whithin.voice.data.e2e.E2eConstants
import com.whithin.voice.data.e2e.E2eCryptoService
import com.whithin.voice.data.e2e.E2eEnvelope
import com.whithin.voice.data.model.Message

internal class ChatE2eTranscriptHelper(
    private val e2eCrypto: E2eCryptoService,
) {
    suspend fun prepareOutgoingText(
        userId: String?,
        chatId: String,
        content: String,
        memberUserIds: List<String>,
        strictAllMembers: Boolean,
    ): Pair<String, Int> {
        val resolvedUserId = userId?.trim().orEmpty()
        if (resolvedUserId.isBlank() || content.isBlank()) {
            return content to 0
        }
        val encrypted =
            e2eCrypto.encryptChatMessage(
                userId = resolvedUserId,
                chatId = chatId,
                memberUserIds = memberUserIds,
                plaintext = content,
                strictAllMembers = strictAllMembers,
            )
        return encrypted.content to encrypted.encryptionVersion
    }

    fun applyCachedDecryptedContent(
        incoming: Message,
        cachedById: Map<String, Message>,
    ): Message {
        val cached = cachedById[incoming.messageIdValue] ?: return incoming
        if (incoming.encryptionVersionValue <= 0) return incoming
        val incomingContent = incoming.contentValue.trim()
        if (!E2eEnvelope.isE2eEnvelope(incomingContent)) return incoming
        val cachedContent = cached.contentValue.trim()
        if (
            cachedContent.isBlank() ||
            cachedContent == E2eConstants.DECRYPT_FAILED_TEXT ||
            E2eEnvelope.isE2eEnvelope(cachedContent)
        ) {
            return incoming
        }
        return incoming.copy(content = cachedContent, contentAlt = null)
    }

    suspend fun decryptIncomingMessage(
        message: Message,
        chatId: String,
        existing: Message? = null,
        userId: String?,
        memberUserIds: List<String>,
        peerUserId: String?,
    ): Message {
        val encryptionVersion = message.encryptionVersionValue
        if (encryptionVersion <= 0) return message
        val resolvedUserId = userId?.trim().orEmpty()
        if (resolvedUserId.isBlank()) return message
        val ciphertext = message.contentValue
        val memberIds = linkedSetOf<String>()
        memberIds.addAll(memberUserIds)
        memberIds.add(resolvedUserId)
        message.senderIdValue.trim().takeIf { it.isNotBlank() }?.let { memberIds.add(it) }
        val decrypted =
            e2eCrypto.decryptChatMessage(
                userId = resolvedUserId,
                chatId = chatId,
                memberUserIds = memberIds.toList(),
                content = ciphertext,
                encryptionVersion = encryptionVersion,
                peerUserId = peerUserId,
            )
        val displayContent =
            resolveE2eMessageContent(
                chatId = chatId,
                decrypted = decrypted,
                ciphertext = ciphertext,
                existing = existing,
            )
        return message.copy(content = displayContent, contentAlt = null)
    }

    suspend fun decryptIncomingMessages(
        messages: List<Message>,
        chatId: String,
        existingMessages: List<Message>,
        userId: String?,
        memberUserIds: List<String>,
        peerUserId: String?,
    ): List<Message> {
        if (messages.none { it.encryptionVersionValue > 0 }) return messages
        val resolvedUserId = userId?.trim().orEmpty()
        if (resolvedUserId.isBlank()) return messages

        val existingById = existingMessages.associateBy { it.messageIdValue }
        val memberIds = linkedSetOf<String>()
        memberIds.addAll(memberUserIds)
        memberIds.add(resolvedUserId)
        messages.forEach { message ->
            message.senderIdValue.trim().takeIf { it.isNotBlank() }?.let { memberIds.add(it) }
        }
        e2eCrypto.prepareChatKeyForDecrypt(resolvedUserId, chatId, memberIds.toList())

        val result = ArrayList<Message>(messages.size)
        for (message in messages) {
            result.add(
                decryptIncomingMessage(
                    message = message,
                    chatId = chatId,
                    existing = existingById[message.messageIdValue],
                    userId = resolvedUserId,
                    memberUserIds = memberUserIds,
                    peerUserId = peerUserId,
                ),
            )
        }
        return result
    }

    fun resolveE2eMessageContent(
        chatId: String,
        decrypted: String,
        ciphertext: String,
        existing: Message?,
    ): String {
        if (decrypted != E2eConstants.DECRYPT_FAILED_TEXT) return decrypted

        val existingContent = existing?.contentValue?.trim().orEmpty()
        if (
            existingContent.isNotBlank() &&
            existingContent != E2eConstants.DECRYPT_FAILED_TEXT &&
            !E2eEnvelope.isE2eEnvelope(existingContent)
        ) {
            return existingContent
        }

        if (!e2eCrypto.hasLocalChatKey(chatId)) {
            return ciphertext
        }

        return E2eConstants.DECRYPT_FAILED_TEXT
    }

    fun pendingE2eMessagePreview(incoming: Message, existing: Message?): Message {
        if (incoming.encryptionVersionValue <= 0) return incoming
        val existingContent = existing?.contentValue?.trim().orEmpty()
        if (
            existingContent.isNotBlank() &&
            existingContent != E2eConstants.DECRYPT_FAILED_TEXT &&
            !E2eEnvelope.isE2eEnvelope(existingContent)
        ) {
            return incoming.copy(content = existingContent, contentAlt = null)
        }
        return incoming
    }

    fun messagesContentChanged(before: List<Message>, after: List<Message>): Boolean {
        if (before.size != after.size) return true
        val afterById = after.associateBy { it.messageIdValue }
        return before.any { prev ->
            val next = afterById[prev.messageIdValue] ?: return@any true
            prev.contentValue != next.contentValue
        }
    }
}
