package com.whithin.voice.data.api

import com.whithin.voice.data.e2e.E2eConstants
import com.whithin.voice.data.model.ChatKeyRecipientsResponse
import com.whithin.voice.data.model.ChatWrappedKeyResponse
import com.whithin.voice.data.model.DeviceKeyResponse
import com.whithin.voice.data.model.E2eKeyBackupResponse
import com.whithin.voice.data.model.RequestChatKeyRewrapRequest
import com.whithin.voice.data.model.UploadChatWrappedKeysRequest
import com.whithin.voice.data.model.UploadDeviceKeyRequest
import com.whithin.voice.data.model.UploadE2eKeyBackupRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface E2eApi {
    @PUT("/api/e2e/keys")
    suspend fun uploadDeviceKey(@Body body: UploadDeviceKeyRequest): Response<Map<String, String>>

    @GET("/api/e2e/keys/{userId}")
    suspend fun getDeviceKey(
        @Path("userId") userId: String,
        @Query("deviceId") deviceId: String? = null,
    ): Response<DeviceKeyResponse>

    @GET("/api/e2e/chat-keys/{chatId}")
    suspend fun getChatWrappedKey(
        @Path("chatId") chatId: String,
        @Query("deviceId") deviceId: String = E2eConstants.DEVICE_ID,
    ): Response<ChatWrappedKeyResponse>

    @GET("/api/e2e/chat-keys/{chatId}/recipients")
    suspend fun getChatKeyRecipients(@Path("chatId") chatId: String): Response<ChatKeyRecipientsResponse>

    @PUT("/api/e2e/chat-keys/{chatId}")
    suspend fun uploadChatWrappedKeys(
        @Path("chatId") chatId: String,
        @Body body: UploadChatWrappedKeysRequest,
    ): Response<Map<String, String>>

    @POST("/api/e2e/chat-keys/{chatId}/rewrap-request")
    suspend fun requestChatKeyRewrap(
        @Path("chatId") chatId: String,
        @Body body: RequestChatKeyRewrapRequest,
    ): Response<Map<String, Any>>

    @PUT("/api/e2e/backup")
    suspend fun uploadKeyBackup(
        @Body body: UploadE2eKeyBackupRequest,
    ): Response<Map<String, Any>>

    @GET("/api/e2e/backup")
    suspend fun getKeyBackup(): Response<E2eKeyBackupResponse>
}
