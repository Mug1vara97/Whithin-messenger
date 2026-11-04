package com.whithin.voice.data.repository

import android.util.Log
import com.google.gson.Gson
import com.whithin.voice.data.api.AuthApi
import com.whithin.voice.data.api.UserApi
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.local.UserProfileQuickStore
import com.whithin.voice.data.local.UserTokenData
import com.whithin.voice.data.model.ApiErrorResponse
import com.whithin.voice.data.model.ChangeEmailRequest
import com.whithin.voice.data.model.ChangePasswordRequest
import com.whithin.voice.data.model.ConfirmEmailChangeRequest
import com.whithin.voice.data.model.ConfirmEmailRequest
import com.whithin.voice.data.model.ConfirmPasswordChangeRequest
import com.whithin.voice.data.model.ForgotPasswordRequest
import com.whithin.voice.data.model.LoginRequest
import com.whithin.voice.data.model.LogoutRequest
import com.whithin.voice.data.model.QrLoginApproveRequest
import com.whithin.voice.data.model.RefreshTokenRequest
import com.whithin.voice.data.model.RegisterRequest
import com.whithin.voice.data.model.ResendConfirmationRequest
import com.whithin.voice.data.model.UserResponse
import com.whithin.voice.data.model.UserProfileResponse
import com.whithin.voice.domain.model.User
import javax.inject.Inject
import javax.inject.Singleton

sealed class LoginResult {
    data class Success(val user: User) : LoginResult()
    data class EmailNotConfirmed(val email: String?, val message: String) : LoginResult()
    data class Failure(val message: String) : LoginResult()
}

