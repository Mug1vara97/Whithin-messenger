package com.whithin.voice.data.local

import android.util.Log
import com.whithin.voice.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Interceptor
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    private fun logDebug(message: String) {
        if (BuildConfig.DEBUG) {
            Log.d("AuthInterceptor", message)
        }
    }

    private fun logWarn(message: String) {
        if (BuildConfig.DEBUG) {
            Log.w("AuthInterceptor", message)
        }
    }

    private fun logError(message: String, error: Throwable) {
        if (BuildConfig.DEBUG) {
            Log.e("AuthInterceptor", message, error)
        }
    }
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val url = originalRequest.url.toString()
        logDebug("Request URL: $url")
        val isRefreshRequest = url.contains("/api/auth/refresh")
        val isRetriedRequest = originalRequest.header("X-Auth-Retry") == "1"
        
        val token = tokenManager.peekToken()
        
        val requestBuilder = originalRequest.newBuilder()
        
        if (token != null && !isRefreshRequest) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
            logDebug("Token added to request (length: ${token.length})")
        } else {
            logWarn("No token available for request")
        }
        
        var response = chain.proceed(requestBuilder.build())
        logDebug("Response code: ${response.code} for URL: $url")

        if (response.code == 401 && !isRefreshRequest && !isRetriedRequest) {
            response.close()
            val refreshed = tryRefreshToken(chain, originalRequest)
            if (refreshed) {
                val newAccessToken = tokenManager.peekToken()
                if (!newAccessToken.isNullOrBlank()) {
                    val retriedRequest = originalRequest.newBuilder()
                        .header("Authorization", "Bearer $newAccessToken")
                        .header("X-Auth-Retry", "1")
                        .build()
                    response = chain.proceed(retriedRequest)
                    logDebug("Retried request response code: ${response.code} for URL: $url")
                }
            }
        }

        return response
    }

    private fun tryRefreshToken(chain: Interceptor.Chain, originalRequest: okhttp3.Request): Boolean {
        return try {
            val refreshToken = tokenManager.peekRefreshToken()
            if (refreshToken.isNullOrBlank()) {
                logWarn("No refresh token to perform refresh")
                return false
            }

            val refreshUrl = originalRequest.url.newBuilder()
                .encodedPath("/api/auth/refresh")
                .build()
            val bodyJson = JSONObject().put("refreshToken", refreshToken).toString()
            val refreshRequest = originalRequest.newBuilder()
                .url(refreshUrl)
                .post(bodyJson.toRequestBody("application/json".toMediaType()))
                .removeHeader("Authorization")
                .header("X-Auth-Retry", "1")
                .build()

            chain.proceed(refreshRequest).use { refreshResponse ->
                if (!refreshResponse.isSuccessful) {
                    logWarn("Refresh request failed: ${refreshResponse.code}")
                    return false
                }

                val body = refreshResponse.body?.string() ?: return false
                val json = JSONObject(body)
                val accessToken = json.optString("token", "")
                if (accessToken.isBlank()) {
                    return false
                }

                val newRefreshToken = json.optString("refreshToken", "")
                tokenManager.saveTokensFromInterceptor(
                    accessToken = accessToken,
                    refreshToken = newRefreshToken.takeIf { it.isNotBlank() },
                )
                true
            }
        } catch (e: Exception) {
            logError("Refresh failed", e)
            false
        }
    }
}
