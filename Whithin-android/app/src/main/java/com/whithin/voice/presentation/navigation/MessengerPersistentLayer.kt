package com.whithin.voice.presentation.navigation

import android.util.Log
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInteropFilter
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import com.whithin.voice.presentation.ui.screens.ChatListScreen
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.presentation.viewmodel.ChatListViewModel
import com.whithin.voice.presentation.viewmodel.FriendViewModel
import com.whithin.voice.presentation.viewmodel.ServerListViewModel
import com.whithin.voice.presentation.viewmodel.ServerViewModel

/**
 * Список чатов, который остаётся в памяти под оверлеями (чат, профиль и т.д.).
 * При свайпе назад не пересоздаётся — как в Telegram.
 *
 * ViewModel привязаны к Activity, а не к back stack entry ChatList — слой всегда
 * отрисован под NavHost (в т.ч. при cold start из push, когда в стеке только Chat).
 */
@Composable
fun MessengerPersistentChatList(
    navController: NavHostController,
    authViewModel: AuthViewModel,
    currentRoute: String,
) {
    val authState by authViewModel.uiState.collectAsState()
    val showShell =
        authState.isAuthenticated ||
            (authState.isSessionCheckPending && authViewModel.hasCachedSession())
    if (!showShell) return

    val activity = LocalContext.current as ComponentActivity
    val chatListViewModel: ChatListViewModel = hiltViewModel(activity)
    val friendViewModel: FriendViewModel = hiltViewModel(activity)
    val serverListViewModel: ServerListViewModel = hiltViewModel(activity)
    val serverViewModel: ServerViewModel = hiltViewModel(activity)
    val shellState by chatListViewModel.shellState.collectAsState()

    SideEffect {
        chatListViewModel.applyPendingPushShellIfAny()
    }

    LaunchedEffect(shellState.selectedServerId, authState.user?.id) {
        val serverId = shellState.selectedServerId?.trim().orEmpty()
        val userId =
            authState.user?.id?.trim().orEmpty().ifBlank {
                authViewModel.peekCachedUserId().orEmpty()
            }
        if (serverId.isBlank()) return@LaunchedEffect
        serverViewModel.loadServer(serverId, userId)
    }

    ChatListScreen(
        authViewModel = authViewModel,
        interactive = currentRoute == Screen.ChatList.route,
        chatListViewModel = chatListViewModel,
        friendViewModel = friendViewModel,
        serverListViewModel = serverListViewModel,
        serverViewModel = serverViewModel,
        onChatSelected = { chat, enableVoiceCall ->
            val route =
                Screen.Chat.createRoute(
                    chat.chatIdValue,
                    chat.usernameValue,
                    enableVoiceCall,
                )
            try {
                navController.navigate(route) {
                    popUpTo(Screen.ChatList.route) { inclusive = false }
                    launchSingleTop = true
                }
            } catch (e: Exception) {
                Log.e("MessengerNav", "Failed to open chat route=$route", e)
            }
        },
        onNavigateToFriends = {
            navController.navigate(Screen.Friends.createRoute(tab = 0))
        },
        onNavigateToFeed = {
            navController.navigate(Screen.Feed.route)
        },
        onNavigateToProfile = {
            navController.navigate(Screen.Profile.route)
        },
        onNavigateToProfileSettings = {
            navController.navigate(Screen.ProfileSettings.route)
        },
        onVoiceChannelSelected = { serverId, channelId, channelName, userId, userName ->
            val normalizedServerId = serverId.trim().takeIf { it.isNotEmpty() }
            chatListViewModel.updateShellState(normalizedServerId, highlightedChannelId = null)
            navController.navigate(
                Screen.VoiceRoom.createRoute(
                    roomId = channelId,
                    roomName = channelName,
                    userId = userId,
                    userName = userName,
                    returnTo = Screen.ChatList.route,
                ),
            ) {
                popUpTo(Screen.ChatList.route) { inclusive = false }
                launchSingleTop = true
            }
        },
        onIdeasBoardSelected = { serverId, channelId, channelName ->
            navController.navigate(
                Screen.IdeasBoard.createRoute(serverId, channelId, channelName),
            ) {
                popUpTo(Screen.ChatList.route) { inclusive = false }
                launchSingleTop = true
            }
        },
        onNewsSelected = { serverId, _, channelName ->
            navController.navigate(
                Screen.ServerNews.createRoute(serverId, channelName),
            ) {
                popUpTo(Screen.ChatList.route) { inclusive = false }
                launchSingleTop = true
            }
        },
    )
}

/** Прозрачный слой NavHost — пропускает нажатия к [MessengerPersistentChatList] снизу. */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun MessengerNavHostPassThrough(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .pointerInteropFilter { false },
    )
}
