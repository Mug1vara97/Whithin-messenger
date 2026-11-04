package com.whithin.voice.presentation.notifications

import com.whithin.voice.data.e2e.E2eCryptoService
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.repository.ChatRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface ChatNotificationEntryPoint {
    fun chatRepository(): ChatRepository
    fun chatNotificationManager(): ChatNotificationManager
    fun tokenManager(): TokenManager
    fun e2eCryptoService(): E2eCryptoService
}
