package com.whithin.voice.data.api

import com.whithin.voice.data.model.ProfileUploadResponse
import com.whithin.voice.data.model.ProfileUserRequest
import com.whithin.voice.data.model.UpdateAvatarColorRequest
import com.whithin.voice.data.model.UpdateAvatarDecorationRequest
import com.whithin.voice.data.model.UpdateDisplayNameRequest
import com.whithin.voice.data.model.UpdateDisplayNameResponse
import com.whithin.voice.data.model.UpdateProfileAvatarRequest
import com.whithin.voice.data.model.UpdateProfileBannerRequest
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface ProfileApi {
    @Multipart
    @POST("/api/profile/upload/avatar")
    suspend fun uploadAvatar(@Part file: MultipartBody.Part): Response<ProfileUploadResponse>

    @Multipart
    @POST("/api/profile/upload/banner")
    suspend fun uploadBanner(@Part file: MultipartBody.Part): Response<ProfileUploadResponse>

    @POST("/api/profile/update-avatar")
    suspend fun updateAvatar(@Body body: UpdateProfileAvatarRequest): Response<ResponseBody>

    @POST("/api/profile/update-banner")
    suspend fun updateBanner(@Body body: UpdateProfileBannerRequest): Response<ResponseBody>

    @POST("/api/profile/update-avatar-color")
    suspend fun updateAvatarColor(@Body body: UpdateAvatarColorRequest): Response<ResponseBody>

    @POST("/api/profile/update-avatar-decoration")
    suspend fun updateAvatarDecoration(@Body body: UpdateAvatarDecorationRequest): Response<ResponseBody>

    @POST("/api/profile/remove-avatar")
    suspend fun removeAvatar(@Body body: ProfileUserRequest): Response<ResponseBody>

    @POST("/api/profile/remove-avatar-decoration")
    suspend fun removeAvatarDecoration(@Body body: ProfileUserRequest): Response<ResponseBody>

    @POST("/api/profile/remove-banner")
    suspend fun removeBanner(@Body body: ProfileUserRequest): Response<ResponseBody>

    @POST("/api/profile/update-display-name")
    suspend fun updateDisplayName(@Body body: UpdateDisplayNameRequest): Response<UpdateDisplayNameResponse>
}
