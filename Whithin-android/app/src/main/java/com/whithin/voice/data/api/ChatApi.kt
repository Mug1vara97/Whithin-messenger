package com.whithin.voice.data.api

import com.whithin.voice.data.model.ChatDetailInfo
import com.whithin.voice.data.model.ChatInfo
import com.whithin.voice.data.model.ChatParticipant
import com.whithin.voice.data.model.ChatAvatarUploadResponse
import com.whithin.voice.data.model.Message
import com.whithin.voice.data.model.PaginatedMessagesResponse
import com.whithin.voice.data.model.SendMessageRequest
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface ChatApi {
    @GET("/api/Chat/user-chats")
    suspend fun getUserChats(): Response<List<ChatInfo>>
    
    @GET("/api/Chat/{chatId}/messages")
    suspend fun getMessages(@Path("chatId") chatId: String): Response<List<Message>>

    @GET("/api/Chat/{chatId}/messages")
    suspend fun getMessagesPage(
        @Path("chatId") chatId: String,
        @Query("limit") limit: Int,
        @Query("beforeMessageId") beforeMessageId: String? = null,
    ): Response<PaginatedMessagesResponse>
    
    @POST("/api/Chat/{chatId}/messages")
    suspend fun sendMessage(
        @Path("chatId") chatId: String,
        @Body request: SendMessageRequest
    ): Response<Map<String, String>>

    @PUT("/api/Notification/chat/{chatId}/read")
    suspend fun markChatAsRead(@Path("chatId") chatId: String): Response<Map<String, String>>

    @GET("/api/Chat/{chatId}/info")
    suspend fun getChatInfo(@Path("chatId") chatId: String): Response<ChatDetailInfo>

    @GET("/api/Chat/{chatId}/participants")
    suspend fun getChatParticipants(@Path("chatId") chatId: String): Response<List<ChatParticipant>>

    @Multipart
    @POST("/api/Chat/{chatId}/avatar")
    suspend fun uploadChatAvatar(
        @Path("chatId") chatId: String,
        @Part file: MultipartBody.Part,
    ): Response<ChatAvatarUploadResponse>
}
