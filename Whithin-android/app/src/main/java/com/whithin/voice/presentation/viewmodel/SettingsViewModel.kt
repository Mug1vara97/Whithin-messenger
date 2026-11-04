package com.whithin.voice.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.local.AppSettings
import com.whithin.voice.data.local.AppSettingsStore
import com.whithin.voice.presentation.service.LiveKitService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val appSettingsStore: AppSettingsStore,
    private val liveKitService: LiveKitService,
) : ViewModel() {

    val settings: StateFlow<AppSettings> = appSettingsStore.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppSettings())

    fun setNoiseSuppression(enabled: Boolean) {
        viewModelScope.launch {
            appSettingsStore.setNoiseSuppression(enabled)
            liveKitService.setNoiseSuppressionEnabled(enabled)
        }
    }

    fun setInAppNotificationsEnabled(enabled: Boolean) {
        viewModelScope.launch { appSettingsStore.setInAppNotificationsEnabled(enabled) }
    }

    fun setSoundNotificationsEnabled(enabled: Boolean) {
        viewModelScope.launch { appSettingsStore.setSoundNotificationsEnabled(enabled) }
    }

    fun setNotificationSoundVolume(volume: Int) {
        viewModelScope.launch { appSettingsStore.setNotificationSoundVolume(volume) }
    }

    fun setThemePresetId(id: String) {
        viewModelScope.launch { appSettingsStore.setThemePresetId(id) }
    }
}
