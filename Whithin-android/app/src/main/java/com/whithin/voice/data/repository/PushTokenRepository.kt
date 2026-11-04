package com.whithin.voice.data.repository

import android.content.Context
import android.provider.Settings
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.whithin.voice.data.api.NotificationApi
import com.whithin.voice.data.model.RegisterDeviceTokenRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

@Singleton
class PushTokenRepository @Inject constructor(
    private val notificationApi: NotificationApi,
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    suspend fun syncCurrentToken(): Result<Unit> {
        return try {
            val token = fetchFcmToken()
            if (token.isBlank()) {
                return Result.failure(IllegalStateException("FCM token is empty"))
            }
            syncToken(token)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to sync push token", e)
            Result.failure(e)
        }
    }

    /** Retries a token saved by [rememberPendingToken] (e.g. after login). */
    suspend fun syncPendingIfNeeded(): Result<Unit> {
        val pending = prefs.getString(KEY_PENDING_TOKEN, null)?.trim().orEmpty()
        if (pending.isNotBlank()) {
            return syncToken(pending)
        }
        return syncCurrentToken()
    }

    fun rememberPendingToken(token: String) {
        val normalized = token.trim()
        if (normalized.isBlank()) return
        prefs.edit().putString(KEY_PENDING_TOKEN, normalized).apply()
    }

    suspend fun syncToken(token: String): Result<Unit> {
        return try {
            if (token.isBlank()) {
                return Result.failure(IllegalArgumentException("FCM token is empty"))
            }

            val response = notificationApi.registerDeviceToken(
                RegisterDeviceTokenRequest(
                    token = token,
                    deviceId = getDeviceId()
                )
            )
            if (response.isSuccessful) {
                prefs.edit()
                    .putString(KEY_REGISTERED_TOKEN, token)
                    .remove(KEY_PENDING_TOKEN)
                    .apply()
                Log.d(TAG, "Push token registered for device ${getDeviceId()}")
                Result.success(Unit)
            } else {
                rememberPendingToken(token)
                Result.failure(Exception("Failed to register push token: ${response.code()}"))
            }
        } catch (e: Exception) {
            rememberPendingToken(token)
            Log.w(TAG, "Failed to register FCM token", e)
            Result.failure(e)
        }
    }

    suspend fun removeCurrentDeviceToken(): Result<Unit> {
        return try {
            val response = notificationApi.removeDeviceToken(getDeviceId())
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to remove push token: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.w("PushTokenRepository", "Failed to remove FCM token", e)
            Result.failure(e)
        }
    }

    private suspend fun fetchFcmToken(): String {
        return suspendCancellableCoroutine { continuation ->
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    continuation.resume(token.orEmpty())
                }
                .addOnFailureListener { error ->
                    continuation.resumeWith(Result.failure(error))
                }
        }
    }

    private fun getDeviceId(): String {
        val androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )
        return if (androidId.isNullOrBlank()) "android-default" else androidId
    }

    companion object {
        private const val TAG = "PushTokenRepository"
        private const val PREFS_NAME = "push_token_prefs"
        private const val KEY_PENDING_TOKEN = "pending_token"
        private const val KEY_REGISTERED_TOKEN = "registered_token"
    }
}
