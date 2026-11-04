package com.whithin.voice.data.api

import com.whithin.voice.data.model.ChangeEmailRequest
import com.whithin.voice.data.model.ChangePasswordRequest
import com.whithin.voice.data.model.MessageResponse
import com.whithin.voice.data.model.UpdateUserStatusRequest
import com.whithin.voice.data.model.UserStatusResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface UserApi {
    @PUT("/api/User/status/{userId}")
    suspend fun updateStatus(
        @Path("userId") userId: String,
        @Body request: UpdateUserStatusRequest
    ): Response<UserStatusResponse>

    @POST("/api/user/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<MessageResponse>

    @POST("/api/user/change-email")
    suspend fun changeEmail(@Body request: ChangeEmailRequest): Response<MessageResponse>
}
