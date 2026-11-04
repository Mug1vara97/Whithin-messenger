package com.whithin.voice.presentation.viewmodel



import android.content.Context

import android.util.Log

import androidx.lifecycle.ViewModel

import androidx.lifecycle.viewModelScope

import com.whithin.voice.data.model.ChatInfo

import com.whithin.voice.data.model.ForwardChannelTarget

import com.whithin.voice.data.model.Server

import com.whithin.voice.data.model.ServerDetail

import com.whithin.voice.data.repository.ChatRepository

import com.whithin.voice.data.repository.ServerDetailRepository

import com.whithin.voice.data.repository.ServerRepository

import com.whithin.voice.presentation.share.SharePayload

import dagger.hilt.android.lifecycle.HiltViewModel

import dagger.hilt.android.qualifiers.ApplicationContext

import kotlinx.coroutines.Dispatchers

import kotlinx.coroutines.async

import kotlinx.coroutines.awaitAll

import kotlinx.coroutines.coroutineScope

import kotlinx.coroutines.flow.MutableStateFlow

import kotlinx.coroutines.flow.StateFlow

import kotlinx.coroutines.flow.asStateFlow

import kotlinx.coroutines.launch

import kotlinx.coroutines.withContext

import javax.inject.Inject



data class ShareContentUiState(

    val chats: List<ChatInfo> = emptyList(),

    val channels: List<ForwardChannelTarget> = emptyList(),

    val isLoading: Boolean = false,

    val isSending: Boolean = false,

    val error: String? = null,

    val sendSuccess: Boolean = false,

)



@HiltViewModel

