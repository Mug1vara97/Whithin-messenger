package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class UploadDeviceKeyRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("publicKeyBase64") val publicKeyBase64: String,
)

data class DeviceKeyResponse(
    @SerializedName("deviceId") val deviceId: String? = null,
    @SerializedName("DeviceId") val deviceIdAlt: String? = null,
    @SerializedName("publicKeyBase64") val publicKeyBase64: String? = null,
    @SerializedName("PublicKeyBase64") val publicKeyBase64Alt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null,
    @SerializedName("UpdatedAt") val updatedAtAlt: String? = null,
) {
    val deviceIdValue: String get() = deviceId ?: deviceIdAlt ?: "default"
    val publicKeyBase64Value: String get() = publicKeyBase64 ?: publicKeyBase64Alt ?: ""
}

data class ChatWrappedKeyResponse(
    @SerializedName("wrappedKeyBase64") val wrappedKeyBase64: String? = null,
    @SerializedName("WrappedKeyBase64") val wrappedKeyBase64Alt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null,
    @SerializedName("UpdatedAt") val updatedAtAlt: String? = null,
) {
    val wrappedKeyBase64Value: String get() = wrappedKeyBase64 ?: wrappedKeyBase64Alt ?: ""
}

data class ChatKeyRecipientsResponse(
    @SerializedName("userIds") val userIds: List<String>? = null,
    @SerializedName("UserIds") val userIdsAlt: List<String>? = null,
) {
    val userIdsValue: List<String> get() = userIds ?: userIdsAlt ?: emptyList()
}

data class ChatWrappedKeyUpload(
    @SerializedName("userId") val userId: String,
    @SerializedName("wrappedKeyBase64") val wrappedKeyBase64: String,
    @SerializedName("deviceId") val deviceId: String = "default",
)

data class UploadChatWrappedKeysRequest(
    @SerializedName("wraps") val wraps: List<ChatWrappedKeyUpload>,
    @SerializedName("keyFingerprint") val keyFingerprint: String? = null,
    @SerializedName("forceReset") val forceReset: Boolean = false,
)

data class RequestChatKeyRewrapRequest(
    @SerializedName("deviceId") val deviceId: String,
)

data class UploadE2eKeyBackupRequest(
    @SerializedName("payloadJson") val payloadJson: String,
)

data class E2eKeyBackupResponse(
    @SerializedName("payloadJson") val payloadJson: String? = null,
    @SerializedName("PayloadJson") val payloadJsonAlt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null,
    @SerializedName("UpdatedAt") val updatedAtAlt: String? = null,
) {
    val payloadJsonValue: String get() = payloadJson ?: payloadJsonAlt ?: ""
}

data class E2eIdentity(
    val deviceId: String,
    val publicKeyBase64: String,
    val secretKeyBase64: String,
    val uploadedPublicKeyBase64: String? = null,
)

data class EncryptedMessagePayload(
    val content: String,
    val encryptionVersion: Int,
)
