package com.whithin.voice.presentation.ui.utils

import android.util.Log
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter

private const val TAG = "ChatListScrollAnchor"

private class ChatListScrollAnchorState {
    var anchorChatId: String? = null
    var anchorScrollOffset: Int = 0
    var lastOrderKey: String = ""
    var lastFirstChatId: String? = null
    var wasListAtTop: Boolean = false
    var isRestoring: Boolean = false
}

/**
 * Keeps the topmost visible chat row pinned when chat order changes (sort by last message).
 */
@Composable
fun RememberChatListScrollAnchor(
    listState: LazyListState,
    chatIds: List<String>,
    enabled: Boolean = true,
    lazyIndexOffset: Int = 0,
) {
    if (!enabled) return

    val chatIdSet = remember(chatIds) { chatIds.toSet() }
    val orderKey = remember(chatIds) { chatIds.joinToString("|") }
    val anchorState = remember { ChatListScrollAnchorState() }

    fun captureAnchorFromLayout() {
        if (anchorState.isRestoring || chatIdSet.isEmpty() || listState.isScrollInProgress) return
        if (listState.layoutInfo.totalItemsCount <= lazyIndexOffset) return
        val layoutInfo = listState.layoutInfo
        val topChatItem =
            layoutInfo.visibleItemsInfo
                .filter { item ->
                    val key = item.key as? String ?: return@filter false
                    key in chatIdSet
                }
                .minByOrNull { it.offset }
                ?: return

        anchorState.anchorChatId = topChatItem.key as String
        val firstVisible = layoutInfo.visibleItemsInfo.firstOrNull()
        anchorState.anchorScrollOffset =
            if (firstVisible?.key == topChatItem.key) {
                listState.firstVisibleItemScrollOffset
            } else {
                (-topChatItem.offset).coerceAtLeast(0)
            }
        anchorState.wasListAtTop =
            listState.firstVisibleItemIndex <= lazyIndexOffset &&
                listState.firstVisibleItemScrollOffset == 0
    }

    SideEffect {
        if (!anchorState.isRestoring) {
            captureAnchorFromLayout()
        }
    }

    LaunchedEffect(listState, chatIdSet, lazyIndexOffset) {
        snapshotFlow { listState.isScrollInProgress }
            .distinctUntilChanged()
            .filter { !it }
            .collect {
                if (!anchorState.isRestoring) {
                    captureAnchorFromLayout()
                }
            }
    }

    LaunchedEffect(orderKey, lazyIndexOffset) {
        val orderChanged =
            anchorState.lastOrderKey.isNotEmpty() && anchorState.lastOrderKey != orderKey
        if (orderChanged) {
            anchorState.isRestoring = true
            val wasViewingTop =
                anchorState.wasListAtTop ||
                    anchorState.anchorChatId == anchorState.lastFirstChatId
            if (wasViewingTop) {
                scrollToFirstChat(listState, lazyIndexOffset)
            } else {
                val anchorChatId = anchorState.anchorChatId
                if (!anchorChatId.isNullOrBlank()) {
                    restoreChatListScroll(
                        listState = listState,
                        chatIds = chatIds,
                        chatIdSet = chatIdSet,
                        anchorChatId = anchorChatId,
                        scrollOffset = anchorState.anchorScrollOffset,
                        lazyIndexOffset = lazyIndexOffset,
                    )
                }
            }
            anchorState.isRestoring = false
        }
        anchorState.lastOrderKey = orderKey
        anchorState.lastFirstChatId = chatIds.firstOrNull()
    }
}

private suspend fun scrollToFirstChat(
    listState: LazyListState,
    lazyIndexOffset: Int,
) {
    repeat(24) {
        withFrameNanos { }
        val total = listState.layoutInfo.totalItemsCount
        if (total <= lazyIndexOffset) return@repeat
        if (safeScrollToItem(listState, lazyIndexOffset.coerceAtMost(total - 1), 0)) {
            return
        }
    }
}

private suspend fun restoreChatListScroll(
    listState: LazyListState,
    chatIds: List<String>,
    chatIdSet: Set<String>,
    anchorChatId: String,
    scrollOffset: Int,
    lazyIndexOffset: Int,
) {
    val chatIndex = chatIds.indexOfFirst { it.equals(anchorChatId, ignoreCase = true) }
    if (chatIndex < 0) return
    val lazyIndex = chatIndex + lazyIndexOffset

    repeat(24) {
        withFrameNanos { }
        val total = listState.layoutInfo.totalItemsCount
        if (total <= lazyIndex) return@repeat

        if (
            !safeScrollToItem(
                listState = listState,
                index = lazyIndex.coerceIn(0, total - 1),
                scrollOffset = scrollOffset.coerceAtLeast(0),
            )
        ) {
            return@repeat
        }

        val topChatItem =
            listState.layoutInfo.visibleItemsInfo
                .filter { item ->
                    val key = item.key as? String ?: return@filter false
                    key in chatIdSet
                }
                .minByOrNull { it.offset }
        if (topChatItem?.key == anchorChatId && topChatItem.offset >= 0) {
            return
        }
    }
}

private suspend fun safeScrollToItem(
    listState: LazyListState,
    index: Int,
    scrollOffset: Int,
): Boolean {
    val total = listState.layoutInfo.totalItemsCount
    if (total <= 0 || index !in 0 until total) return false
    return try {
        listState.scrollToItem(index, scrollOffset)
        true
    } catch (e: IllegalArgumentException) {
        Log.w(TAG, "scrollToItem skipped index=$index total=$total", e)
        false
    } catch (e: IllegalStateException) {
        Log.w(TAG, "scrollToItem skipped — list not ready index=$index", e)
        false
    }
}
