package com.whithin.voice.data.api

import com.whithin.voice.data.model.RegisterDeviceTokenRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.POST
import retrofit2.http.Path

interface NotificationApi {
    @POST("/api/Notification/device-token")
    suspend fun registerDeviceToken(@Body request: RegisterDeviceTokenRequest): Response<Unit>

    @DELETE("/api/Notification/device-token/{deviceId}")
    suspend fun removeDeviceToken(@Path("deviceId") deviceId: String): Response<Unit>
}
