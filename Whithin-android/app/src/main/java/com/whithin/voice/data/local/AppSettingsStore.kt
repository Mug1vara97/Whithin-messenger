package com.whithin.voice.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.whithin.voice.presentation.ui.theme.AppThemePresets
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.appSettingsDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "app_settings",
)

data class AppSettings(
    val noiseSuppression: Boolean = false,
    val inAppNotificationsEnabled: Boolean = true,
    val soundNotificationsEnabled: Boolean = true,
    val notificationSoundVolume: Int = 100,
    val themePresetId: String = AppThemePresets.DEFAULT_ID,
)

@Singleton
class AppSettingsStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val dataStore = context.appSettingsDataStore
    private val quickPrefs = context.getSharedPreferences(QUICK_PREFS_NAME, Context.MODE_PRIVATE)

    @Volatile
    private var memorySettings: AppSettings? = null

    @Volatile
    private var quickThemePresetId: String? =
        quickPrefs.getString(KEY_THEME_QUICK, null)?.let { AppThemePresets.resolveId(it) }
            ?.takeIf { AppThemePresets.find(it) != null }

    val settings: Flow<AppSettings> = dataStore.data.map { prefs ->
        prefsToSettings(prefs).also { memorySettings = it }
    }

    /** Read settings from disk into memory — call on cold start before first frame. */
    suspend fun warmFromDisk() {
        val settings = prefsToSettings(dataStore.data.first())
        memorySettings = settings
        cacheThemePresetId(settings.themePresetId)
    }

    fun peekSettings(): AppSettings {
        val cached = memorySettings
        if (cached != null) return cached
        val themeId = peekThemePresetId()
        return if (themeId != AppThemePresets.DEFAULT_ID) {
            AppSettings(themePresetId = themeId)
        } else {
            AppSettings()
        }
    }

    /** Synchronous read — uses in-memory / SharedPreferences mirror, not DataStore. */
    fun peekThemePresetId(): String {
        memorySettings?.themePresetId?.let { return it }
        quickThemePresetId?.let { return it }
        return quickPrefs.getString(KEY_THEME_QUICK, null)
            ?.let { AppThemePresets.resolveId(it) }
            ?.takeIf { AppThemePresets.find(it) != null }
            ?.also { quickThemePresetId = it }
            ?: AppThemePresets.DEFAULT_ID
    }

    private fun cacheThemePresetId(id: String) {
        if (AppThemePresets.find(id) == null) return
        quickThemePresetId = id
        quickPrefs.edit().putString(KEY_THEME_QUICK, id).apply()
    }

    private fun prefsToSettings(prefs: Preferences): AppSettings {
        return AppSettings(
            noiseSuppression = prefs[KEY_NOISE_SUPPRESSION] ?: false,
            inAppNotificationsEnabled = prefs[KEY_IN_APP_NOTIFICATIONS] ?: true,
            soundNotificationsEnabled = prefs[KEY_SOUND_NOTIFICATIONS] ?: true,
            notificationSoundVolume = prefs[KEY_NOTIFICATION_VOLUME] ?: 100,
            themePresetId = prefs[KEY_THEME_PRESET]
                ?.let { AppThemePresets.resolveId(it) }
                ?.takeIf { AppThemePresets.find(it) != null }
                ?: AppThemePresets.DEFAULT_ID,
        )
    }

    suspend fun setNoiseSuppression(enabled: Boolean) = edit(KEY_NOISE_SUPPRESSION, enabled)
    suspend fun setInAppNotificationsEnabled(enabled: Boolean) = edit(KEY_IN_APP_NOTIFICATIONS, enabled)
    suspend fun setSoundNotificationsEnabled(enabled: Boolean) = edit(KEY_SOUND_NOTIFICATIONS, enabled)
    suspend fun setNotificationSoundVolume(volume: Int) =
        edit(KEY_NOTIFICATION_VOLUME, volume.coerceIn(0, 100))
    suspend fun setThemePresetId(id: String) {
        if (AppThemePresets.find(id) == null) return
        dataStore.edit { it[KEY_THEME_PRESET] = id }
        cacheThemePresetId(id)
        memorySettings = (memorySettings ?: AppSettings()).copy(themePresetId = id)
    }

    private suspend fun edit(key: Preferences.Key<Boolean>, value: Boolean) {
        dataStore.edit { it[key] = value }
    }

    private suspend fun edit(key: Preferences.Key<Int>, value: Int) {
        dataStore.edit { it[key] = value }
    }

    private suspend fun edit(key: Preferences.Key<String>, value: String) {
        dataStore.edit { it[key] = value }
    }

    companion object {
        private const val QUICK_PREFS_NAME = "app_settings_quick"
        private const val KEY_THEME_QUICK = "theme_preset_id"
        private val KEY_NOISE_SUPPRESSION = booleanPreferencesKey("noise_suppression")
        private val KEY_IN_APP_NOTIFICATIONS = booleanPreferencesKey("in_app_notifications")
        private val KEY_SOUND_NOTIFICATIONS = booleanPreferencesKey("sound_notifications")
        private val KEY_NOTIFICATION_VOLUME = intPreferencesKey("notification_sound_volume")
        private val KEY_THEME_PRESET = stringPreferencesKey("theme_preset_id")
    }
}