class ShareContentViewModel @Inject constructor(

    private val chatRepository: ChatRepository,

    private val serverRepository: ServerRepository,

    private val serverDetailRepository: ServerDetailRepository,

    @ApplicationContext private val context: Context,

) : ViewModel() {

    private val _uiState = MutableStateFlow(ShareContentUiState())

    val uiState: StateFlow<ShareContentUiState> = _uiState.asStateFlow()



    fun loadTargets(userId: String) {

        if (userId.isBlank()) return



        viewModelScope.launch {

            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {

                withContext(Dispatchers.IO) {

                    chatRepository.connectSignalR(userId)

                    val chatsResult = chatRepository.getUserChats()

                    val chats =

                        chatsResult.getOrNull()

                            ?.sortedByDescending { it.lastMessageTimeValue }

                            ?: chatRepository.chats.value

                    val channels = loadChannelTargets(userId)



                    _uiState.value =

                        _uiState.value.copy(

                            chats = chats,

                            channels = channels,

                            isLoading = false,

                            error =

                                if (chatsResult.isFailure && chats.isEmpty() && channels.isEmpty()) {

                                    chatsResult.exceptionOrNull()?.message

                                        ?: "Не удалось загрузить чаты и каналы"

                                } else {

                                    null

                                },

                        )

                }

            } catch (e: Exception) {

                Log.e("ShareContentViewModel", "loadTargets failed", e)

                _uiState.value =

                    _uiState.value.copy(

                        isLoading = false,

                        error = e.message ?: "Не удалось загрузить чаты и каналы",

                    )

            }

        }

    }



    fun sendToChat(

        payload: SharePayload,

        chatId: String,

        username: String,

        extraCaption: String,

    ) {

        if (chatId.isBlank() || username.isBlank()) return

        if (_uiState.value.isSending) return



        viewModelScope.launch {

            _uiState.value = _uiState.value.copy(isSending = true, error = null, sendSuccess = false)



            val result =

                withContext(Dispatchers.IO) {

                    when (payload) {

                        is SharePayload.Text -> {

                            val content = mergeText(payload.text, extraCaption)

                            chatRepository.sendMessageToAnyChat(chatId, content, username)

                        }



                        is SharePayload.Media -> {

                            val caption = mergeCaption(payload.text, extraCaption)

                            if (shouldSendMediaAsText(payload, caption)) {

                                chatRepository.sendMessageToAnyChat(

                                    chatId,

                                    caption ?: payload.uri.toString(),

                                    username,

                                )

                            } else {

                                chatRepository.uploadMedia(

                                    chatId = chatId,

                                    fileUri = payload.uri,

                                    context = context,

                                    username = username,

                                    caption = caption,

                                ).map { Unit }

                            }

                        }

                    }

                }



            result

                .onSuccess {

                    _uiState.value =

                        _uiState.value.copy(

                            isSending = false,

                            sendSuccess = true,

                        )

                }

                .onFailure { error ->

                    Log.e("ShareContentViewModel", "sendToChat failed", error)

                    _uiState.value =

                        _uiState.value.copy(

                            isSending = false,

                            error = error.message ?: "Не удалось отправить",

                        )

                }

        }

    }



    fun clearSendSuccess() {

        _uiState.value = _uiState.value.copy(sendSuccess = false)

    }



    private suspend fun loadChannelTargets(userId: String): List<ForwardChannelTarget> {

        val servers = serverRepository.awaitServers(userId)

        if (servers.isEmpty()) return emptyList()



        return coroutineScope {

            servers

                .map { server ->

                    async {

                        val serverId = server.serverIdValue.trim()

                        if (serverId.isBlank()) return@async emptyList()

                        val detail =

                            serverDetailRepository.getServer(serverId).getOrNull()

                                ?: return@async emptyList()

                        val serverName = resolveServerName(server, detail)

                        detail.categoriesValue

                            .sortedBy { it.categoryOrderValue }

                            .flatMap { category ->

                                val categoryName =

                                    category.categoryNameValue?.trim().orEmpty().ifBlank { "Каналы" }

                                category.chatsValue

                                    .filter { it.isTextChannel }

                                    .sortedBy { it.chatOrderValue }

                                    .mapNotNull { channel ->

                                        val chatId = channel.chatIdValue.trim()

                                        if (chatId.isBlank()) {

                                            null

                                        } else {

                                            ForwardChannelTarget(

                                                chatId = chatId,

                                                channelName = channel.nameValue,

                                                serverId = serverId,

                                                serverName = serverName,

                                                serverIconUrl = server.iconUrlValue,

                                                categoryName = categoryName,

                                                categoryOrder = category.categoryOrderValue,

                                                channelOrder = channel.chatOrderValue,

                                            )

                                        }

                                    }

                            }

                    }

                }

                .awaitAll()

                .flatten()

                .sortedWith(

                    compareBy(

                        { it.serverName.lowercase() },

                        { it.categoryOrder },

                        { it.channelOrder },

                        { it.channelName.lowercase() },

                    ),

                )

        }

    }



    private fun resolveServerName(server: Server, detail: ServerDetail): String {

        val fromList = server.nameValue.trim()

        val fromDetail = detail.nameValue.trim()

        return when {

            fromDetail.isNotBlank() &&

                !fromDetail.equals("Unknown Server", ignoreCase = true) -> fromDetail

            fromList.isNotBlank() &&

                !fromList.equals("Unknown Server", ignoreCase = true) -> fromList

            else -> fromList.ifBlank { fromDetail }.ifBlank { "Сервер" }

        }

    }



    private fun mergeText(sharedText: String, extraCaption: String): String {

        val caption = extraCaption.trim()

        return when {

            caption.isBlank() -> sharedText.trim()

            caption == sharedText.trim() -> sharedText.trim()

            else -> "$caption\n\n${sharedText.trim()}"

        }

    }



    private fun mergeCaption(sharedText: String?, extraCaption: String): String? {

        val caption = extraCaption.trim()

        val shared = sharedText?.trim().orEmpty()

        return when {

            caption.isBlank() && shared.isBlank() -> null

            caption.isBlank() -> shared

            shared.isBlank() -> caption

            caption == shared -> caption

            else -> "$caption\n\n$shared"

        }

    }



    private fun shouldSendMediaAsText(payload: SharePayload.Media, caption: String?): Boolean {

        val mime = payload.mimeType?.lowercase().orEmpty()

        if (mime.startsWith("text/")) return true

        if (mime.isBlank() && caption != null) return true

        return false

    }

}

