package com.whithin.voice.data.e2e

import android.util.Base64
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.Box
import com.goterl.lazysodium.interfaces.SecretBox
import com.whithin.voice.data.api.E2eApi
import com.whithin.voice.data.local.E2eKeyStore
import com.whithin.voice.data.model.ChatWrappedKeyUpload
import com.whithin.voice.data.model.EncryptedMessagePayload
import com.whithin.voice.data.model.E2eIdentity
import com.whithin.voice.data.model.RequestChatKeyRewrapRequest
import com.whithin.voice.data.model.UploadChatWrappedKeysRequest
import com.whithin.voice.data.model.UploadDeviceKeyRequest
import com.whithin.voice.data.model.UploadE2eKeyBackupRequest
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class E2eAudience(
    val audience: List<String>,
    val eligible: List<String>,
    val ineligible: List<String>,
)

@Singleton
class E2eCryptoService @Inject constructor(
    private val e2eApi: E2eApi,
    private val keyStore: E2eKeyStore,
    private val gson: Gson,
) {
    private val sodium: LazySodiumAndroid by lazy { LazySodiumAndroid(SodiumAndroid()) }
    private val peerKeyCache = mutableMapOf<String, String>()
    private val peerKeyMissing = mutableSetOf<String>()
    /** Chats whose decrypt key was fetched this session — skip repeated server prep. */
    private val decryptKeyPreparedChatIds = mutableSetOf<String>()
    private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val chatWrapSyncInFlight = mutableSetOf<String>()
    private val chatBootstrapInFlight = mutableSetOf<String>()
    private val sessionChatMembers = mutableMapOf<String, MutableSet<String>>()
    private val rewrapRequestSentAtMs = mutableMapOf<String, Long>()
    private val pairwiseFailureLoggedAtMs = mutableMapOf<String, Long>()
    private val localDecryptFailureLoggedAtMs = mutableMapOf<String, Long>()
    private val chatKeyDecryptFailureLoggedAtMs = mutableMapOf<String, Long>()
    private val bootstrapSkipInflightLoggedAtMs = mutableMapOf<String, Long>()
    private val chatKeyRecoveryCooldownUntilMs = mutableMapOf<String, Long>()
    private val selfOnlyBootstrapCooldownUntilMs = mutableMapOf<String, Long>()
    private val forceResetAttemptedAtMs = mutableMapOf<String, Long>()
    private val keyBackupUploadInFlight = mutableSetOf<String>()
    private val keyBackupUploadRequestedAtMs = mutableMapOf<String, Long>()

    suspend fun ensureE2eIdentity(userId: String, strictUpload: Boolean = false): E2eIdentity? {
        if (E2eConstants.TEMP_DISABLED) return null
        if (userId.isBlank()) return null

        var identity = keyStore.loadIdentity(userId)
        if (identity == null) {
            identity = tryRestoreKeyBackup(userId)
            if (identity != null) {
                e2eLog(
                    "identity-restored-from-backup",
                    "userId" to userId,
                    "deviceId" to identity.deviceId,
                    "chatKeyCount" to keyStore.listLocalChatIds().size,
                )
            }
        }
        if (identity == null) {
            val publicKey = ByteArray(Box.PUBLICKEYBYTES)
            val secretKey = ByteArray(Box.SECRETKEYBYTES)
            if (!sodium.cryptoBoxKeypair(publicKey, secretKey)) {
                throw E2eEncryptionException(
                    "Не удалось создать ключ шифрования на этом устройстве.",
                )
            }
            identity =
                E2eIdentity(
                    deviceId = E2eConstants.DEVICE_ID,
                    publicKeyBase64 = encodeBase64(publicKey),
                    secretKeyBase64 = encodeBase64(secretKey),
                )
            keyStore.saveIdentity(userId, identity)
            e2eLog(
                "identity-created",
                "userId" to userId,
                "deviceId" to identity.deviceId,
            )
        } else if (identity.deviceId == "default") {
            identity = identity.copy(deviceId = E2eConstants.DEVICE_ID)
            keyStore.saveIdentity(userId, identity)
            e2eLog(
                "identity-deviceid-migrated",
                "userId" to userId,
                "deviceId" to identity.deviceId,
            )
        }

        val shouldUpload = identity.uploadedPublicKeyBase64 != identity.publicKeyBase64
        if (shouldUpload) {
            try {
                val response =
                    e2eApi.uploadDeviceKey(
                        UploadDeviceKeyRequest(
                            deviceId = identity.deviceId,
                            publicKeyBase64 = identity.publicKeyBase64,
                        ),
                    )
                if (!response.isSuccessful) {
                    if (response.code() == 400 && isDeviceKeyAlreadyUploaded(userId, identity)) {
                        identity = identity.copy(uploadedPublicKeyBase64 = identity.publicKeyBase64)
                        keyStore.saveIdentity(userId, identity)
                        peerKeyCache[userId] = identity.publicKeyBase64
                        e2eLog(
                            "device-key-upload-confirmed-on-400",
                            "userId" to userId,
                            "deviceId" to identity.deviceId,
                        )
                        return identity
                    }
                    throw IllegalStateException("upload failed: ${response.code()}")
                }
                identity = identity.copy(uploadedPublicKeyBase64 = identity.publicKeyBase64)
                keyStore.saveIdentity(userId, identity)
                peerKeyCache[userId] = identity.publicKeyBase64
                e2eLog(
                    "device-key-uploaded",
                    "userId" to userId,
                    "deviceId" to identity.deviceId,
                )
            } catch (error: Exception) {
                if (strictUpload) {
                    throw E2eEncryptionException(
                        "Не удалось загрузить ключ шифрования на сервер. Проверьте соединение и попробуйте снова.",
                    )
                }
                Log.w(TAG, "Failed to upload E2E public key", error)
            }
        } else {
            peerKeyCache[userId] = identity.publicKeyBase64
            e2eLog(
                "device-key-upload-skip-cached",
                "userId" to userId,
                "deviceId" to identity.deviceId,
            )
        }

        scheduleKeyBackupUpload(userId)
        return identity
    }

    suspend fun getPeerPublicKey(
        peerUserId: String,
        currentUserId: String?,
        fresh: Boolean = false,
    ): String? {
        val cacheKey = peerUserId.trim()
        if (cacheKey.isBlank()) return null

        if (!fresh && peerKeyMissing.contains(cacheKey)) {
            return null
        }

        if (!fresh) {
            peerKeyCache[cacheKey]?.let { return it }
        }

        if (!currentUserId.isNullOrBlank() && cacheKey.equals(currentUserId, ignoreCase = true)) {
            val identity = keyStore.loadIdentity(currentUserId) ?: ensureE2eIdentity(currentUserId)
            val publicKey = identity?.publicKeyBase64
            if (!publicKey.isNullOrBlank()) {
                peerKeyCache[cacheKey] = publicKey
                peerKeyMissing.remove(cacheKey)
                return publicKey
            }
            return null
        }

        val response = e2eApi.getDeviceKey(cacheKey, E2eConstants.DEVICE_ID)
        if (response.isSuccessful) {
            val publicKey = response.body()?.publicKeyBase64Value.orEmpty()
            if (publicKey.isNotBlank()) {
                peerKeyCache[cacheKey] = publicKey
                peerKeyMissing.remove(cacheKey)
                return publicKey
            }
        } else if (response.code() != 404) {
            throw IllegalStateException("getDeviceKey failed: ${response.code()}")
        }

        for (deviceId in E2eConstants.ALL_DEVICE_IDS) {
            if (deviceId == E2eConstants.DEVICE_ID) continue
            val deviceResponse = e2eApi.getDeviceKey(cacheKey, deviceId)
            if (!deviceResponse.isSuccessful) continue
            val publicKey = deviceResponse.body()?.publicKeyBase64Value.orEmpty()
            if (publicKey.isBlank()) continue
            peerKeyCache[cacheKey] = publicKey
            peerKeyMissing.remove(cacheKey)
            return publicKey
        }

        peerKeyCache.remove(cacheKey)
        peerKeyMissing.add(cacheKey)
        return null
    }

    suspend fun resolveEncryptAudience(
        userId: String,
        memberUserIds: List<String>,
        strictAllMembers: Boolean = false,
    ): E2eAudience {
        if (E2eConstants.TEMP_DISABLED) {
            val members = normalizeMemberIds(memberUserIds, userId)
            return E2eAudience(
                audience = members,
                eligible = members,
                ineligible = emptyList(),
            )
        }
        val members = normalizeMemberIds(memberUserIds, userId)
        if (members.isEmpty()) {
            throw E2eEncryptionException("Не удалось определить участников чата для шифрования.")
        }

        ensureE2eIdentity(userId, strictUpload = true)

        val eligible = mutableListOf<String>()
        val ineligible = mutableListOf<String>()
        val resolved =
            coroutineScope {
                members.map { memberId ->
                    async {
                        memberId to getPeerPublicKey(memberId, userId, fresh = strictAllMembers)
                    }
                }.awaitAll()
            }
        for ((memberId, publicKey) in resolved) {
            if (publicKey != null) {
                eligible.add(memberId)
            } else {
                ineligible.add(memberId)
            }
        }

        if (!eligible.any { it.equals(userId, ignoreCase = true) }) {
            throw E2eEncryptionException(
                "Не удалось настроить шифрование на этом устройстве. Проверьте соединение и попробуйте снова.",
            )
        }

        if (strictAllMembers && ineligible.isNotEmpty()) {
            throw E2eEncryptionException(
                formatMissingKeysError(ineligible, userId),
                ineligible,
            )
        }

        e2eLog(
            "resolve-encrypt-audience",
            "chatScopeUserId" to userId,
            "strictAllMembers" to strictAllMembers,
            "audienceCount" to members.size,
            "eligibleCount" to eligible.size,
            "ineligibleCount" to ineligible.size,
            "audience" to summarizeIds(members),
            "eligible" to summarizeIds(eligible),
            "ineligible" to summarizeIds(ineligible),
        )

        return E2eAudience(
            audience = members,
            eligible = eligible,
            ineligible = ineligible,
        )
    }

    suspend fun encryptChatMessage(
        userId: String,
        chatId: String,
        memberUserIds: List<String>,
        plaintext: String,
        strictAllMembers: Boolean = false,
    ): EncryptedMessagePayload {
        if (E2eConstants.TEMP_DISABLED) {
            return EncryptedMessagePayload(
                content = plaintext,
                encryptionVersion = 0,
            )
        }
        val chatKeyBase64 =
            ensureChatKey(
                userId = userId,
                chatId = chatId,
                memberUserIds = memberUserIds,
                forEncrypt = true,
                strictAllMembers = strictAllMembers,
            )
        val chatKey = decodeBase64(chatKeyBase64)
        val nonce = randomBytes(SecretBox.NONCEBYTES)
        val plaintextBytes = plaintext.toByteArray(Charsets.UTF_8)
        val ciphertext = ByteArray(plaintextBytes.size + SecretBox.MACBYTES)
        if (!sodium.cryptoSecretBoxEasy(
                ciphertext,
                plaintextBytes,
                plaintextBytes.size.toLong(),
                nonce,
                chatKey,
            )
        ) {
            throw E2eEncryptionException("Не удалось зашифровать сообщение.")
        }

        val envelope =
            gson.toJson(
                mapOf(
                    "n" to encodeBase64(nonce),
                    "c" to encodeBase64(ciphertext),
                ),
            )
        return EncryptedMessagePayload(
            content = envelope,
            encryptionVersion = E2eConstants.ENCRYPTION_VERSION,
        )
    }

    suspend fun decryptChatMessage(
        userId: String,
        chatId: String,
        memberUserIds: List<String>,
        content: String,
        encryptionVersion: Int,
        peerUserId: String? = null,
    ): String {
        if (E2eConstants.TEMP_DISABLED) return content
        if (encryptionVersion <= 0) return content

        tryDecryptWithLocalChatKey(chatId, content)?.let { return it }
        decryptWithChatKey(userId, chatId, memberUserIds, content)?.let { return it }

        if (!peerUserId.isNullOrBlank()) {
            decryptWithPairwiseKey(userId, chatId, peerUserId, content)?.let { return it }
        }

        return E2eConstants.DECRYPT_FAILED_TEXT
    }

    /**
     * Fetch/open chat key once before decrypting a message page.
     * Avoids per-message server round-trips (critical for server channels).
     */
    suspend fun prepareChatKeyForDecrypt(
        userId: String,
        chatId: String,
        memberUserIds: List<String>,
    ) {
        val normalizedChatId = chatId.trim()
        if (userId.isBlank() || normalizedChatId.isBlank()) return
        val members = normalizeMemberIds(memberUserIds, userId)
        if (decryptKeyPreparedChatIds.contains(normalizedChatId.lowercase())) return
        if (keyStore.loadLocalChatKey(normalizedChatId) != null) {
            decryptKeyPreparedChatIds.add(normalizedChatId.lowercase())
            runCatching { proactiveSyncChatDeviceWraps(userId, normalizedChatId, members) }
            return
        }
        try {
            bootstrapChatKeyIfPossible(userId, normalizedChatId, members)
            if (keyStore.loadLocalChatKey(normalizedChatId) != null) {
                decryptKeyPreparedChatIds.add(normalizedChatId.lowercase())
            }
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            Log.w(TAG, "prepareChatKeyForDecrypt failed chatId=$normalizedChatId", error)
        }
    }

    fun hasLocalChatKey(chatId: String): Boolean =
        keyStore.loadLocalChatKey(chatId.trim()) != null

    fun invalidateChatKeyPrep(chatId: String) {
        decryptKeyPreparedChatIds.remove(chatId.trim().lowercase())
    }

    fun clearPeerKeyCache() {
        peerKeyCache.clear()
        peerKeyMissing.clear()
        decryptKeyPreparedChatIds.clear()
        sessionChatMembers.clear()
    }

    suspend fun decryptNotificationPreview(
        userId: String,
        chatId: String,
        ciphertext: String,
        encryptionVersion: Int,
        senderId: String?,
    ): String? {
        if (encryptionVersion <= 0 || userId.isBlank() || chatId.isBlank() || ciphertext.isBlank()) {
            return null
        }
        val normalizedUserId = userId.trim()
        val normalizedChatId = chatId.trim()
        val members = linkedSetOf(normalizedUserId)
        senderId?.trim()?.takeIf { it.isNotBlank() }?.let { members.add(it) }
        val memberIds = members.toList()
        return try {
            ensureE2eIdentity(normalizedUserId)
            prepareChatKeyForDecrypt(normalizedUserId, normalizedChatId, memberIds)
            val decrypted =
                decryptChatMessage(
                    userId = normalizedUserId,
                    chatId = normalizedChatId,
                    memberUserIds = memberIds,
                    content = ciphertext,
                    encryptionVersion = encryptionVersion,
                    peerUserId = senderId?.trim()?.takeIf { it.isNotBlank() },
                )
            if (decrypted == E2eConstants.DECRYPT_FAILED_TEXT) null else decrypted
        } catch (error: Exception) {
            Log.w(TAG, "decryptNotificationPreview failed chatId=$normalizedChatId", error)
            null
        }
    }

    /** Try to open chat key from server; on success sync wraps for all member devices. */
    suspend fun bootstrapChatKeyIfPossible(
        userId: String,
        chatId: String,
        memberUserIds: List<String>,
    ) {
        if (userId.isBlank() || chatId.isBlank()) return
        val normalizedChatId = chatId.trim()
        val normalizedChatIdKey = normalizedChatId.lowercase()
        val now = System.currentTimeMillis()
        val cooldownUntil = selfOnlyBootstrapCooldownUntilMs[normalizedChatIdKey] ?: 0L
        if (now < cooldownUntil) {
            e2eLog(
                "bootstrap-if-possible-self-only-cooldown",
                "userId" to userId,
                "chatId" to normalizedChatId,
                "retryInMs" to (cooldownUntil - now),
            )
            return
        }
        val bootstrapKey = "${normalizedChatId.lowercase()}:${userId.trim().lowercase()}"
        synchronized(chatBootstrapInFlight) {
            if (chatBootstrapInFlight.contains(bootstrapKey)) {
                logBootstrapSkipInflight(userId, normalizedChatId)
                return
            }
            chatBootstrapInFlight.add(bootstrapKey)
        }
        try {
            val members = mergedSessionMembers(normalizedChatId, userId, memberUserIds)
        e2eLog(
            "bootstrap-if-possible-start",
            "userId" to userId,
            "chatId" to normalizedChatId,
            "memberCount" to members.size,
            "members" to summarizeIds(members),
        )
        if (keyStore.loadLocalChatKey(normalizedChatId) != null) {
            runCatching { proactiveSyncChatDeviceWraps(userId, normalizedChatId, members) }
            e2eLog(
                "bootstrap-if-possible-skip-local-key",
                "userId" to userId,
                "chatId" to normalizedChatId,
            )
            return
        }

        val deviceId = keyStore.loadIdentity(userId)?.deviceId ?: E2eConstants.DEVICE_ID
        val keyBase64 = tryOpenChatKeyFromServer(userId, normalizedChatId, deviceId)
        if (keyBase64 == null) {
            val recipientsResponse = e2eApi.getChatKeyRecipients(normalizedChatId)
            val existingRecipients =
                if (recipientsResponse.isSuccessful) {
                    recipientsResponse.body()?.userIdsValue.orEmpty()
                } else {
                    emptyList()
                }
            if (existingRecipients.isNotEmpty()) {
                val normalizedRecipients = normalizeMemberIds(existingRecipients, userId)
                val hasPeerRecipient =
                    normalizedRecipients.any { recipient ->
                        !recipient.equals(userId, ignoreCase = true)
                    }
                if (hasPeerRecipient) {
                    e2eLog(
                        "bootstrap-if-possible-rewrap-request",
                        "userId" to userId,
                        "chatId" to normalizedChatId,
                        "recipientCount" to normalizedRecipients.size,
                        "recipients" to summarizeIds(normalizedRecipients),
                    )
                    requestChatKeyRewrapIfNeeded(normalizedChatId, deviceId)
                    val recovered = waitForChatKeyAfterRewrap(userId, normalizedChatId, deviceId)
                    if (recovered != null) {
                        keyStore.saveLocalChatKey(normalizedChatId, recovered)
                        scheduleKeyBackupUpload(userId)
                        runCatching {
                            syncChatKeyWraps(userId, normalizedChatId, recovered, members, strictAllMembers = false)
                        }
                        e2eLog(
                            "bootstrap-if-possible-recovered",
                            "userId" to userId,
                            "chatId" to normalizedChatId,
                            "fingerprint" to shortFingerprint(chatKeyFingerprint(recovered)),
                        )
                        return
                    }
                    return
                }
                e2eLog(
                    "bootstrap-if-possible-ignore-self-only-recipients",
                    "userId" to userId,
                    "chatId" to normalizedChatId,
                    "recipientCount" to normalizedRecipients.size,
                    "recipients" to summarizeIds(normalizedRecipients),
                )
                selfOnlyBootstrapCooldownUntilMs[normalizedChatIdKey] =
                    System.currentTimeMillis() + SELF_ONLY_BOOTSTRAP_COOLDOWN_MS
            }
            return
        }
        keyStore.saveLocalChatKey(normalizedChatId, keyBase64)
        scheduleKeyBackupUpload(userId)
        e2eLog(
            "bootstrap-if-possible-restored-from-server",
            "userId" to userId,
            "chatId" to normalizedChatId,
            "fingerprint" to shortFingerprint(chatKeyFingerprint(keyBase64)),
        )
        runCatching { syncChatKeyWraps(userId, normalizedChatId, keyBase64, members, strictAllMembers = false) }
        } finally {
            synchronized(chatBootstrapInFlight) {
                chatBootstrapInFlight.remove(bootstrapKey)
            }
        }
    }

    private suspend fun tryOpenChatKeyFromServer(
        userId: String,
        chatId: String,
        primaryDeviceId: String,
    ): String? {
        val deviceIds =
            listOf(primaryDeviceId) +
                E2eConstants.LEGACY_DEVICE_IDS.filter { it != primaryDeviceId }

        for (deviceId in deviceIds) {
            val response = e2eApi.getChatWrappedKey(chatId, deviceId)
            if (!response.isSuccessful) continue
            val wrapped = response.body()?.wrappedKeyBase64Value.orEmpty()
            if (wrapped.isBlank()) continue

            try {
                val chatKeyBytes = openSealedChatKey(userId, wrapped)
                return encodeBase64(chatKeyBytes)
            } catch (_: Exception) {
                if (deviceId == primaryDeviceId) {
                    Log.d(TAG, "Could not open chat wrap for deviceId=$deviceId")
                }
            }
        }

        return null
    }

    private suspend fun ensureChatKey(
        userId: String,
        chatId: String,
        memberUserIds: List<String>,
        forEncrypt: Boolean,
        strictAllMembers: Boolean,
    ): String {
        if (userId.isBlank() || chatId.isBlank()) {
            throw IllegalStateException("Chat E2E requires userId and chatId")
        }

        val localKeyEarly = keyStore.loadLocalChatKey(chatId)
        if (forEncrypt && localKeyEarly != null && !strictAllMembers) {
            ensureE2eIdentity(userId, strictUpload = true)
            val members = normalizeMemberIds(memberUserIds, userId)
            e2eLog(
                "ensure-chat-key-local-fast-path",
                "userId" to userId,
                "chatId" to chatId,
                "forEncrypt" to forEncrypt,
                "strictAllMembers" to strictAllMembers,
                "memberCount" to members.size,
                "members" to summarizeIds(members),
                "fingerprint" to shortFingerprint(chatKeyFingerprint(localKeyEarly)),
            )
            scheduleWrapSync(userId, chatId, localKeyEarly, members)
            return localKeyEarly
        }

        var audience = normalizeMemberIds(memberUserIds, userId)
        var eligible = audience

        if (forEncrypt && strictAllMembers) {
            val resolved = resolveEncryptAudience(userId, memberUserIds, strictAllMembers = true)
            audience = resolved.audience
            eligible = resolved.eligible
        } else if (forEncrypt) {
            val resolved = resolveEncryptAudience(userId, memberUserIds, strictAllMembers = false)
            audience = resolved.audience
            eligible = resolved.eligible
        } else {
            ensureE2eIdentity(userId)
        }

        localKeyEarly?.let { localKey ->
            if (forEncrypt) {
                if (strictAllMembers) {
                    syncChatKeyWraps(userId, chatId, localKey, eligible, strictAllMembers = true)
                } else {
                    scheduleWrapSync(userId, chatId, localKey, audience)
                }
            }
            e2eLog(
                "ensure-chat-key-local-path",
                "userId" to userId,
                "chatId" to chatId,
                "forEncrypt" to forEncrypt,
                "strictAllMembers" to strictAllMembers,
                "audienceCount" to audience.size,
                "eligibleCount" to eligible.size,
                "audience" to summarizeIds(audience),
                "eligible" to summarizeIds(eligible),
                "fingerprint" to shortFingerprint(chatKeyFingerprint(localKey)),
            )
            return localKey
        }

        val deviceId = keyStore.loadIdentity(userId)?.deviceId ?: E2eConstants.DEVICE_ID
        val keyBase64FromServer = tryOpenChatKeyFromServer(userId, chatId, deviceId)
        if (keyBase64FromServer != null) {
            keyStore.saveLocalChatKey(chatId, keyBase64FromServer)
            scheduleKeyBackupUpload(userId)
            if (forEncrypt && !strictAllMembers) {
                scheduleWrapSync(userId, chatId, keyBase64FromServer, audience)
            } else {
                syncChatKeyWraps(userId, chatId, keyBase64FromServer, eligible, strictAllMembers)
            }
            e2eLog(
                "ensure-chat-key-restored-from-server-wrap",
                "userId" to userId,
                "chatId" to chatId,
                "forEncrypt" to forEncrypt,
                "strictAllMembers" to strictAllMembers,
                "audienceCount" to audience.size,
                "eligibleCount" to eligible.size,
                "fingerprint" to shortFingerprint(chatKeyFingerprint(keyBase64FromServer)),
            )
            return keyBase64FromServer
        }

        val recipientsResponse = e2eApi.getChatKeyRecipients(chatId)
        val existingRecipients =
            if (recipientsResponse.isSuccessful) {
                recipientsResponse.body()?.userIdsValue.orEmpty()
            } else if (recipientsResponse.code() == 404) {
                emptyList()
            } else {
                throw IllegalStateException("getChatKeyRecipients failed: ${recipientsResponse.code()}")
            }

        if (existingRecipients.isNotEmpty()) {
            e2eLog(
                "ensure-chat-key-missing-wrap-for-device",
                "userId" to userId,
                "chatId" to chatId,
                "forEncrypt" to forEncrypt,
                "recipientCount" to existingRecipients.size,
                "recipients" to summarizeIds(existingRecipients),
                "localDeviceId" to deviceId,
                "audienceCount" to audience.size,
                "eligibleCount" to eligible.size,
            )
            ensureE2eIdentity(userId, strictUpload = true)
            invalidateChatKeyPrep(chatId)
            val retryKey = tryOpenChatKeyFromServer(userId, chatId, deviceId)
            if (retryKey != null) {
                keyStore.saveLocalChatKey(chatId, retryKey)
                scheduleKeyBackupUpload(userId)
                syncChatKeyWraps(userId, chatId, retryKey, eligible, strictAllMembers)
                return retryKey
            }
            requestChatKeyRewrapIfNeeded(chatId, deviceId)
            val recovered = waitForChatKeyAfterRewrap(userId, chatId, deviceId)
            if (recovered != null) {
                keyStore.saveLocalChatKey(chatId, recovered)
                scheduleKeyBackupUpload(userId)
                syncChatKeyWraps(userId, chatId, recovered, eligible, strictAllMembers)
                e2eLog(
                    "ensure-chat-key-recovered-after-rewrap",
                    "userId" to userId,
                    "chatId" to chatId,
                    "fingerprint" to shortFingerprint(chatKeyFingerprint(recovered)),
                )
                return recovered
            }
            if (forEncrypt) {
                val forceResetKey = attemptForceResetChatKey(userId, chatId, eligible)
                if (!forceResetKey.isNullOrBlank()) {
                    keyStore.saveLocalChatKey(chatId, forceResetKey)
                    scheduleKeyBackupUpload(userId)
                    syncChatKeyWraps(userId, chatId, forceResetKey, eligible, strictAllMembers)
                    e2eLog(
                        "ensure-chat-key-force-reset-uploaded",
                        "userId" to userId,
                        "chatId" to chatId,
                        "audienceCount" to audience.size,
                        "eligibleCount" to eligible.size,
                        "fingerprint" to shortFingerprint(chatKeyFingerprint(forceResetKey)),
                    )
                    return forceResetKey
                }
            }
            val message =
                if (forEncrypt) {
                    "Не удалось отправить сообщение: у вас ещё нет ключа этого чата. Попросите участника, у которого чат уже работает, отправить любое сообщение — ключ будет перевыпущен."
                } else {
                    "E2E-ключ чата ещё не выдан этому устройству."
                }
            throw E2eEncryptionException(message)
        }

        if (eligible.isEmpty()) {
            throw E2eEncryptionException("Не удалось определить участников с ключами шифрования.")
        }

        val chatKeyBytes = randomBytes(32)
        val keyBase64 = encodeBase64(chatKeyBytes)
        val wraps = buildWrapsForMembers(chatKeyBytes, eligible, userId, strict = false)
        e2eLog(
            "ensure-chat-key-bootstrap-plan",
            "userId" to userId,
            "chatId" to chatId,
            "forEncrypt" to forEncrypt,
            "strictAllMembers" to strictAllMembers,
            "audienceCount" to audience.size,
            "eligibleCount" to eligible.size,
            "wrapTargetsCount" to eligible.size,
            "audience" to summarizeIds(audience),
            "eligible" to summarizeIds(eligible),
            "fingerprint" to shortFingerprint(chatKeyFingerprint(keyBase64)),
        )
        if (wraps.isEmpty()) {
            throw E2eEncryptionException(
                if (strictAllMembers) {
                    formatMissingKeysError(audience.filter { id -> eligible.none { it.equals(id, ignoreCase = true) } }, userId)
                } else {
                    "Не удалось создать ключ шифрования для чата."
                },
            )
        }

        val uploadResponse =
            e2eApi.uploadChatWrappedKeys(
                chatId,
                UploadChatWrappedKeysRequest(
                    wraps = wraps,
                    keyFingerprint = chatKeyFingerprint(keyBase64),
                ),
            )
        if (!uploadResponse.isSuccessful) {
            throw E2eEncryptionException("Не удалось сохранить ключ шифрования чата на сервере.")
        }
        e2eLog(
            "ensure-chat-key-bootstrap-uploaded",
            "userId" to userId,
            "chatId" to chatId,
            "wrapsUploaded" to wraps.size,
            "fingerprint" to shortFingerprint(chatKeyFingerprint(keyBase64)),
        )

        keyStore.saveLocalChatKey(chatId, keyBase64)
        scheduleKeyBackupUpload(userId)
        if (forEncrypt && !strictAllMembers) {
            scheduleWrapSync(userId, chatId, keyBase64, audience)
        }
        return keyBase64
    }

    private fun scheduleWrapSync(
        userId: String,
        chatId: String,
        chatKeyBase64: String,
        memberIds: List<String>,
    ) {
        if (memberIds.isEmpty()) return
        val syncKey = "${chatId.trim().lowercase()}:${userId.trim().lowercase()}"
        synchronized(chatWrapSyncInFlight) {
            if (chatWrapSyncInFlight.contains(syncKey)) return
            chatWrapSyncInFlight.add(syncKey)
        }
        backgroundScope.launch {
            try {
                syncChatKeyWraps(userId, chatId, chatKeyBase64, memberIds, strictAllMembers = false)
            } catch (error: Exception) {
                Log.w(TAG, "Background chat-wrap sync failed for chatId=$chatId", error)
            } finally {
                synchronized(chatWrapSyncInFlight) {
                    chatWrapSyncInFlight.remove(syncKey)
                }
            }
        }
    }

    private suspend fun syncChatKeyWraps(
        userId: String,
        chatId: String,
        chatKeyBase64: String,
        eligibleMemberIds: List<String>,
        strictAllMembers: Boolean = false,
    ) {
        if (eligibleMemberIds.isEmpty()) return

        refreshOwnUnreadableDeviceWrap(userId, chatId, chatKeyBase64)

        val chatKeyBytes = decodeBase64(chatKeyBase64)
        val wraps = buildWrapsForMembers(chatKeyBytes, eligibleMemberIds, userId, strict = strictAllMembers)
        e2eLog(
            "sync-chat-key-wraps-prepared",
            "userId" to userId,
            "chatId" to chatId,
            "eligibleCount" to eligibleMemberIds.size,
            "eligible" to summarizeIds(eligibleMemberIds),
            "wrapsPrepared" to wraps.size,
            "strictAllMembers" to strictAllMembers,
            "fingerprint" to shortFingerprint(chatKeyFingerprint(chatKeyBase64)),
        )
        if (wraps.isNotEmpty()) {
            val response =
                e2eApi.uploadChatWrappedKeys(
                    chatId,
                    UploadChatWrappedKeysRequest(
                        wraps = wraps,
                        keyFingerprint = chatKeyFingerprint(chatKeyBase64),
                    ),
                )
            if (!response.isSuccessful) {
                Log.w(TAG, "syncChatKeyWraps failed: ${response.code()}")
            } else {
                e2eLog(
                    "sync-chat-key-wraps-uploaded",
                    "userId" to userId,
                    "chatId" to chatId,
                    "wrapsUploaded" to wraps.size,
                    "fingerprint" to shortFingerprint(chatKeyFingerprint(chatKeyBase64)),
                )
            }
        }
        syncAlternateSelfDeviceWraps(userId, chatId, chatKeyBase64)
    }

    /** When this device already holds the chat key, upload wraps for all known member devices. */
    suspend fun proactiveSyncChatDeviceWraps(
        userId: String,
        chatId: String,
        memberUserIds: List<String> = emptyList(),
    ) {
        if (userId.isBlank() || chatId.isBlank()) return
        val localKey = keyStore.loadLocalChatKey(chatId.trim()) ?: return
        ensureE2eIdentity(userId, strictUpload = true)
        val members = normalizeMemberIds(memberUserIds, userId)
        syncChatKeyWraps(userId, chatId.trim(), localKey, members, strictAllMembers = false)
    }

    /** After login: bootstrap missing keys and re-upload wraps for every chat where we hold the key. */
    suspend fun syncSessionChatKeys(
        userId: String,
        chatMembers: List<Pair<String, List<String>>>,
    ) {
        if (userId.isBlank()) return
        ensureE2eIdentity(userId, strictUpload = true)

        for ((chatId, memberUserIds) in chatMembers) {
            val normalizedChatId = chatId.trim()
            if (normalizedChatId.isBlank()) continue
            val members = normalizeMemberIds(memberUserIds, userId)
            runCatching { bootstrapChatKeyIfPossible(userId, normalizedChatId, members) }
        }

        for (chatId in keyStore.listLocalChatIds()) {
            val members =
                chatMembers.firstOrNull { it.first.equals(chatId, ignoreCase = true) }?.second
                    ?: listOf(userId)
            runCatching { proactiveSyncChatDeviceWraps(userId, chatId, members) }
        }
        scheduleKeyBackupUpload(userId)
    }

    private suspend fun ownWrapIsReadable(
        userId: String,
        chatId: String,
        deviceId: String,
    ): Boolean {
        val ownWrap = e2eApi.getChatWrappedKey(chatId, deviceId)
        val wrapped = ownWrap.body()?.wrappedKeyBase64Value.orEmpty()
        if (!ownWrap.isSuccessful || wrapped.isBlank()) return false
        return try {
            openSealedChatKey(userId, wrapped)
            true
        } catch (_: Exception) {
            false
        }
    }

    /** Re-upload own wrap when the server has a stale wrap for the current device key. */
    private suspend fun refreshOwnUnreadableDeviceWrap(
        userId: String,
        chatId: String,
        chatKeyBase64: String,
    ) {
        val identity = keyStore.loadIdentity(userId) ?: ensureE2eIdentity(userId) ?: return
        val deviceId = identity.deviceId
        if (ownWrapIsReadable(userId, chatId, deviceId)) return

        ensureE2eIdentity(userId, strictUpload = false)
        val publicKey = identity.publicKeyBase64
        if (publicKey.isBlank()) return

        val chatKeyBytes = decodeBase64(chatKeyBase64)
        val wrappedKeyBase64 = sealChatKeyForUser(chatKeyBytes, publicKey)
        val response =
            e2eApi.uploadChatWrappedKeys(
                chatId,
                UploadChatWrappedKeysRequest(
                    wraps =
                        listOf(
                            ChatWrappedKeyUpload(
                                userId = userId,
                                wrappedKeyBase64 = wrappedKeyBase64,
                                deviceId = deviceId,
                            ),
                        ),
                    keyFingerprint = chatKeyFingerprint(chatKeyBase64),
                ),
            )
        if (!response.isSuccessful) {
            Log.w(TAG, "refreshOwnUnreadableDeviceWrap failed: ${response.code()}")
        }
    }

    private suspend fun syncAlternateSelfDeviceWraps(
        userId: String,
        chatId: String,
        chatKeyBase64: String,
    ) {
        val identity = keyStore.loadIdentity(userId) ?: ensureE2eIdentity(userId) ?: return
        val ourPrimaryDeviceId = identity.deviceId
        val chatKeyBytes = decodeBase64(chatKeyBase64)
        val wraps = mutableListOf<ChatWrappedKeyUpload>()

        for (deviceId in selfDeviceIds(ourPrimaryDeviceId)) {
            if (deviceId == ourPrimaryDeviceId) continue

            val existing = e2eApi.getChatWrappedKey(chatId, deviceId)
            if (existing.isSuccessful && existing.body()?.wrappedKeyBase64Value.orEmpty().isNotBlank()) {
                continue
            }

            val deviceKeyResponse = e2eApi.getDeviceKey(userId, deviceId)
            if (!deviceKeyResponse.isSuccessful) continue
            val publicKey = deviceKeyResponse.body()?.publicKeyBase64Value.orEmpty()
            if (publicKey.isBlank()) continue

            val wrappedKeyBase64 = sealChatKeyForUser(chatKeyBytes, publicKey)
            wraps.add(
                ChatWrappedKeyUpload(
                    userId = userId,
                    wrappedKeyBase64 = wrappedKeyBase64,
                    deviceId = deviceId,
                ),
            )
        }

        if (wraps.isEmpty()) return
        val response =
            e2eApi.uploadChatWrappedKeys(
                chatId,
                UploadChatWrappedKeysRequest(
                    wraps = wraps,
                    keyFingerprint = chatKeyFingerprint(chatKeyBase64),
                ),
            )
        if (!response.isSuccessful) {
            Log.w(TAG, "syncAlternateSelfDeviceWraps failed: ${response.code()}")
        }
    }

    private fun selfDeviceIds(primaryDeviceId: String): List<String> {
        val ids = linkedSetOf(primaryDeviceId)
        E2eConstants.LEGACY_DEVICE_IDS.filter { it != primaryDeviceId }.forEach { ids.add(it) }
        return ids.toList()
    }

    private suspend fun buildWrapsForMembers(
        chatKeyBytes: ByteArray,
        memberIds: List<String>,
        currentUserId: String,
        strict: Boolean,
    ): List<ChatWrappedKeyUpload> {
        val wraps = mutableListOf<ChatWrappedKeyUpload>()
        val missingUserIds = mutableListOf<String>()

        for (memberId in memberIds) {
            val trimmedMemberId = memberId.trim()
            if (trimmedMemberId.isBlank()) continue

            val deviceKeys = resolveMemberDeviceKeys(trimmedMemberId, currentUserId)
            if (deviceKeys.isEmpty()) {
                missingUserIds.add(trimmedMemberId)
                continue
            }

            for ((deviceId, publicKeyBase64) in deviceKeys) {
                val wrappedKeyBase64 = sealChatKeyForUser(chatKeyBytes, publicKeyBase64)
                wraps.add(
                    ChatWrappedKeyUpload(
                        userId = trimmedMemberId,
                        wrappedKeyBase64 = wrappedKeyBase64,
                        deviceId = deviceId,
                    ),
                )
            }
        }

        if (strict && missingUserIds.isNotEmpty()) {
            throw E2eEncryptionException(
                formatMissingKeysError(missingUserIds, currentUserId),
                missingUserIds,
            )
        }

        return wraps
    }

    private suspend fun requestChatKeyRewrapIfNeeded(chatId: String, deviceId: String) {
        val normalizedChatId = chatId.trim().lowercase()
        if (normalizedChatId.isBlank()) return

        val now = System.currentTimeMillis()
        val lastSentAt = rewrapRequestSentAtMs[normalizedChatId] ?: 0L
        if (now - lastSentAt < REWRAP_REQUEST_THROTTLE_MS) {
            e2eLog(
                "rewrap-request-throttled",
                "chatId" to chatId,
                "deviceId" to deviceId,
                "retryInMs" to (REWRAP_REQUEST_THROTTLE_MS - (now - lastSentAt)),
            )
            return
        }

        runCatching {
            val response =
                e2eApi.requestChatKeyRewrap(
                    chatId = chatId,
                    body = RequestChatKeyRewrapRequest(deviceId = deviceId),
                )
            if (response.isSuccessful) {
                rewrapRequestSentAtMs[normalizedChatId] = now
                e2eLog(
                    "rewrap-request-sent",
                    "chatId" to chatId,
                    "deviceId" to deviceId,
                )
            } else {
                Log.w(TAG, "requestChatKeyRewrap failed: ${response.code()} for chatId=$chatId")
            }
        }.onFailure { error ->
            Log.w(TAG, "requestChatKeyRewrap error for chatId=$chatId", error)
        }
    }

    private suspend fun waitForChatKeyAfterRewrap(
        userId: String,
        chatId: String,
        deviceId: String,
    ): String? {
        val normalizedChatId = chatId.trim().lowercase()
        repeat(REWRAP_RECOVERY_ATTEMPTS) { attempt ->
            delay(REWRAP_RECOVERY_DELAY_MS)
            val opened = tryOpenChatKeyFromServer(userId, chatId, deviceId)
            if (!opened.isNullOrBlank()) {
                Log.d(TAG, "Recovered chat key after rewrap chatId=$chatId attempt=${attempt + 1}")
                return opened
            }
        }
        // Allow a new rewrap request if previous recovery window timed out.
        rewrapRequestSentAtMs.remove(normalizedChatId)
        return null
    }

    private suspend fun resolveMemberDeviceKeys(
        memberId: String,
        currentUserId: String,
    ): List<Pair<String, String>> {
        if (memberId.equals(currentUserId, ignoreCase = true)) {
            return resolveSelfDeviceKeys(currentUserId)
        }

        return resolveRemoteMemberDeviceKeys(memberId)
    }

    private suspend fun resolveSelfDeviceKeys(userId: String): List<Pair<String, String>> {
        val byDeviceId = linkedMapOf<String, String>()
        val identity = keyStore.loadIdentity(userId) ?: ensureE2eIdentity(userId)
        identity?.publicKeyBase64?.takeIf { it.isNotBlank() }?.let { publicKey ->
            byDeviceId[identity.deviceId] = publicKey
        }

        for (deviceId in E2eConstants.ALL_DEVICE_IDS) {
            if (byDeviceId.containsKey(deviceId)) continue
            val response = e2eApi.getDeviceKey(userId, deviceId)
            if (!response.isSuccessful) continue
            val publicKey = response.body()?.publicKeyBase64Value.orEmpty()
            if (publicKey.isBlank()) continue
            byDeviceId[deviceId] = publicKey
        }

        return byDeviceId.entries.map { it.key to it.value }
    }

    private suspend fun resolveRemoteMemberDeviceKeys(memberId: String): List<Pair<String, String>> {
        val byDeviceId = linkedMapOf<String, String>()

        for (deviceId in E2eConstants.ALL_DEVICE_IDS) {
            val response = e2eApi.getDeviceKey(memberId, deviceId)
            if (!response.isSuccessful) continue
            val publicKey = response.body()?.publicKeyBase64Value.orEmpty()
            if (publicKey.isBlank()) continue
            byDeviceId[deviceId] = publicKey
        }

        if (byDeviceId.isEmpty()) {
            val primaryResponse = e2eApi.getDeviceKey(memberId)
            when {
                primaryResponse.isSuccessful -> {
                    val body = primaryResponse.body()
                    val publicKey = body?.publicKeyBase64Value.orEmpty()
                    val deviceId = body?.deviceIdValue ?: "default"
                    if (publicKey.isNotBlank()) {
                        byDeviceId[deviceId] = publicKey
                    }
                }
                primaryResponse.code() == 404 -> Unit
                else -> throw IllegalStateException("getDeviceKey failed: ${primaryResponse.code()}")
            }
        }

        return byDeviceId.entries.map { it.key to it.value }
    }

    private fun tryDecryptWithLocalChatKey(chatId: String, content: String): String? {
        val envelope = parseEnvelope(content) ?: return null
        val chatKeyBase64 = keyStore.loadLocalChatKey(chatId.trim()) ?: return null
        return try {
            openSecretBox(envelope, decodeBase64(chatKeyBase64))
        } catch (error: Exception) {
            logLocalDecryptFailure(chatId, error)
            null
        }
    }

    private suspend fun decryptWithChatKey(
        userId: String,
        chatId: String,
        memberUserIds: List<String>,
        content: String,
    ): String? {
        val envelope = parseEnvelope(content) ?: return null
        return try {
            val normalizedChatId = chatId.trim().lowercase()
            val localKey = keyStore.loadLocalChatKey(chatId)
            if (!localKey.isNullOrBlank()) {
                try {
                    return openSecretBox(envelope, decodeBase64(localKey))
                } catch (error: Exception) {
                    if (error is kotlinx.coroutines.CancellationException) throw error
                    if (!isSecretboxOpenFailed(error)) throw error
                    val now = System.currentTimeMillis()
                    val cooldownUntil = chatKeyRecoveryCooldownUntilMs[normalizedChatId] ?: 0L
                    if (now < cooldownUntil) {
                        e2eLog(
                            "chat-key-recovery-cooldown-active",
                            "userId" to userId,
                            "chatId" to chatId,
                            "retryInMs" to (cooldownUntil - now),
                        )
                        return null
                    }
                    // Local chat key can become stale after reinstall/race; clear and re-bootstrap from server wrap.
                    keyStore.removeLocalChatKey(chatId)
                    invalidateChatKeyPrep(chatId)
                    chatKeyRecoveryCooldownUntilMs[normalizedChatId] = now + CHAT_KEY_RECOVERY_COOLDOWN_MS
                    e2eLog(
                        "chat-key-local-evicted-after-decrypt-miss",
                        "userId" to userId,
                        "chatId" to chatId,
                    )
                }
            }

            bootstrapChatKeyIfPossible(userId, chatId, memberUserIds)
            val recoveredChatKey = keyStore.loadLocalChatKey(chatId) ?: return null
            openSecretBox(envelope, decodeBase64(recoveredChatKey))
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            logChatKeyDecryptFailure(chatId, error)
            null
        }
    }

    private suspend fun decryptWithPairwiseKey(
        userId: String,
        chatId: String,
        peerUserId: String,
        content: String,
    ): String? {
        val envelope = parseEnvelope(content) ?: return null
        return try {
            val identity = keyStore.loadIdentity(userId) ?: ensureE2eIdentity(userId) ?: return null
            val peerPublicKeyBase64 = getPeerPublicKey(peerUserId, userId) ?: return null
            val secretKey = decodeBase64(identity.secretKeyBase64)
            val peerPublicKey = decodeBase64(peerPublicKeyBase64)
            val symmetricKey = derivePairwiseKey(secretKey, peerPublicKey)
            openSecretBox(envelope, symmetricKey)
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            logPairwiseDecryptFailure(chatId, peerUserId, error)
            null
        }
    }

    private fun logPairwiseDecryptFailure(chatId: String, peerUserId: String, error: Exception) {
        val key = "${chatId.trim().lowercase()}:${peerUserId.trim().lowercase()}"
        val now = System.currentTimeMillis()
        val lastLoggedAt = pairwiseFailureLoggedAtMs[key] ?: 0L
        if (now - lastLoggedAt < PAIRWISE_FAILURE_LOG_THROTTLE_MS) return
        pairwiseFailureLoggedAtMs[key] = now
        if (error.message == "secretbox open failed") {
            e2eLog(
                "legacy-pairwise-decrypt-miss",
                "chatId" to chatId,
                "peerUserId" to peerUserId,
                "reason" to "secretbox-open-failed",
            )
            return
        }
        Log.d(
            TAG,
            "Legacy pairwise E2E decrypt failed chatId=$chatId peerUserId=$peerUserId",
            error,
        )
    }

    private fun logLocalDecryptFailure(chatId: String, error: Exception) {
        val key = chatId.trim().lowercase()
        val now = System.currentTimeMillis()
        val lastLoggedAt = localDecryptFailureLoggedAtMs[key] ?: 0L
        if (now - lastLoggedAt < DECRYPT_FAILURE_LOG_THROTTLE_MS) return
        localDecryptFailureLoggedAtMs[key] = now
        if (error.message == "secretbox open failed") {
            e2eLog(
                "local-chat-key-decrypt-miss",
                "chatId" to chatId,
                "reason" to "secretbox-open-failed",
            )
            return
        }
        Log.d(TAG, "Local chat-key decrypt failed chatId=$chatId", error)
    }

    private fun logChatKeyDecryptFailure(chatId: String, error: Exception) {
        val key = chatId.trim().lowercase()
        val now = System.currentTimeMillis()
        val lastLoggedAt = chatKeyDecryptFailureLoggedAtMs[key] ?: 0L
        if (now - lastLoggedAt < DECRYPT_FAILURE_LOG_THROTTLE_MS) return
        chatKeyDecryptFailureLoggedAtMs[key] = now
        if (error.message == "secretbox open failed") {
            e2eLog(
                "chat-key-decrypt-miss",
                "chatId" to chatId,
                "reason" to "secretbox-open-failed",
            )
            return
        }
        Log.w(TAG, "Chat-key E2E decrypt failed chatId=$chatId", error)
    }

    private fun logBootstrapSkipInflight(userId: String, chatId: String) {
        val normalizedChatId = chatId.trim().lowercase()
        val now = System.currentTimeMillis()
        val lastLoggedAt = bootstrapSkipInflightLoggedAtMs[normalizedChatId] ?: 0L
        if (now - lastLoggedAt < BOOTSTRAP_SKIP_LOG_THROTTLE_MS) return
        bootstrapSkipInflightLoggedAtMs[normalizedChatId] = now
        e2eLog(
            "bootstrap-if-possible-skip-inflight",
            "userId" to userId,
            "chatId" to chatId,
        )
    }

    private suspend fun attemptForceResetChatKey(
        userId: String,
        chatId: String,
        eligibleMemberIds: List<String>,
    ): String? {
        val normalizedChatId = chatId.trim().lowercase()
        val now = System.currentTimeMillis()
        val lastAttempt = forceResetAttemptedAtMs[normalizedChatId] ?: 0L
        if (now - lastAttempt < FORCE_RESET_ATTEMPT_THROTTLE_MS) {
            e2eLog(
                "force-reset-throttled",
                "userId" to userId,
                "chatId" to chatId,
                "retryInMs" to (FORCE_RESET_ATTEMPT_THROTTLE_MS - (now - lastAttempt)),
            )
            return null
        }
        forceResetAttemptedAtMs[normalizedChatId] = now

        val hasPeer =
            eligibleMemberIds.any { memberId ->
                !memberId.equals(userId, ignoreCase = true)
            }
        if (!hasPeer) return null

        val chatKeyBytes = randomBytes(32)
        val keyBase64 = encodeBase64(chatKeyBytes)
        val wraps = buildWrapsForMembers(chatKeyBytes, eligibleMemberIds, userId, strict = false)
        val hasPeerWrap = wraps.any { wrap -> !wrap.userId.equals(userId, ignoreCase = true) }
        if (!hasPeerWrap) return null

        val uploadResponse =
            e2eApi.uploadChatWrappedKeys(
                chatId,
                UploadChatWrappedKeysRequest(
                    wraps = wraps,
                    keyFingerprint = chatKeyFingerprint(keyBase64),
                    forceReset = true,
                ),
            )
        if (!uploadResponse.isSuccessful) {
            e2eLog(
                "force-reset-upload-failed",
                "userId" to userId,
                "chatId" to chatId,
                "statusCode" to uploadResponse.code(),
            )
            return null
        }

        return keyBase64
    }

    private suspend fun tryRestoreKeyBackup(userId: String): E2eIdentity? {
        val response = runCatching { e2eApi.getKeyBackup() }.getOrNull() ?: return null
        if (!response.isSuccessful) return null
        val encryptedPayload = response.body()?.payloadJsonValue.orEmpty()
        if (encryptedPayload.isBlank()) return null
        val decryptedPayload = decryptBackupPayload(userId, encryptedPayload) ?: return null
        val restored = keyStore.restoreFromBackupPayload(userId, decryptedPayload)
        if (!restored) return null
        return keyStore.loadIdentity(userId)
    }

    private fun scheduleKeyBackupUpload(userId: String) {
        val normalizedUserId = userId.trim().lowercase()
        if (normalizedUserId.isBlank()) return
        val now = System.currentTimeMillis()
        val lastRequestedAt = keyBackupUploadRequestedAtMs[normalizedUserId] ?: 0L
        if (now - lastRequestedAt < KEY_BACKUP_UPLOAD_THROTTLE_MS) return

        synchronized(keyBackupUploadInFlight) {
            if (keyBackupUploadInFlight.contains(normalizedUserId)) return
            keyBackupUploadInFlight.add(normalizedUserId)
            keyBackupUploadRequestedAtMs[normalizedUserId] = now
        }

        backgroundScope.launch {
            try {
                val payloadJson = keyStore.exportBackupPayload(userId) ?: return@launch
                val encryptedPayload = encryptBackupPayload(userId, payloadJson) ?: return@launch
                val response = e2eApi.uploadKeyBackup(UploadE2eKeyBackupRequest(encryptedPayload))
                if (response.isSuccessful) {
                    e2eLog(
                        "key-backup-uploaded",
                        "userId" to userId,
                        "chatKeyCount" to keyStore.listLocalChatIds().size,
                    )
                } else {
                    Log.w(TAG, "uploadKeyBackup failed: ${response.code()}")
                }
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                Log.w(TAG, "uploadKeyBackup error", error)
            } finally {
                synchronized(keyBackupUploadInFlight) {
                    keyBackupUploadInFlight.remove(normalizedUserId)
                }
            }
        }
    }

    private suspend fun encryptBackupPayload(userId: String, payloadJson: String): String? {
        if (payloadJson.isBlank()) return null
        val recoveryKeyBase64 = getOrCreateRecoveryKey(userId) ?: return null
        val recoveryKey = decodeBase64(recoveryKeyBase64)
        val nonce = randomBytes(SecretBox.NONCEBYTES)
        val plaintextBytes = payloadJson.toByteArray(Charsets.UTF_8)
        val ciphertext = ByteArray(plaintextBytes.size + SecretBox.MACBYTES)
        val ok =
            sodium.cryptoSecretBoxEasy(
                ciphertext,
                plaintextBytes,
                plaintextBytes.size.toLong(),
                nonce,
                recoveryKey,
            )
        if (!ok) return null
        return gson.toJson(
            mapOf(
                "enc" to "secretbox-v1",
                "n" to encodeBase64(nonce),
                "c" to encodeBase64(ciphertext),
            ),
        )
    }

    private suspend fun decryptBackupPayload(userId: String, payloadJson: String): String? {
        if (payloadJson.isBlank()) return null
        val parsed =
            runCatching { gson.fromJson(payloadJson, JsonObject::class.java) }.getOrNull()
                ?: return null

        val enc = parsed.get("enc")?.asString
        val nonceBase64 = parsed.get("n")?.asString
        val ciphertextBase64 = parsed.get("c")?.asString

        // Backward compatibility for pre-encrypted backups already stored on server.
        if (enc.isNullOrBlank() || nonceBase64.isNullOrBlank() || ciphertextBase64.isNullOrBlank()) {
            return payloadJson
        }
        if (enc != "secretbox-v1") return null

        val recoveryKeyBase64 = keyStore.loadRecoveryKey(userId)?.trim().orEmpty()
        if (recoveryKeyBase64.isBlank()) {
            e2eLog(
                "key-backup-recovery-key-missing",
                "userId" to userId,
            )
            return null
        }

        val nonce = decodeBase64(nonceBase64)
        val ciphertext = decodeBase64(ciphertextBase64)
        if (ciphertext.size <= SecretBox.MACBYTES) return null
        val plaintext = ByteArray(ciphertext.size - SecretBox.MACBYTES)
        val recoveryKey = decodeBase64(recoveryKeyBase64)
        val ok =
            sodium.cryptoSecretBoxOpenEasy(
                plaintext,
                ciphertext,
                ciphertext.size.toLong(),
                nonce,
                recoveryKey,
            )
        if (!ok) {
            e2eLog(
                "key-backup-decrypt-failed",
                "userId" to userId,
            )
            return null
        }
        return String(plaintext, Charsets.UTF_8)
    }

    private suspend fun getOrCreateRecoveryKey(userId: String): String? {
        val existing = keyStore.loadRecoveryKey(userId)?.trim().orEmpty()
        if (existing.isNotBlank()) return existing
        val keyBytes = randomBytes(SecretBox.KEYBYTES)
        val keyBase64 = encodeBase64(keyBytes)
        keyStore.saveRecoveryKey(userId, keyBase64)
        e2eLog(
            "key-backup-recovery-key-created",
            "userId" to userId,
        )
        return keyBase64
    }

    private fun isSecretboxOpenFailed(error: Exception): Boolean =
        error is IllegalStateException && error.message == "secretbox open failed"

    private suspend fun isDeviceKeyAlreadyUploaded(userId: String, identity: E2eIdentity): Boolean {
        val response = e2eApi.getDeviceKey(userId, identity.deviceId)
        if (!response.isSuccessful) return false
        val serverKey = response.body()?.publicKeyBase64Value.orEmpty()
        return serverKey.isNotBlank() && serverKey == identity.publicKeyBase64
    }

    private fun openSecretBox(envelope: Envelope, key: ByteArray): String {
        val nonce = decodeBase64(envelope.nonce)
        val ciphertext = decodeBase64(envelope.ciphertext)
        val plaintext = ByteArray(ciphertext.size - SecretBox.MACBYTES)
        if (!sodium.cryptoSecretBoxOpenEasy(
                plaintext,
                ciphertext,
                ciphertext.size.toLong(),
                nonce,
                key,
            )
        ) {
            throw IllegalStateException("secretbox open failed")
        }
        return String(plaintext, Charsets.UTF_8)
    }

    private suspend fun openSealedChatKey(userId: String, wrappedKeyBase64: String): ByteArray {
        val identity = keyStore.loadIdentity(userId) ?: ensureE2eIdentity(userId)
            ?: throw IllegalStateException("E2E identity is not initialized")
        val publicKey = decodeBase64(identity.publicKeyBase64)
        val secretKey = decodeBase64(identity.secretKeyBase64)
        val sealed = decodeBase64(wrappedKeyBase64)
        val opened = ByteArray(sealed.size - Box.SEALBYTES)
        if (!sodium.cryptoBoxSealOpen(opened, sealed, sealed.size.toLong(), publicKey, secretKey)) {
            throw IllegalStateException("seal open failed")
        }
        return opened
    }

    private suspend fun sealChatKeyForUser(chatKeyBytes: ByteArray, targetPublicKeyBase64: String): String {
        val publicKey = decodeBase64(targetPublicKeyBase64)
        val sealed = ByteArray(chatKeyBytes.size + Box.SEALBYTES)
        if (!sodium.cryptoBoxSeal(sealed, chatKeyBytes, chatKeyBytes.size.toLong(), publicKey)) {
            throw IllegalStateException("seal failed")
        }
        return encodeBase64(sealed)
    }

    private fun derivePairwiseKey(secretKeyBytes: ByteArray, peerPublicKeyBytes: ByteArray): ByteArray {
        val shared = ByteArray(32)
        if (!sodium.cryptoScalarMult(shared, secretKeyBytes, peerPublicKeyBytes)) {
            throw IllegalStateException("scalarmult failed")
        }
        val hash = ByteArray(32)
        if (!sodium.cryptoGenericHash(hash, hash.size, shared, shared.size.toLong(), null, 0)) {
            throw IllegalStateException("generichash failed")
        }
        return hash
    }

    private fun parseEnvelope(content: String): Envelope? {
        if (content.isBlank()) return null
        return runCatching {
            val json = gson.fromJson(content, JsonObject::class.java)
            val nonce = json.get("n")?.asString ?: json.get("N")?.asString
            val ciphertext = json.get("c")?.asString ?: json.get("C")?.asString
            if (nonce.isNullOrBlank() || ciphertext.isNullOrBlank()) {
                null
            } else {
                Envelope(nonce, ciphertext)
            }
        }.getOrNull()
    }

    private fun normalizeMemberIds(memberUserIds: List<String>, userId: String): List<String> {
        val ids = linkedSetOf<String>()
        memberUserIds.forEach { id ->
            val trimmed = id.trim()
            if (trimmed.isNotBlank()) ids.add(trimmed)
        }
        val self = userId.trim()
        if (self.isNotBlank()) ids.add(self)
        return ids.toList()
    }

    private fun mergedSessionMembers(
        chatId: String,
        userId: String,
        memberUserIds: List<String>,
    ): List<String> {
        val normalizedChatId = chatId.trim().lowercase()
        val incoming = normalizeMemberIds(memberUserIds, userId)
        synchronized(sessionChatMembers) {
            val known = sessionChatMembers.getOrPut(normalizedChatId) { linkedSetOf<String>() }
            known.addAll(incoming)
            return known.toList()
        }
    }

    private fun formatMissingKeysError(missingUserIds: List<String>, currentUserId: String): String {
        val others = missingUserIds.filterNot { it.equals(currentUserId, ignoreCase = true) }
        return when {
            others.isEmpty() ->
                "Не удалось настроить шифрование на этом устройстве. Проверьте соединение и попробуйте снова."
            others.size == 1 ->
                "Не удалось отправить сообщение: у собеседника нет ключа шифрования. Вероятно, он давно не заходил в приложение — попросите его войти в Whithin."
            else ->
                "Не удалось отправить сообщение: у ${others.size} участников нет ключей шифрования (давно не заходили в приложение)."
        }
    }

    private fun randomBytes(size: Int): ByteArray = sodium.randomBytesBuf(size)

    private fun chatKeyFingerprint(chatKeyBase64: String): String {
        val keyBytes = decodeBase64(chatKeyBase64)
        val digest = ByteArray(32)
        if (!sodium.cryptoGenericHash(digest, digest.size, keyBytes, keyBytes.size.toLong(), null, 0)) {
            throw IllegalStateException("key fingerprint hash failed")
        }
        return digest.joinToString(separator = "") { byte -> "%02x".format(byte) }
    }

    private fun shortFingerprint(fingerprint: String): String =
        if (fingerprint.length <= 12) fingerprint else "${fingerprint.take(12)}..."

    private fun summarizeIds(ids: List<String>, max: Int = 8): List<String> {
        if (ids.size <= max) return ids
        return ids.take(max) + "...+${ids.size - max}"
    }

    private fun e2eLog(event: String, vararg fields: Pair<String, Any?>) {
        val payload =
            fields.joinToString(separator = ", ") { (key, value) ->
                "$key=${value ?: "null"}"
            }
        Log.d(TAG, "[E2E] $event $payload")
    }

    private fun encodeBase64(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun decodeBase64(value: String): ByteArray =
        Base64.decode(value, Base64.NO_WRAP)

    private data class Envelope(
        val nonce: String,
        val ciphertext: String,
    )

    companion object {
        private const val TAG = "E2eCryptoService"
        private const val REWRAP_REQUEST_THROTTLE_MS = 30_000L
        private const val REWRAP_RECOVERY_ATTEMPTS = 4
        private const val REWRAP_RECOVERY_DELAY_MS = 1_500L
        private const val PAIRWISE_FAILURE_LOG_THROTTLE_MS = 15_000L
        private const val DECRYPT_FAILURE_LOG_THROTTLE_MS = 15_000L
        private const val BOOTSTRAP_SKIP_LOG_THROTTLE_MS = 10_000L
        private const val CHAT_KEY_RECOVERY_COOLDOWN_MS = 20_000L
        private const val SELF_ONLY_BOOTSTRAP_COOLDOWN_MS = 20_000L
        private const val FORCE_RESET_ATTEMPT_THROTTLE_MS = 60_000L
        private const val KEY_BACKUP_UPLOAD_THROTTLE_MS = 20_000L
    }
}
