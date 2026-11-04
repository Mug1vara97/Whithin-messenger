package com.whithin.voice.data.e2e

class E2eEncryptionException(
    message: String,
    val missingUserIds: List<String> = emptyList(),
) : Exception(message)

object E2eConstants {
    const val TEMP_DISABLED = true
    const val DEVICE_ID = "android"
    val LEGACY_DEVICE_IDS = listOf("default", "web")
    /** Device ids to try when distributing chat keys to a member's registered devices. */
    val ALL_DEVICE_IDS = listOf(DEVICE_ID) + LEGACY_DEVICE_IDS
    const val ENCRYPTION_VERSION = 0
    const val ENCRYPTED_PLACEHOLDER = "Зашифрованное сообщение"
    const val DECRYPT_FAILED_TEXT = "Не удалось расшифровать сообщение"
    const val PEER_KEY_MISSING_TEXT =
        "Собеседник ещё не настроил шифрование. Попросите его войти в мессенджер."

    private const val IDENTITY_PREFIX = "whithin:e2e:identity:"
    const val CHAT_KEY_PREFIX = "whithin:e2e:chat-key:"

    fun identityKey(userId: String): String = "$IDENTITY_PREFIX$userId"

    fun chatKeyKey(chatId: String): String = "$CHAT_KEY_PREFIX$chatId"
}