data class RegisterResult(
    val email: String,
    val message: String,
)

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val userApi: UserApi,
    private val tokenManager: TokenManager,
    private val userProfileQuickStore: UserProfileQuickStore,
    private val gson: Gson,
) {
    suspend fun login(username: String, password: String): LoginResult {
        return try {
            val response = authApi.login(LoginRequest(username, password))

            if (response.isSuccessful && response.body() != null) {
                val loginResponse = response.body()!!
                tokenManager.saveToken(loginResponse.token)
                loginResponse.refreshToken?.let { tokenManager.saveRefreshToken(it) }

                val user = User(
                    id = loginResponse.user.id,
                    username = loginResponse.user.usernameValue ?: "",
                    email = loginResponse.user.email ?: "",
                    avatarUrl = loginResponse.user.avatarValue,
                    avatarColor = loginResponse.user.avatarColorValue,
                    bannerUrl = null,
                )
                LoginResult.Success(enrichUserWithProfile(user))
            } else {
                val errorBody = response.errorBody()?.string()
                val apiError = parseApiError(errorBody)
                if (apiError?.needsEmailConfirmation == true) {
                    LoginResult.EmailNotConfirmed(
                        email = apiError.emailValue,
                        message = apiError.message ?: "Подтвердите email перед входом",
                    )
                } else {
                    LoginResult.Failure(apiError?.message ?: errorBody ?: "Ошибка входа")
                }
            }
        } catch (e: Exception) {
            LoginResult.Failure(e.message ?: "Ошибка входа")
        }
    }

    suspend fun register(username: String, password: String, email: String): Result<RegisterResult> {
        return try {
            val response = authApi.register(RegisterRequest(username, password, email))

            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                Result.success(
                    RegisterResult(
                        email = body.emailValue ?: email,
                        message = body.message ?: "Письмо с подтверждением отправлено на ваш email",
                    ),
                )
            } else {
                val errorMessage = parseApiError(response.errorBody()?.string())?.message
                    ?: response.errorBody()?.string()
                    ?: "Ошибка регистрации"
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun resendConfirmation(email: String): Result<String> {
        return try {
            val response = authApi.resendConfirmation(ResendConfirmationRequest(email))
            if (response.isSuccessful) {
                Result.success(response.body()?.text ?: "Если аккаунт существует, письмо отправлено")
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun forgotPassword(email: String): Result<String> {
        return try {
            val response = authApi.forgotPassword(ForgotPasswordRequest(email))
            if (response.isSuccessful) {
                Result.success(
                    response.body()?.text
                        ?: "Если аккаунт с этим email существует, письмо для сброса пароля отправлено",
                )
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun confirmEmail(userId: String, token: String): Result<String> {
        return try {
            val response = authApi.confirmEmail(ConfirmEmailRequest(userId, token))
            if (response.isSuccessful) {
                Result.success(response.body()?.text ?: "Email успешно подтверждён")
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun confirmEmailChange(userId: String, newEmail: String, token: String): Result<String> {
        return try {
            val response = authApi.confirmEmailChange(
                ConfirmEmailChangeRequest(userId, newEmail, token),
            )
            if (response.isSuccessful) {
                Result.success(response.body()?.text ?: "Email успешно изменён")
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun confirmPasswordChange(userId: String, token: String): Result<String> {
        return try {
            val response = authApi.confirmPasswordChange(
                ConfirmPasswordChangeRequest(userId, token),
            )
            if (response.isSuccessful) {
                Result.success(response.body()?.text ?: "Пароль успешно изменён")
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String): Result<String> {
        return try {
            val response = userApi.changePassword(
                ChangePasswordRequest(currentPassword, newPassword),
            )
            if (response.isSuccessful) {
                val body = response.body()
                Result.success(
                    body?.text
                        ?: "Письмо с подтверждением отправлено на ${body?.confirmationEmailValue ?: "ваш email"}",
                )
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun changeEmail(newEmail: String, currentPassword: String): Result<String> {
        return try {
            val response = userApi.changeEmail(
                ChangeEmailRequest(newEmail, currentPassword),
            )
            if (response.isSuccessful) {
                val body = response.body()
                Result.success(
                    body?.text
                        ?: "Письмо с подтверждением отправлено на ${body?.pendingEmailValue ?: newEmail}",
                )
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout(): Result<Unit> {
        return try {
            val refreshToken = tokenManager.getRefreshToken()
            authApi.logout(LogoutRequest(refreshToken))
            tokenManager.clearToken()
            userProfileQuickStore.clear()
            Result.success(Unit)
        } catch (e: Exception) {
            tokenManager.clearToken()
            userProfileQuickStore.clear()
            Result.failure(e)
        }
    }

    suspend fun getCurrentUser(): User? {
        return try {
            val userFromToken = tokenManager.getUserFromToken()
            if (userFromToken != null && userFromToken.id.isNotEmpty() && tokenManager.isTokenValid()) {
                return applyCachedVisuals(
                    User(
                        id = userFromToken.id,
                        username = userFromToken.username,
                        email = userFromToken.email,
                    ),
                )
            }

            refreshCurrentUserFromNetwork()
        } catch (e: Exception) {
            Log.e("AuthRepository", "Error getting current user", e)
            null
        }
    }

    /** Validates session on server and refreshes avatar/profile — run in background after fast JWT login. */
    suspend fun refreshCurrentUserFromNetwork(): User? {
        return try {
            val userFromToken = tokenManager.getUserFromToken()

            if (tokenManager.isTokenValid()) {
                try {
                    val response = authApi.getAuthStatus()
                    if (response.isSuccessful && response.body()?.isAuthenticated == true) {
                        val userResponse = response.body()!!.user
                        if (userResponse != null) {
                            val mergedUser = mergeUserData(userResponse, userFromToken)
                            return enrichUserWithProfile(mergedUser)
                        }
                    } else if (response.isSuccessful) {
                        tokenManager.clearToken()
                        return null
                    }
                } catch (e: Exception) {
                    Log.w("AuthRepository", "Auth status check failed, using token fallback", e)
                }
            }

            if (userFromToken != null && userFromToken.id.isNotEmpty()) {
                return enrichUserWithProfile(
                    User(
                        id = userFromToken.id,
                        username = userFromToken.username,
                        email = userFromToken.email,
                    ),
                )
            }

            null
        } catch (e: Exception) {
            Log.e("AuthRepository", "Error refreshing current user", e)
            null
        }
    }

    suspend fun isAuthenticated(): Boolean = tokenManager.isTokenValid()

    suspend fun refreshAccessToken(): Result<Unit> {
        return try {
            val refreshToken = tokenManager.getRefreshToken()
                ?: return Result.failure(IllegalStateException("No refresh token"))

            val response = authApi.refresh(RefreshTokenRequest(refreshToken))
            if (!response.isSuccessful || response.body() == null) {
                return Result.failure(Exception(response.errorBody()?.string() ?: "Refresh failed"))
            }

            val body = response.body()!!
            tokenManager.saveToken(body.token)
            body.refreshToken?.let { tokenManager.saveRefreshToken(it) }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun approveWebLogin(sessionId: String): Result<Unit> {
        if (sessionId.isBlank()) {
            return Result.failure(IllegalArgumentException("Session id is empty"))
        }

        return try {
            val response = authApi.approveWebQrLogin(QrLoginApproveRequest(sessionId))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to approve web login"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseApiError(errorBody: String?): ApiErrorResponse? {
        if (errorBody.isNullOrBlank()) return null
        return try {
            gson.fromJson(errorBody, ApiErrorResponse::class.java)
        } catch (_: Exception) {
            null
        }
    }

    private fun parseErrorMessage(errorBody: String?): String {
        return parseApiError(errorBody)?.message ?: errorBody ?: "Ошибка запроса"
    }

    private fun mergeUserData(apiUser: UserResponse, tokenUser: UserTokenData?): User {
        return User(
            id = apiUser.id.ifBlank { tokenUser?.id ?: "" },
            username = apiUser.usernameValue?.takeIf { it.isNotBlank() } ?: tokenUser?.username.orEmpty(),
            email = apiUser.email?.takeIf { it.isNotBlank() } ?: tokenUser?.email.orEmpty(),
            avatarUrl = apiUser.avatarValue,
            avatarColor = apiUser.avatarColorValue,
            bannerUrl = null,
        )
    }

    private suspend fun enrichUserWithProfile(user: User): User {
        if (user.id.isBlank()) return user
        return try {
            val profileResponse = authApi.getUserProfile(user.id)
            if (profileResponse.isSuccessful && profileResponse.body() != null) {
                val profile = profileResponse.body()!!
                val enriched =
                    user.copy(
                        username = profile.username?.takeIf { it.isNotBlank() } ?: user.username,
                        displayName = profile.displayName?.takeIf { it.isNotBlank() },
                        avatarUrl = profile.avatar?.takeIf { it.isNotBlank() } ?: user.avatarUrl,
                        avatarColor = profile.avatarColor?.takeIf { it.isNotBlank() } ?: user.avatarColor,
                        bannerUrl = profile.banner?.takeIf { it.isNotBlank() } ?: user.bannerUrl,
                        nameplate = profile.nameplate?.takeIf { it.isNotBlank() } ?: user.nameplate,
                        avatarDecoration = profile.avatarDecoration?.takeIf { it.isNotBlank() } ?: user.avatarDecoration,
                    )
                cacheUserVisuals(enriched)
                enriched
            } else {
                cacheUserVisuals(user)
                user
            }
        } catch (_: Exception) {
            cacheUserVisuals(user)
            user
        }
    }

    fun cacheUserVisuals(user: User) {
        if (user.id.isBlank()) return
        userProfileQuickStore.save(
            userId = user.id,
            avatarUrl = user.avatarUrl,
            avatarColor = user.avatarColor,
            bannerUrl = user.bannerUrl,
            nameplate = user.nameplate,
            avatarDecoration = user.avatarDecoration,
            displayName = user.displayName,
        )
    }

    fun peekCachedUserVisuals(userId: String) = userProfileQuickStore.peek(userId)

    suspend fun prefetchCurrentUserVisuals() {
        val tokenUser = tokenManager.peekUserFromToken() ?: return
        if (tokenUser.id.isBlank()) return
        val cached = userProfileQuickStore.peek(tokenUser.id)
        if (cached?.avatarUrl != null) return
        refreshCurrentUserFromNetwork()
    }

    private fun applyCachedVisuals(user: User): User {
        val cached = userProfileQuickStore.peek(user.id) ?: return user
        return user.copy(
            avatarUrl = user.avatarUrl ?: cached.avatarUrl,
            avatarColor = user.avatarColor ?: cached.avatarColor,
            bannerUrl = user.bannerUrl ?: cached.bannerUrl,
            nameplate = user.nameplate ?: cached.nameplate,
            avatarDecoration = user.avatarDecoration ?: cached.avatarDecoration,
            displayName = user.displayName ?: cached.displayName,
        )
    }

    suspend fun getUserProfileVisuals(userId: String): UserProfileResponse? {
        if (userId.isBlank()) return null
        return try {
            val response = authApi.getUserProfile(userId)
            if (response.isSuccessful) response.body() else null
        } catch (e: Exception) {
            Log.e("AuthRepository", "getUserProfileVisuals exception userId=$userId", e)
            null
        }
    }
}
