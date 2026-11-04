package com.whithin.voice.data.api

import com.whithin.voice.data.model.AddMemberToChannelRequest
import com.whithin.voice.data.model.AddServerMemberRequest
import com.whithin.voice.data.model.UpdateServerMemberNicknameRequest
import com.whithin.voice.data.model.Server
import com.whithin.voice.data.model.ServerAvatarUploadResponse
import com.whithin.voice.data.model.ServerBannerUploadResponse
import com.whithin.voice.data.model.ServerDetail
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.data.model.UpdateServerBannerRequest
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path

interface ServerApi {
    @GET("/api/Server/servers")
    suspend fun getUserServers(): Response<List<Server>>

    @GET("/api/Server/{serverId}")
    suspend fun getServer(@Path("serverId") serverId: String): ServerDetail

    @GET("/api/Server/{serverId}")
    suspend fun getServerResponse(@Path("serverId") serverId: String): Response<ServerDetail>

    @GET("/api/Server/{serverId}")
    suspend fun getServerRaw(@Path("serverId") serverId: String): Response<ResponseBody>

    @GET("/api/Server/public")
    suspend fun getPublicServers(): Response<List<Server>>

    @POST("/api/Server/{serverId}/join")
    suspend fun joinServer(@Path("serverId") serverId: String): Response<ResponseBody>

    @Multipart
    @POST("/api/Server/{serverId}/banner")
    suspend fun uploadServerBanner(
        @Path("serverId") serverId: String,
        @Part file: MultipartBody.Part,
    ): Response<ServerBannerUploadResponse>

    @PUT("/api/Server/{serverId}/banner")
    suspend fun updateServerBanner(
        @Path("serverId") serverId: String,
        @Body body: UpdateServerBannerRequest,
    ): Response<ServerDetail>

    @DELETE("/api/Server/{serverId}/banner")
    suspend fun deleteServerBanner(@Path("serverId") serverId: String): Response<ResponseBody>

    @Multipart
    @PUT("/api/Server/{serverId}/avatar")
    suspend fun uploadServerAvatar(
        @Path("serverId") serverId: String,
        @Part file: MultipartBody.Part,
    ): Response<ServerAvatarUploadResponse>

    @DELETE("/api/Server/{serverId}/avatar")
    suspend fun deleteServerAvatar(@Path("serverId") serverId: String): Response<ResponseBody>

    @GET("/api/Server/{serverId}/members")
    suspend fun getServerMembers(@Path("serverId") serverId: String): Response<List<ServerMemberInfo>>

    @PUT("/api/Server/{serverId}/members/{memberUserId}/nickname")
    suspend fun updateMemberNickname(
        @Path("serverId") serverId: String,
        @Path("memberUserId") memberUserId: String,
        @Body body: UpdateServerMemberNicknameRequest,
    ): Response<ResponseBody>

    @POST("/api/Server/{serverId}/add-member")
    suspend fun addServerMember(
        @Path("serverId") serverId: String,
        @Body body: AddServerMemberRequest,
    ): Response<ResponseBody>

    @POST("/api/Server/{serverId}/channels/{channelId}/members")
    suspend fun addMemberToChannel(
        @Path("serverId") serverId: String,
        @Path("channelId") channelId: String,
        @Body body: AddMemberToChannelRequest,
    ): Response<ResponseBody>

    @DELETE("/api/Server/{serverId}/channels/{channelId}/members/{memberUserId}")
    suspend fun removeMemberFromChannel(
        @Path("serverId") serverId: String,
        @Path("channelId") channelId: String,
        @Path("memberUserId") memberUserId: String,
    ): Response<ResponseBody>
}
