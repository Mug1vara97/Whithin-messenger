package com.whithin.voice.presentation.ui.components

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

internal object ChatPlaybackCoordinator {
    var activePlaybackId by mutableStateOf<String?>(null)
        private set

    fun activate(id: String) {
        activePlaybackId = id
    }

    fun deactivate(id: String) {
        if (activePlaybackId == id) {
            activePlaybackId = null
        }
    }
}
