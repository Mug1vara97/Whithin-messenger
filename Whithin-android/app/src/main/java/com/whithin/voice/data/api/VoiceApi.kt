package com.whithin.voice.data.api

import com.whithin.voice.data.model.TokenRequest
import com.whithin.voice.data.model.TokenResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface VoiceApi {
    @POST("/api/token")
    suspend fun getToken(@Body request: TokenRequest): TokenResponse
}
