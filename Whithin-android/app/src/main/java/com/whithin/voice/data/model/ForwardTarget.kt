package com.whithin.voice.data.model

/** Text channel on a server — destination for message forward (uses channel [chatId]). */
data class ForwardChannelTarget(
    val chatId: String,
    val channelName: String,
    val serverId: String,
    val serverName: String,
    val serverIconUrl: String? = null,
    val categoryName: String,
    val categoryOrder: Int,
    val channelOrder: Int,
)

/** Flat list row for the forward picker (channels + DMs). */
sealed class ForwardListItem {
    abstract val chatId: String
    abstract val title: String
    abstract val subtitle: String?
    abstract val searchText: String

    data class DirectMessage(
        override val chatId: String,
        override val title: String,
        override val subtitle: String?,
        val avatarUrl: String?,
        val avatarColor: String?,
        val isGroup: Boolean,
        val isSavedMessages: Boolean = false,
    ) : ForwardListItem() {
        override val searchText: String
            get() = "$title $subtitle".trim()
    }

    data class ServerChannel(
        override val chatId: String,
        val channelName: String,
        val serverId: String,
        val serverName: String,
        val serverIconUrl: String?,
    ) : ForwardListItem() {
        override val title: String
            get() = channelName
        override val subtitle: String
            get() = serverName
        override val searchText: String
            get() = "$channelName $serverName".trim()
    }
}

data class ForwardServerChannelGroup(
    val serverId: String,
    val serverName: String,
    val categories: List<ForwardCategoryChannelGroup>,
)

data class ForwardCategoryChannelGroup(
    val categoryName: String,
    val channels: List<ForwardChannelTarget>,
)

fun List<ForwardChannelTarget>.toServerChannelGroups(): List<ForwardServerChannelGroup> {
    return this
        .groupBy { it.serverId.trim().lowercase() }
        .map { (_, channels) ->
            val sorted = channels.sortedWith(
                compareBy(
                    { it.categoryOrder },
                    { it.channelOrder },
                    { it.channelName.lowercase() },
                ),
            )
            ForwardServerChannelGroup(
                serverId = sorted.first().serverId,
                serverName = sorted.first().serverName,
                categories =
                    sorted
                        .groupBy { it.categoryName to it.categoryOrder }
                        .toList()
                        .sortedBy { (_, groupChannels) -> groupChannels.first().categoryOrder }
                        .map { (key, groupChannels) ->
                            ForwardCategoryChannelGroup(
                                categoryName = key.first,
                                channels = groupChannels,
                            )
                        },
            )
        }
        .sortedBy { it.serverName.lowercase() }
}
