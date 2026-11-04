package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

// Request models
data class LoginRequest(
    val username: String,
    val password: String
)

data class RegisterRequest(
    val username: String,
    val password: String,
    val email: String
)

// Response models
data class LoginResponse(
    val message: String?,
    val token: String,
    val refreshToken: String? = null,
    val user: UserResponse
)

data class RefreshTokenRequest(
    val refreshToken: String
)

data class QrLoginApproveRequest(
    val sessionId: String
)

data class QrLoginApproveResponse(
    val message: String
)

data class RefreshTokenResponse(
    val token: String,
    val refreshToken: String? = null,
    val user: UserResponse? = null
)

data class RegisterResponse(
    val userId: String?,
    val message: String?,
    @SerializedName("requiresEmailConfirmation")
    val requiresEmailConfirmation: Boolean? = null,
    @SerializedName("RequiresEmailConfirmation")
    val requiresEmailConfirmationAlt: Boolean? = null,
    val email: String? = null,
    @SerializedName("Email")
    val emailAlt: String? = null,
) {
    val emailValue: String?
        get() = email ?: emailAlt
}

data class ConfirmEmailRequest(
    val userId: String,
    val token: String,
)

data class ConfirmEmailChangeRequest(
    val userId: String,
    val newEmail: String,
    val token: String,
)

data class ConfirmPasswordChangeRequest(
    val userId: String,
    val token: String,
)

data class ResendConfirmationRequest(
    val email: String,
)

data class ForgotPasswordRequest(
    val email: String,
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
)

data class ChangeEmailRequest(
    val newEmail: String,
    val currentPassword: String,
)

data class LogoutRequest(
    val refreshToken: String? = null,
)

data class MessageResponse(
    val message: String?,
    @SerializedName("Message")
    val messageAlt: String? = null,
    val confirmationEmail: String? = null,
    @SerializedName("ConfirmationEmail")
    val confirmationEmailAlt: String? = null,
    val pendingEmail: String? = null,
    @SerializedName("PendingEmail")
    val pendingEmailAlt: String? = null,
) {
    val text: String?
        get() = message ?: messageAlt

    val confirmationEmailValue: String?
        get() = confirmationEmail ?: confirmationEmailAlt

    val pendingEmailValue: String?
        get() = pendingEmail ?: pendingEmailAlt
}

data class UserResponse(
    val id: String,
    @SerializedName("username")
    val username: String?,
    @SerializedName("Username")
    val usernameAlt: String? = null,
    val email: String?,
    @SerializedName("avatar")
    val avatar: String? = null,
    @SerializedName("Avatar")
    val avatarAlt: String? = null,
    @SerializedName("avatarUrl")
    val avatarUrl: String? = null,
    @SerializedName("AvatarUrl")
    val avatarUrlAlt: String? = null,
    @SerializedName("profileImageUrl")
    val profileImageUrl: String? = null,
    @SerializedName("ProfileImageUrl")
    val profileImageUrlAlt: String? = null,
    @SerializedName("image")
    val image: String? = null,
    @SerializedName("Image")
    val imageAlt: String? = null,
    @SerializedName("profilePicture")
    val profilePicture: String? = null,
    @SerializedName("ProfilePicture")
    val profilePictureAlt: String? = null,
    @SerializedName("avatarColor")
    val avatarColor: String? = null,
    @SerializedName("AvatarColor")
    val avatarColorAlt: String? = null,
    @SerializedName("profileColor")
    val profileColor: String? = null,
    @SerializedName("ProfileColor")
    val profileColorAlt: String? = null
) {
    // Helper property to handle both naming conventions
    val usernameValue: String?
        get() = username ?: usernameAlt

    val avatarValue: String?
        get() = avatar
            ?: avatarAlt
            ?: avatarUrl
            ?: avatarUrlAlt
            ?: profileImageUrl
            ?: profileImageUrlAlt
            ?: image
            ?: imageAlt
            ?: profilePicture
            ?: profilePictureAlt

    val avatarColorValue: String?
        get() = avatarColor ?: avatarColorAlt ?: profileColor ?: profileColorAlt
}

data class AuthStatusResponse(
    val isAuthenticated: Boolean,
    val user: UserResponse?,
    val message: String?
)

data class UserProfileResponse(
    @SerializedName("userId")
    val userId: String? = null,
    @SerializedName(value = "username", alternate = ["Username"])
    val username: String? = null,
    @SerializedName(value = "displayName", alternate = ["DisplayName"])
    val displayName: String? = null,
    @SerializedName(value = "avatar", alternate = ["Avatar", "avatarUrl", "AvatarUrl", "profileImageUrl", "ProfileImageUrl", "image", "Image"])
    val avatar: String? = null,
    @SerializedName(value = "avatarColor", alternate = ["AvatarColor", "profileColor", "ProfileColor"])
    val avatarColor: String? = null,
    @SerializedName(value = "banner", alternate = ["Banner", "bannerUrl", "BannerUrl", "profileBanner", "ProfileBanner", "backgroundImage", "BackgroundImage"])
    val banner: String? = null,
    @SerializedName(value = "nameplate", alternate = ["Nameplate"])
    val nameplate: String? = null,
    @SerializedName(value = "avatarDecoration", alternate = ["AvatarDecoration"])
    val avatarDecoration: String? = null,
)
