package com.whithin.voice.presentation.notifications

import com.whithin.voice.data.repository.ChatRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface IncomingCallSignalingEntryPoint {
    fun chatRepository(): ChatRepository
}
