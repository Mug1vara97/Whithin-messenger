package com.whithin.voice.presentation.ui.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.StateFlow

/**
 * Подписка на [StateFlow] только пока экран в [Lifecycle.State.RESUMED].
 * Экраны под текущим в back stack не перерисовываются при каждом SignalR/VM-апдейте.
 */
@Composable
fun <T> StateFlow<T>.collectAsUiState(
    minActiveState: Lifecycle.State = Lifecycle.State.RESUMED,
): State<T> =
    collectAsStateWithLifecycle(
        minActiveState = minActiveState,
        initialValue = value,
    )
