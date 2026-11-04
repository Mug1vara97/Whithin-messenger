package com.whithin.voice.data.api

import com.whithin.voice.data.model.AuthStatusResponse
import com.whithin.voice.data.model.ConfirmEmailChangeRequest
import com.whithin.voice.data.model.ConfirmEmailRequest
import com.whithin.voice.data.model.ConfirmPasswordChangeRequest
import com.whithin.voice.data.model.ForgotPasswordRequest
import com.whithin.voice.data.model.LoginRequest
import com.whithin.voice.data.model.LoginResponse
import com.whithin.voice.data.model.LogoutRequest
import com.whithin.voice.data.model.MessageResponse
import com.whithin.voice.data.model.QrLoginApproveRequest
import com.whithin.voice.data.model.QrLoginApproveResponse
import com.whithin.voice.data.model.RefreshTokenRequest
import com.whithin.voice.data.model.RefreshTokenResponse
import com.whithin.voice.data.model.RegisterRequest
import com.whithin.voice.data.model.RegisterResponse
import com.whithin.voice.data.model.ResendConfirmationRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface AuthApi {
    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
    
    @POST("/api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>
    
    @POST("/api/auth/logout")
    suspend fun logout(@Body request: LogoutRequest): Response<Unit>

    @POST("/api/auth/confirm-email")
    suspend fun confirmEmail(@Body request: ConfirmEmailRequest): Response<MessageResponse>

    @POST("/api/auth/resend-confirmation")
    suspend fun resendConfirmation(@Body request: ResendConfirmationRequest): Response<MessageResponse>

    @POST("/api/auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<MessageResponse>

    @POST("/api/auth/confirm-email-change")
    suspend fun confirmEmailChange(@Body request: ConfirmEmailChangeRequest): Response<MessageResponse>

    @POST("/api/auth/confirm-password-change")
    suspend fun confirmPasswordChange(@Body request: ConfirmPasswordChangeRequest): Response<MessageResponse>

    @POST("/api/auth/refresh")
    suspend fun refresh(@Body request: RefreshTokenRequest): Response<RefreshTokenResponse>
    
    @GET("/api/auth/status")
    suspend fun getAuthStatus(): Response<AuthStatusResponse>

    @POST("/api/auth/qr/approve")
    suspend fun approveWebQrLogin(@Body request: QrLoginApproveRequest): Response<QrLoginApproveResponse>

    @GET("/api/profile/{userId}/profile")
    suspend fun getUserProfile(@Path("userId") userId: String): Response<com.whithin.voice.data.model.UserProfileResponse>
}
