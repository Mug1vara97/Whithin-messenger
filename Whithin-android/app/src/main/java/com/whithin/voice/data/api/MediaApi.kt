package com.whithin.voice.data.api

import com.whithin.voice.data.model.MediaFile
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface MediaApi {
    @Multipart
    @POST("/api/media/upload")
    suspend fun uploadMedia(
        @Part("chatId") chatId: RequestBody,
        @Part file: MultipartBody.Part,
        @Part("caption") caption: RequestBody? = null,
        @Part("userId") userId: RequestBody? = null,
        @Part("username") username: RequestBody? = null,
        @Part("isVideoNote") isVideoNote: RequestBody,
    ): Response<UploadMediaResponse>

    @Multipart
    @POST("/api/media/upload-batch")
    suspend fun uploadMediaBatch(
        @Part("chatId") chatId: RequestBody,
        @Part files: List<MultipartBody.Part>,
        @Part("caption") caption: RequestBody? = null,
        @Part("username") username: RequestBody? = null,
    ): Response<UploadMediaBatchResponse>

    @GET("/api/media/{chatId}")
    suspend fun getChatMediaFiles(
        @Path("chatId") chatId: String,
        @Query("mediaType") mediaType: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 100,
    ): Response<GetChatMediaFilesResponse>
}

data class UploadMediaResponse(
    val success: Boolean,
    val messageId: String? = null,
    val mediaFileId: String? = null,
    val filePath: String? = null,
    val thumbnailPath: String? = null,
    val fileName: String? = null,
    val originalFileName: String? = null,
    val contentType: String? = null,
    val fileSize: Long? = null,
    val error: String? = null
)

data class UploadMediaBatchResponse(
    val success: Boolean,
    val messageId: String? = null,
    val mediaFiles: List<UploadMediaBatchItemResponse>? = null,
    val error: String? = null,
)

data class UploadMediaBatchItemResponse(
    val mediaFileId: String? = null,
    val filePath: String? = null,
    val thumbnailPath: String? = null,
    val fileName: String? = null,
    val originalFileName: String? = null,
    val contentType: String? = null,
    val fileSize: Long? = null,
)

data class GetChatMediaFilesResponse(
    val mediaFiles: List<ChatMediaFileDto>? = null,
    val totalCount: Int = 0,
    val page: Int = 1,
    val pageSize: Int = 0,
    val hasMore: Boolean = false,
)

data class ChatMediaFileDto(
    val id: String? = null,
    val fileName: String? = null,
    val originalFileName: String? = null,
    val filePath: String? = null,
    val contentType: String? = null,
    val fileSize: Long? = null,
    val thumbnailPath: String? = null,
    val isVideoNote: Boolean? = null,
    val senderUsername: String? = null,
    val createdAt: String? = null,
    val caption: String? = null,
)

fun ChatMediaFileDto.toMediaFile(): MediaFile =
    MediaFile(
        id = id,
        fileName = fileName,
        originalFileName = originalFileName,
        filePath = filePath,
        contentType = contentType,
        fileSize = fileSize,
        thumbnailPath = thumbnailPath,
        isVideoNote = isVideoNote,
        senderUsername = senderUsername,
        createdAt = createdAt,
        caption = caption,
    )
