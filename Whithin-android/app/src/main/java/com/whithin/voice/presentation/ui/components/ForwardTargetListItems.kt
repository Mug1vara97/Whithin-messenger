package com.whithin.voice.presentation.ui.components

import com.whithin.voice.data.model.ChatInfo
import com.whithin.voice.data.model.ForwardChannelTarget
import com.whithin.voice.data.model.ForwardListItem

fun buildForwardListItems(
    chats: List<ChatInfo>,
    channelTargets: List<ForwardChannelTarget>,
    currentChatId: String = "",
): List<ForwardListItem> {
    val currentId = currentChatId.trim()
    val channelTargetsFiltered =
        channelTargets.filter { target ->
            target.chatId.isNotBlank() &&
                !target.chatId.equals(currentId, ignoreCase = true)
        }
    val serverChannelIds =
        channelTargetsFiltered
            .map { it.chatId.trim().lowercase() }
            .toSet()

    val channels =
        channelTargetsFiltered.map { target ->
            ForwardListItem.ServerChannel(
                chatId = target.chatId,
                channelName = target.channelName,
                serverId = target.serverId,
                serverName = target.serverName,
                serverIconUrl = target.serverIconUrl,
            )
        }

    val directMessages =
        chats
            .filter { chat ->
                val id = chat.chatIdValue.trim()
                id.isNotBlank() &&
                    !id.equals(currentId, ignoreCase = true) &&
                    !serverChannelIds.contains(id.lowercase())
            }
            .map { chat ->
                val isSavedMessages = chat.isSavedMessagesValue
                ForwardListItem.DirectMessage(
                    chatId = chat.chatIdValue,
                    title =
                        if (isSavedMessages) {
                            "Избранное"
                        } else {
                            chat.usernameValue.ifBlank {
                                if (chat.isGroupChatValue) "Группа" else "Чат"
                            }
                        },
                    subtitle =
                        if (isSavedMessages) {
                            "Сохранённые сообщения"
                        } else {
                            formatChatListLastMessage(chat.lastMessageValue)
                        },
                    avatarUrl = if (isSavedMessages) null else chat.avatarUrlValue,
                    avatarColor = if (isSavedMessages) null else chat.avatarColorValue,
                    isGroup = !isSavedMessages && chat.isGroupChatValue,
                    isSavedMessages = isSavedMessages,
                )
            }

    return channels + directMessages
}
