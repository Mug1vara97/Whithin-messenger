package com.whithin.voice.data.model

private fun comparePinnedChats(a: ChatInfo, b: ChatInfo): Int {
    val orderA = a.pinOrderValue ?: Int.MAX_VALUE
    val orderB = b.pinOrderValue ?: Int.MAX_VALUE
    if (orderA != orderB) return orderA.compareTo(orderB)

    val pinnedAtA =
        runCatching {
            a.pinnedAtValue?.let { java.time.Instant.parse(it).toEpochMilli() }
        }.getOrNull() ?: 0L
    val pinnedAtB =
        runCatching {
            b.pinnedAtValue?.let { java.time.Instant.parse(it).toEpochMilli() }
        }.getOrNull() ?: 0L
    return pinnedAtA.compareTo(pinnedAtB)
}

/** Saved → pinned (by pin order) → unpinned (by last message time). */
fun sortChatList(chats: List<ChatInfo>): List<ChatInfo> {
    if (chats.isEmpty()) return chats

    val saved = chats.filter { it.isSavedMessagesValue }
    val pinned =
        chats
            .filter { !it.isSavedMessagesValue && it.isPinnedValue }
            .sortedWith(::comparePinnedChats)
    val unpinned =
        chats
            .filter { !it.isSavedMessagesValue && !it.isPinnedValue }
            .sortedByDescending { it.lastMessageTimeValue.ifEmpty { "0" } }

    return saved + pinned + unpinned
}

data class ChatListSections(
    val saved: List<ChatInfo>,
    val pinned: List<ChatInfo>,
    val unpinned: List<ChatInfo>,
) {
    val all: List<ChatInfo> = saved + pinned + unpinned
}

fun splitChatListSections(chats: List<ChatInfo>): ChatListSections {
    val sorted = sortChatList(chats)
    return ChatListSections(
        saved = sorted.filter { it.isSavedMessagesValue },
        pinned = sorted.filter { !it.isSavedMessagesValue && it.isPinnedValue },
        unpinned = sorted.filter { !it.isSavedMessagesValue && !it.isPinnedValue },
    )
}
