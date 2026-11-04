package com.whithin.voice.data.api

import com.whithin.voice.data.model.StickerPack
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface StickerApi {
    @GET("/api/stickers/packs")
    suspend fun getStickerPacks(): Response<List<StickerPack>>

    @GET("/api/stickers/packs/available")
    suspend fun getAvailableStickerPacks(): Response<List<StickerPack>>

    @POST("/api/stickers/packs/{packId}/install")
    suspend fun installStickerPack(@Path("packId") packId: String): Response<InstallStickerPackResponse>

    @Multipart
    @POST("/api/stickers/packs/upload")
    suspend fun uploadStickerPack(
        @Part("title") title: RequestBody,
        @Part archive: MultipartBody.Part,
    ): Response<StickerPack>

    @DELETE("/api/stickers/packs/{packId}")
    suspend fun deleteStickerPack(@Path("packId") packId: String): Response<DeleteStickerPackResponse>

    @POST("/api/stickers/chats/{chatId}/send/{stickerId}")
    suspend fun sendSticker(
        @Path("chatId") chatId: String,
        @Path("stickerId") stickerId: String,
        @Body body: SendStickerRequest = SendStickerRequest(),
    ): Response<SendStickerResponse>
}

data class InstallStickerPackResponse(
    val success: Boolean = false,
    val error: String? = null,
)

data class DeleteStickerPackResponse(
    val success: Boolean = false,
    val error: String? = null,
)

data class SendStickerRequest(
    val repliedToMessageId: String? = null,
)

data class SendStickerResponse(
    val success: Boolean = false,
    val messageId: String? = null,
    val error: String? = null,
)
