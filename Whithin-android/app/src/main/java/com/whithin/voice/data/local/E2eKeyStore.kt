package com.whithin.voice.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.whithin.voice.data.e2e.E2eConstants
import com.whithin.voice.data.model.E2eIdentity
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class E2eKeyStore @Inject constructor(
    @ApplicationContext context: Context,
    private val gson: Gson,
) {
    private val prefs =
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )

    fun loadIdentity(userId: String): E2eIdentity? {
        val raw = prefs.getString(E2eConstants.identityKey(userId), null) ?: return null
        return runCatching {
            val parsed = gson.fromJson(raw, StoredIdentity::class.java)
            if (parsed.publicKeyBase64.isBlank() || parsed.secretKeyBase64.isBlank()) {
                null
            } else {
                E2eIdentity(
                    deviceId = parsed.deviceId ?: E2eConstants.DEVICE_ID,
                    publicKeyBase64 = parsed.publicKeyBase64,
                    secretKeyBase64 = parsed.secretKeyBase64,
                    uploadedPublicKeyBase64 = parsed.uploadedPublicKeyBase64,
                )
            }
        }.getOrNull()
    }

    fun saveIdentity(userId: String, identity: E2eIdentity) {
        val stored =
            StoredIdentity(
                deviceId = identity.deviceId,
                publicKeyBase64 = identity.publicKeyBase64,
                secretKeyBase64 = identity.secretKeyBase64,
                uploadedPublicKeyBase64 = identity.uploadedPublicKeyBase64,
            )
        prefs.edit()
            .putString(E2eConstants.identityKey(userId), gson.toJson(stored))
            .apply()
    }

    fun loadLocalChatKey(chatId: String): String? =
        prefs.getString(E2eConstants.chatKeyKey(chatId), null)

    fun saveLocalChatKey(chatId: String, keyBase64: String) {
        prefs.edit()
            .putString(E2eConstants.chatKeyKey(chatId), keyBase64)
            .apply()
    }

    fun removeLocalChatKey(chatId: String) {
        prefs.edit()
            .remove(E2eConstants.chatKeyKey(chatId))
            .apply()
    }

    fun loadRecoveryKey(userId: String): String? =
        prefs.getString(recoveryKeyKey(userId), null)

    fun saveRecoveryKey(userId: String, recoveryKeyBase64: String) {
        prefs.edit()
            .putString(recoveryKeyKey(userId), recoveryKeyBase64)
            .apply()
    }

    fun listLocalChatIds(): List<String> {
        val prefix = E2eConstants.CHAT_KEY_PREFIX
        return prefs.all.keys
            .asSequence()
            .filter { it.startsWith(prefix) }
            .map { it.removePrefix(prefix) }
            .filter { it.isNotBlank() }
            .toList()
    }

    fun exportBackupPayload(userId: String): String? {
        val identity = loadIdentity(userId)
        val chatKeys =
            listLocalChatIds()
                .mapNotNull { chatId ->
                    val key = loadLocalChatKey(chatId)
                    if (key.isNullOrBlank()) null else chatId to key
                }
                .toMap()
        if (identity == null && chatKeys.isEmpty()) {
            return null
        }

        val payload =
            StoredBackupPayload(
                identity =
                    identity?.let {
                        StoredIdentity(
                            deviceId = it.deviceId,
                            publicKeyBase64 = it.publicKeyBase64,
                            secretKeyBase64 = it.secretKeyBase64,
                            uploadedPublicKeyBase64 = it.uploadedPublicKeyBase64,
                        )
                    },
                chatKeys = chatKeys,
            )
        return gson.toJson(payload)
    }

    fun restoreFromBackupPayload(userId: String, payloadJson: String): Boolean {
        if (payloadJson.isBlank()) return false
        val payload =
            runCatching { gson.fromJson(payloadJson, StoredBackupPayload::class.java) }.getOrNull()
                ?: return false

        var restored = false
        payload.identity?.let { stored ->
            if (stored.publicKeyBase64.isNotBlank() && stored.secretKeyBase64.isNotBlank()) {
                saveIdentity(
                    userId,
                    E2eIdentity(
                        deviceId = stored.deviceId ?: E2eConstants.DEVICE_ID,
                        publicKeyBase64 = stored.publicKeyBase64,
                        secretKeyBase64 = stored.secretKeyBase64,
                        uploadedPublicKeyBase64 = stored.uploadedPublicKeyBase64,
                    ),
                )
                restored = true
            }
        }

        payload.chatKeys
            .orEmpty()
            .forEach { (chatId, keyBase64) ->
                if (chatId.isNotBlank() && keyBase64.isNotBlank()) {
                    saveLocalChatKey(chatId, keyBase64)
                    restored = true
                }
            }

        return restored
    }

    private data class StoredIdentity(
        val deviceId: String? = null,
        val publicKeyBase64: String = "",
        val secretKeyBase64: String = "",
        val uploadedPublicKeyBase64: String? = null,
    )

    private data class StoredBackupPayload(
        val identity: StoredIdentity? = null,
        val chatKeys: Map<String, String>? = null,
    )

    companion object {
        private const val PREFS_NAME = "whithin_e2e_secure"
        private const val RECOVERY_KEY_PREFIX = "whithin:e2e:recovery-key:"

        private fun recoveryKeyKey(userId: String): String = "$RECOVERY_KEY_PREFIX$userId"
    }
}
