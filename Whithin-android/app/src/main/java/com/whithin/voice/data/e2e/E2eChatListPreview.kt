package com.whithin.voice.data.e2e

import android.util.Log
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.whithin.voice.data.model.ChatInfo
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

data class NormalizedChatUpdatedPayload(
    val chatId: String?,
    val lastMessage: String,
    val lastMessageTime: String?,
    val lastMessageEncryptionVersion: Int,
    val lastMessageEncryptedPayload: String?,
    val lastMessageSenderId: String?,
)

object E2eChatListPreview {
    private const val TAG = "E2eChatListPreview"
    private const val CHAT_LIST_DECRYPT_CONCURRENCY = 4

    fun needsDecrypt(chat: ChatInfo): Boolean {
        if (chat.e2eLastMessageDecryptedValue) return false
        val encryptionVersion = resolveEncryptionVersion(chat)
        val ciphertext = resolveEncryptedPayload(chat)
        val chatId = chat.chatIdValue
        return encryptionVersion > 0 && !ciphertext.isNullOrBlank() && chatId.isNotBlank()
    }

    suspend fun decryptChatListItem(
        chat: ChatInfo,
        userId: String,
        e2eCrypto: E2eCryptoService,
    ): ChatInfo {
        if (!needsDecrypt(chat)) return chat

        val encryptionVersion = resolveEncryptionVersion(chat)
        val ciphertext = resolveEncryptedPayload(chat).orEmpty()
        val chatId = chat.chatIdValue
        val senderId = resolveSenderId(chat)
        val memberUserIds = buildMemberUserIds(userId, senderId, chat)

        return try {
            e2eCrypto.prepareChatKeyForDecrypt(userId, chatId, memberUserIds)
            val decrypted =
                e2eCrypto.decryptChatMessage(
                    userId = userId,
                    chatId = chatId,
                    memberUserIds = memberUserIds,
                    content = ciphertext,
                    encryptionVersion = encryptionVersion,
                    peerUserId = senderId,
                )
            if (decrypted.isBlank() || decrypted == E2eConstants.DECRYPT_FAILED_TEXT) {
                return chat
            }
            chat.copy(
                lastMessage = decrypted,
                lastMessageAlt = decrypted,
                lastMessageEncryptionVersion = encryptionVersion,
                lastMessageEncryptionVersionAlt = encryptionVersion,
                lastMessageEncryptedPayload = ciphertext,
                lastMessageEncryptedPayloadAlt = ciphertext,
                lastMessageSenderId = senderId,
                lastMessageSenderIdAlt = senderId,
                e2eLastMessageDecrypted = true,
                e2eLastMessageDecryptedAlt = true,
            )
        } catch (error: Exception) {
            Log.w(TAG, "E2E chat list decrypt failed chatId=$chatId", error)
            chat
        }
    }

    suspend fun decryptChatListItems(
        chats: List<ChatInfo>,
        userId: String,
        e2eCrypto: E2eCryptoService,
    ): List<ChatInfo> {
        if (userId.isBlank() || chats.isEmpty()) return chats
        val decryptSlots = Semaphore(CHAT_LIST_DECRYPT_CONCURRENCY)
        return coroutineScope {
            chats
                .map { chat ->
                    async {
                        decryptSlots.withPermit {
                            decryptChatListItem(chat, userId, e2eCrypto)
                        }
                    }
                }
                .awaitAll()
        }
    }

    fun normalizeChatUpdatedPayload(
        payload: Any?,
        gson: Gson,
    ): NormalizedChatUpdatedPayload {
        if (payload == null) {
            return NormalizedChatUpdatedPayload(
                chatId = null,
                lastMessage = "",
                lastMessageTime = null,
                lastMessageEncryptionVersion = 0,
                lastMessageEncryptedPayload = null,
                lastMessageSenderId = null,
            )
        }

        val map: Map<String, Any?> =
            when (payload) {
                is Map<*, *> -> payload.entries.associate { (k, v) -> k.toString() to v }
                else -> {
                    val json = gson.toJson(payload)
                    gson.fromJson(json, Map::class.java)
                        ?.entries
                        ?.associate { (k, v) -> k.toString() to v }
                        ?: emptyMap()
                }
            }

        return NormalizedChatUpdatedPayload(
            chatId = pick(map, "chatId", "ChatId"),
            lastMessage = pick(map, "lastMessage", "LastMessage") ?: "",
            lastMessageTime = pick(map, "lastMessageTime", "LastMessageTime"),
            lastMessageEncryptionVersion =
                pick(map, "encryptionVersion", "EncryptionVersion")
                    ?.toString()
                    ?.toIntOrNull()
                    ?.takeIf { it > 0 }
                    ?: 0,
            lastMessageEncryptedPayload = pick(map, "encryptedPayload", "EncryptedPayload"),
            lastMessageSenderId = pick(map, "senderId", "SenderId"),
        )
    }

    private fun resolveEncryptionVersion(chat: ChatInfo): Int {
        val explicit = chat.lastMessageEncryptionVersionValue
        if (explicit > 0) return explicit
        val payload = resolveEncryptedPayload(chat)
        if (!payload.isNullOrBlank() && E2eEnvelope.isE2eEnvelope(payload)) {
            return E2eConstants.ENCRYPTION_VERSION
        }
        return 0
    }

    private fun resolveEncryptedPayload(chat: ChatInfo): String? {
        val explicit = chat.lastMessageEncryptedPayloadValue
        if (!explicit.isNullOrBlank()) return explicit
        val lastMessage = chat.lastMessageValue
        if (!lastMessage.isNullOrBlank() && E2eEnvelope.isE2eEnvelope(lastMessage)) {
            return lastMessage
        }
        return null
    }

    private fun resolveSenderId(chat: ChatInfo): String? {
        val explicit = chat.lastMessageSenderIdValue
        if (!explicit.isNullOrBlank()) return explicit
        if (!chat.isGroupChatValue) {
            return chat.userIdValue.takeIf { it.isNotBlank() }
        }
        return null
    }

    private fun buildMemberUserIds(
        userId: String,
        senderId: String?,
        chat: ChatInfo,
    ): List<String> {
        val ids = linkedSetOf<String>()
        userId.trim().takeIf { it.isNotBlank() }?.let { ids.add(it) }
        senderId?.trim()?.takeIf { it.isNotBlank() }?.let { ids.add(it) }
        if (!chat.isGroupChatValue) {
            chat.userIdValue.trim().takeIf { it.isNotBlank() }?.let { ids.add(it) }
        }
        return ids.toList()
    }

    private fun pick(map: Map<String, Any?>, vararg keys: String): String? {
        for (key in keys) {
            val value = map[key]
            if (value != null && value.toString().isNotBlank()) {
                return value.toString()
            }
        }
        return null
    }
}
