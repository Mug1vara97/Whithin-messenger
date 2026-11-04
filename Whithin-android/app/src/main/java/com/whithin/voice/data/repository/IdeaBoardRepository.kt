package com.whithin.voice.data.repository

import com.whithin.voice.data.model.IdeaBoardCard
import com.whithin.voice.data.signalr.ServerHub
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IdeaBoardRepository @Inject constructor(
    private val serverHub: ServerHub,
    private val serverSettingsRepository: ServerSettingsRepository,
) {
    suspend fun connectHub(userId: String, serverId: String): Result<Unit> =
        serverSettingsRepository.connectHub(userId, serverId)

    suspend fun getServerPermissions(serverId: String) =
        serverSettingsRepository.getServer(serverId)

    suspend fun fetchCards(chatId: String): Result<List<IdeaBoardCard>> =
        serverHub.fetchIdeaBoardCards(chatId)

    suspend fun createCard(
        chatId: String,
        title: String,
        body: String,
        tag: String?,
        sourceUrl: String?,
    ): Result<Unit> = serverHub.createIdeaBoardCard(chatId, title, body, tag, sourceUrl)

    suspend fun updateCard(
        cardId: String,
        title: String,
        body: String,
        tag: String?,
        sourceUrl: String?,
        isFiled: Boolean?,
    ): Result<Unit> = serverHub.updateIdeaBoardCard(cardId, title, body, tag, sourceUrl, isFiled)

    suspend fun deleteCard(cardId: String): Result<Unit> =
        serverHub.deleteIdeaBoardCard(cardId)

    fun setIdeaBoardListener(listener: ServerHub.IdeaBoardListener?) {
        serverHub.setIdeaBoardListener(listener)
    }
}
