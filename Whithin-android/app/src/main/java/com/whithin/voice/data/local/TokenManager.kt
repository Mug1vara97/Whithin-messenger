package com.whithin.voice.data.local

import android.content.Context
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "token_prefs")

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.dataStore
    private val quickPrefs = context.getSharedPreferences(QUICK_PREFS_NAME, Context.MODE_PRIVATE)

    @Volatile
    private var memoryAccessToken: String? = quickPrefs.getString(KEY_ACCESS_TOKEN_QUICK, null)

    @Volatile
    private var memoryRefreshToken: String? = quickPrefs.getString(KEY_REFRESH_TOKEN_QUICK, null)

    private val persistScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        persistScope.launch {
            getToken()
            getRefreshToken()
        }
    }

    /** Fast synchronous read — in-memory cache, then SharedPreferences mirror. */
    fun peekToken(): String? {
        memoryAccessToken?.let { return it }
        return quickPrefs.getString(KEY_ACCESS_TOKEN_QUICK, null)?.also { memoryAccessToken = it }
    }

    fun peekRefreshToken(): String? {
        memoryRefreshToken?.let { return it }
        return quickPrefs.getString(KEY_REFRESH_TOKEN_QUICK, null)?.also { memoryRefreshToken = it }
    }

    /** Decode user from in-memory token without DataStore I/O — call after [getToken] warmed cache. */
    fun peekUserFromToken(): UserTokenData? {
        val payload = peekToken()?.let(::decodeTokenPayload) ?: return null
        return try {
            UserTokenData(
                id = payload.optString("UserId", ""),
                username = payload.optString("Username", ""),
                email = payload.optString("email", ""),
            )
        } catch (_: Exception) {
            null
        }
    }

    /** JWT exp check using in-memory token only — avoids blocking UI on cold start. */
    fun peekHasValidSession(): Boolean {
        val payload = peekToken()?.let(::decodeTokenPayload) ?: return false
        val expSec = payload.optLong("exp", 0L)
        if (expSec <= 0L) return false
        return System.currentTimeMillis() < expSec * 1000
    }
    
    companion object {
        private const val QUICK_PREFS_NAME = "token_quick"
        private const val KEY_ACCESS_TOKEN_QUICK = "access_token"
        private const val KEY_REFRESH_TOKEN_QUICK = "refresh_token"
        private val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
        private val TOKEN_EXPIRY_KEY = stringPreferencesKey("token_expiry")
    }
    
    suspend fun saveToken(token: String, expiresIn: Long? = null) {
        dataStore.edit { preferences ->
            preferences[ACCESS_TOKEN_KEY] = token
            
            val expiryTime = expiresIn?.let {
                System.currentTimeMillis() + (it * 1000)
            } ?: run {
                val jwtExpiryMs = decodeTokenPayload(token)
                    ?.optLong("exp", 0L)
                    ?.takeIf { it > 0L }
                    ?.times(1000)
                jwtExpiryMs ?: (System.currentTimeMillis() + (24 * 60 * 60 * 1000))
            }
            
            preferences[TOKEN_EXPIRY_KEY] = expiryTime.toString()
        }
        memoryAccessToken = token
        quickPrefs.edit().putString(KEY_ACCESS_TOKEN_QUICK, token).apply()
    }

    /** Memory + SharedPreferences first so OkHttp interceptors never block on DataStore. */
    fun saveTokensFromInterceptor(accessToken: String, refreshToken: String?) {
        memoryAccessToken = accessToken
        val editor = quickPrefs.edit().putString(KEY_ACCESS_TOKEN_QUICK, accessToken)
        if (!refreshToken.isNullOrBlank()) {
            memoryRefreshToken = refreshToken
            editor.putString(KEY_REFRESH_TOKEN_QUICK, refreshToken)
        }
        editor.apply()
        persistScope.launch {
            saveToken(accessToken)
            if (!refreshToken.isNullOrBlank()) {
                saveRefreshToken(refreshToken)
            }
        }
    }
    
    suspend fun getToken(): String? {
        memoryAccessToken?.let { return it }
        val token = dataStore.data.first()[ACCESS_TOKEN_KEY]
        memoryAccessToken = token
        if (token != null) {
            quickPrefs.edit().putString(KEY_ACCESS_TOKEN_QUICK, token).apply()
        }
        return token
    }

    suspend fun saveRefreshToken(token: String) {
        memoryRefreshToken = token
        quickPrefs.edit().putString(KEY_REFRESH_TOKEN_QUICK, token).apply()
        dataStore.edit { preferences ->
            preferences[REFRESH_TOKEN_KEY] = token
        }
    }

    suspend fun getRefreshToken(): String? {
        peekRefreshToken()?.let { return it }
        val token = dataStore.data.first()[REFRESH_TOKEN_KEY]
        if (token != null) {
            memoryRefreshToken = token
            quickPrefs.edit().putString(KEY_REFRESH_TOKEN_QUICK, token).apply()
        }
        return token
    }
    
    fun getTokenFlow(): Flow<String?> {
        return dataStore.data.map { it[ACCESS_TOKEN_KEY] }
    }
    
    suspend fun isTokenValid(): Boolean {
        if (getToken() == null) return false
        return !isTokenExpired()
    }
    
    suspend fun isTokenExpired(): Boolean {
        val expiryTime = dataStore.data.first()[TOKEN_EXPIRY_KEY]?.toLongOrNull() ?: run {
            val token = getToken() ?: return true
            val fromJwt = decodeTokenPayload(token)
                ?.optLong("exp", 0L)
                ?.takeIf { it > 0L }
                ?.times(1000)
            if (fromJwt != null) {
                dataStore.edit { prefs -> prefs[TOKEN_EXPIRY_KEY] = fromJwt.toString() }
                fromJwt
            } else {
                return true
            }
        }
        return System.currentTimeMillis() > expiryTime
    }
    
    suspend fun isTokenExpiringSoon(): Boolean {
        val expiryTime = dataStore.data.first()[TOKEN_EXPIRY_KEY]?.toLongOrNull() ?: return true
        val fiveMinutesFromNow = System.currentTimeMillis() + (5 * 60 * 1000)
        return expiryTime < fiveMinutesFromNow
    }
    
    suspend fun decodeToken(): JSONObject? {
        val token = getToken() ?: return null
        return decodeTokenPayload(token)
    }

    private fun decodeTokenPayload(token: String): JSONObject? {
        return try {
            val parts = token.split(".")
            if (parts.size != 3) {
                throw IllegalArgumentException("Invalid JWT format")
            }
            
            val payload = parts[1]
            val decodedBytes = Base64.decode(payload, Base64.URL_SAFE or Base64.NO_PADDING)
            val decodedString = String(decodedBytes)
            JSONObject(decodedString)
        } catch (e: Exception) {
            android.util.Log.e("TokenManager", "Error decoding token", e)
            null
        }
    }
    
    suspend fun getUserFromToken(): UserTokenData? {
        val decoded = decodeToken() ?: return null
        return try {
            UserTokenData(
                id = decoded.optString("UserId", ""),
                username = decoded.optString("Username", ""),
                email = decoded.optString("email", "")
            )
        } catch (e: Exception) {
            android.util.Log.e("TokenManager", "Error getting user from token", e)
            null
        }
    }
    
    suspend fun clearToken() {
        memoryAccessToken = null
        memoryRefreshToken = null
        quickPrefs.edit()
            .remove(KEY_ACCESS_TOKEN_QUICK)
            .remove(KEY_REFRESH_TOKEN_QUICK)
            .apply()
        dataStore.edit { preferences ->
            preferences.remove(ACCESS_TOKEN_KEY)
            preferences.remove(REFRESH_TOKEN_KEY)
            preferences.remove(TOKEN_EXPIRY_KEY)
        }
    }
}

data class UserTokenData(
    val id: String,
    val username: String,
    val email: String
)
