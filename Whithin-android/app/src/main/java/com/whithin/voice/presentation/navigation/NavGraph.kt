package com.whithin.voice.presentation.navigation

import android.net.Uri
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import com.whithin.voice.presentation.ui.screens.ChatScreen
import com.whithin.voice.presentation.ui.screens.ForgotPasswordScreen
import com.whithin.voice.presentation.ui.screens.IdeasBoardScreen
import com.whithin.voice.presentation.ui.screens.FeedScreen
import com.whithin.voice.presentation.ui.screens.FriendsScreen
import com.whithin.voice.presentation.ui.screens.ConfirmAuthActionScreen
import com.whithin.voice.presentation.ui.screens.LoginScreen
import com.whithin.voice.presentation.ui.screens.ProfileScreen
import com.whithin.voice.presentation.ui.screens.settings.SettingsScreen
import com.whithin.voice.presentation.ui.screens.ServerSettingsScreen
import com.whithin.voice.presentation.ui.screens.RegisterScreen
import com.whithin.voice.presentation.ui.screens.ShareContentScreen
import com.whithin.voice.presentation.share.SharePayload
import com.whithin.voice.presentation.ui.screens.VoiceRoomScreen
import com.whithin.voice.presentation.ui.components.SwipeBackContainer
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.presentation.viewmodel.VoiceRoomViewModel
import com.whithin.voice.util.visibleName
import android.util.Log

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object ForgotPassword : Screen("forgotPassword?email={email}") {
        fun createRoute(email: String = "") = "forgotPassword?email=${Uri.encode(email)}"
    }
    object Register : Screen("register")
    object ConfirmAuth : Screen("confirmAuth")
    object ChatList : Screen("chatList")
    object Friends : Screen("friends?tab={tab}") {
        fun createRoute(tab: Int = 0) = "friends?tab=$tab"
    }
    object Feed : Screen("feed")
    object Profile : Screen("profile")
    object ProfileSettings : Screen("profileSettings")
    object ServerSettings : Screen("serverSettings/{serverId}") {
        fun createRoute(serverId: String) = "serverSettings/${Uri.encode(serverId)}"
    }
    object Chat : Screen("chat/{chatId}/{chatName}?enableVoiceCall={enableVoiceCall}") {
        fun createRoute(
            chatId: String,
            chatName: String = "Chat",
            enableVoiceCall: Boolean = true,
        ): String {
            val safeChatId = Uri.encode(chatId.ifBlank { "unknown-chat" })
            val safeChatName =
                Uri.encode(
                    chatName.ifBlank { "Chat" }.replace("/", "_"),
                )
            return "chat/$safeChatId/$safeChatName?enableVoiceCall=$enableVoiceCall"
        }
    }
    object IdeasBoard : Screen("ideasBoard/{serverId}/{chatId}/{chatName}") {
        fun createRoute(serverId: String, chatId: String, chatName: String): String {
            val safeServerId = Uri.encode(serverId.ifBlank { "unknown-server" })
            val safeChatId = Uri.encode(chatId.ifBlank { "unknown-chat" })
            val safeChatName = Uri.encode(chatName.ifBlank { "Доска" }.replace("/", "_"))
            return "ideasBoard/$safeServerId/$safeChatId/$safeChatName"
        }
    }
    object ServerNews : Screen("serverNews/{serverId}/{channelName}") {
        fun createRoute(serverId: String, channelName: String = "Новости"): String {
            val safeServerId = Uri.encode(serverId.ifBlank { "unknown-server" })
            val safeChannelName = Uri.encode(channelName.ifBlank { "Новости" }.replace("/", "_"))
            return "serverNews/$safeServerId/$safeChannelName"
        }
    }
    object ShareContent : Screen("shareContent")
    object VoiceRoom : Screen("voiceRoom/{roomId}/{roomName}/{userId}/{userName}?returnTo={returnTo}") {
        fun createRoute(
            roomId: String,
            roomName: String,
            userId: String,
            userName: String,
            returnTo: String = Screen.ChatList.route
        ): String {
            val safeRoomId = Uri.encode(roomId.ifBlank { "unknown-room" })
            val safeRoomName = Uri.encode(roomName.ifBlank { "Voice Call" })
            val safeUserId = Uri.encode(userId.ifBlank { "unknown-user" })
            val safeUserName = Uri.encode(userName.ifBlank { "User" })
            return "voiceRoom/$safeRoomId/$safeRoomName/$safeUserId/$safeUserName?returnTo=${Uri.encode(returnTo)}"
        }
    }
}

@Composable
fun AppNavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    startDestination: String = Screen.Login.route,
    authViewModel: AuthViewModel,
    voiceRoomViewModel: VoiceRoomViewModel,
    onScanQrClick: () -> Unit = {},
    onDeepLinkBack: () -> Unit = {},
    onChatOpened: (chatId: String, chatName: String) -> Unit = { _, _ -> },
    onChatClosed: () -> Unit = {},
    pendingShareContent: SharePayload? = null,
    onShareContentHandled: () -> Unit = {},
    pendingConfirmLink: ConfirmLinkData? = null,
    onConfirmLinkHandled: () -> Unit = {},
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route.orEmpty()
    val isChatListBaseRoute = currentRoute == Screen.ChatList.route

    Box(modifier = modifier.fillMaxSize()) {
        MessengerPersistentChatList(
            navController = navController,
            authViewModel = authViewModel,
            currentRoute = currentRoute,
        )

        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier =
                if (isChatListBaseRoute) {
                    Modifier.size(0.dp)
                } else {
                    Modifier.fillMaxSize()
                },
        ) {
        composable(Screen.Login.route) {
            LoginScreen(
                viewModel = authViewModel,
                onLoginSuccess = {
                    navController.navigate(Screen.ChatList.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                },
                onNavigateToForgotPassword = { email ->
                    navController.navigate(Screen.ForgotPassword.createRoute(email))
                },
            )
        }

        composable(
            route = Screen.ForgotPassword.route,
            arguments = listOf(navArgument("email") { type = NavType.StringType; defaultValue = "" }),
        ) { backStackEntry ->
            SwipeBackContainer(onBack = { navController.popBackStack() }) {
                ForgotPasswordScreen(
                    initialEmail = backStackEntry.arguments?.getString("email").orEmpty(),
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = authViewModel,
                )
            }
        }
        
        composable(Screen.Register.route) {
            RegisterScreen(
                viewModel = authViewModel,
                onNavigateToLogin = {
                    navController.popBackStack()
                },
            )
        }

        composable(Screen.ConfirmAuth.route) {
            val confirmLink = pendingConfirmLink
            if (confirmLink != null) {
                ConfirmAuthActionScreen(
                    confirmLink = confirmLink,
                    viewModel = authViewModel,
                    onNavigateToLogin = {
                        onConfirmLinkHandled()
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.ConfirmAuth.route) { inclusive = true }
                        }
                    },
                )
            }
        }
        
        composable(
            route = Screen.ChatList.route,
        ) {
            MessengerNavHostPassThrough()
        }

        composable(
            route = Screen.IdeasBoard.route,
            arguments = listOf(
                navArgument("serverId") { type = NavType.StringType },
                navArgument("chatId") { type = NavType.StringType },
                navArgument("chatName") {
                    type = NavType.StringType
                    defaultValue = "Доска"
                },
            ),
        ) { backStackEntry ->
            val serverId = backStackEntry.arguments?.getString("serverId")?.let { Uri.decode(it) }.orEmpty()
            val chatId = backStackEntry.arguments?.getString("chatId")?.let { Uri.decode(it) }.orEmpty()
            val chatName = backStackEntry.arguments?.getString("chatName")
                ?.let { Uri.decode(it) }
                ?.replace("_", "/")
                ?: "Доска"
            val userId = authViewModel.uiState.value.user?.id.orEmpty()
            SwipeBackContainer(
                onBack = { navController.popBackStack() },
            ) {
                IdeasBoardScreen(
                    serverId = serverId,
                    chatId = chatId,
                    channelName = chatName,
                    userId = userId,
                    onBack = { navController.popBackStack() },
                )
            }
        }

        composable(
            route = Screen.ServerNews.route,
            arguments = listOf(
                navArgument("serverId") { type = NavType.StringType },
                navArgument("channelName") {
                    type = NavType.StringType
                    defaultValue = "Новости"
                },
            ),
        ) {
            SwipeBackContainer(
                onBack = { navController.popBackStack() },
            ) {
                FeedScreen(onBack = { navController.popBackStack() })
            }
        }

        composable(
            route = Screen.Friends.route,
            arguments = listOf(
                navArgument("tab") {
                    type = NavType.IntType
                    defaultValue = 0
                }
            )
        ) { backStackEntry ->
            val initialTab = backStackEntry.arguments?.getInt("tab") ?: 0
            SwipeBackContainer(
                onBack = { navController.popBackStack() },
            ) {
                FriendsScreen(
                    onBack = { navController.popBackStack() },
                    authViewModel = authViewModel,
                    initialTab = initialTab,
                )
            }
        }

        composable(Screen.Feed.route) {
            SwipeBackContainer(
                onBack = { navController.popBackStack() },
            ) {
                FeedScreen(onBack = { navController.popBackStack() })
            }
        }

        composable(Screen.Profile.route) {
            SwipeBackContainer(
                onBack = { navController.popBackStack() },
            ) {
                ProfileScreen(
                    authViewModel = authViewModel,
                    onBack = { navController.popBackStack() },
                    onOpenSettings = { navController.navigate(Screen.ProfileSettings.route) },
                )
            }
        }

        composable(Screen.ProfileSettings.route) {
            SwipeBackContainer(
                onBack = { navController.popBackStack() },
            ) {
                SettingsScreen(
                    authViewModel = authViewModel,
                    onBack = { navController.popBackStack() },
                    onScanQrClick = onScanQrClick,
                )
            }
        }

        composable(
            route = Screen.ServerSettings.route,
            arguments = listOf(
                navArgument("serverId") { type = NavType.StringType },
            ),
        ) {
            SwipeBackContainer(onBack = { navController.popBackStack() }) {
                ServerSettingsScreen(
                    authViewModel = authViewModel,
                    onBack = { navController.popBackStack() },
                )
            }
        }
        
        composable(
            route = Screen.Chat.route,
            arguments = listOf(
                navArgument("chatId") { type = NavType.StringType },
                navArgument("chatName") { 
                    type = NavType.StringType
                    defaultValue = "Chat"
                },
                navArgument("enableVoiceCall") {
                    type = NavType.BoolType
                    defaultValue = true
                },
            ),
            enterTransition = { EnterTransition.None },
            exitTransition = { ExitTransition.None },
            popEnterTransition = { EnterTransition.None },
            popExitTransition = { ExitTransition.None },
        ) { backStackEntry ->
            val chatId =
                backStackEntry.arguments?.getString("chatId")
                    ?.let { Uri.decode(it) }
                    .orEmpty()
            val chatName =
                backStackEntry.arguments?.getString("chatName")
                    ?.let { Uri.decode(it) }
                    ?.replace("_", "/")
                    ?.ifBlank { "Chat" }
                    ?: "Chat"
            val enableVoiceCall = backStackEntry.arguments?.getBoolean("enableVoiceCall") ?: true
            val chatViewModel: com.whithin.voice.presentation.viewmodel.ChatViewModel = hiltViewModel()
            androidx.compose.runtime.LaunchedEffect(chatId, chatName) {
                if (chatId.isNotBlank()) {
                    onChatOpened(chatId, chatName)
                }
            }

            val onChatBack = {
                onChatClosed()
                onDeepLinkBack()
                navigateBackToChatList(navController)
            }

            ChatScreen(
                chatId = chatId,
                chatName = chatName,
                enableVoiceCall = enableVoiceCall,
                onBack = onChatBack,
                onCallClick = { callChatId, callChatName, userId ->
                    val userName = authViewModel.uiState.value.user?.visibleName().orEmpty()
                    voiceRoomViewModel.expandCall()
                    navController.navigate(
                        Screen.VoiceRoom.createRoute(
                            roomId = callChatId,
                            roomName = callChatName,
                            userId = userId,
                            userName = userName,
                            returnTo = Screen.Chat.createRoute(callChatId, callChatName)
                        )
                    ) {
                        launchSingleTop = true
                    }
                },
                onExpandVoiceCall = {
                    val userName = authViewModel.uiState.value.user?.visibleName().orEmpty()
                    val userId = authViewModel.uiState.value.user?.id.orEmpty()
                    voiceRoomViewModel.expandCall()
                    navController.navigate(
                        Screen.VoiceRoom.createRoute(
                            roomId = chatId,
                            roomName = chatName,
                            userId = userId,
                            userName = userName,
                            returnTo = Screen.Chat.createRoute(chatId, chatName),
                        ),
                    ) {
                        launchSingleTop = true
                    }
                },
                chatViewModel = chatViewModel,
                voiceRoomViewModel = voiceRoomViewModel,
            )
        }

        composable(Screen.ShareContent.route) {
            val userId = authViewModel.uiState.value.user?.id.orEmpty()
            val username = authViewModel.uiState.value.user?.visibleName().orEmpty()
            SwipeBackContainer(
                onBack = {
                    onShareContentHandled()
                    if (!navController.popBackStack()) {
                        navController.navigate(Screen.ChatList.route) {
                            popUpTo(Screen.ShareContent.route) { inclusive = true }
                            launchSingleTop = true
                        }
                    }
                },
            ) {
                ShareContentScreen(
                    sharePayload = pendingShareContent,
                    userId = userId,
                    username = username,
                    onBack = {
                        onShareContentHandled()
                        if (!navController.popBackStack()) {
                            navController.navigate(Screen.ChatList.route) {
                                popUpTo(Screen.ShareContent.route) { inclusive = true }
                                launchSingleTop = true
                            }
                        }
                    },
                    onSent = { chatId, chatName ->
                        onShareContentHandled()
                        navController.navigate(Screen.Chat.createRoute(chatId, chatName)) {
                            popUpTo(Screen.ChatList.route) { inclusive = false }
                            launchSingleTop = true
                        }
                    },
                )
            }
        }
        
        composable(
            route = Screen.VoiceRoom.route,
            arguments = listOf(
                navArgument("roomId") { type = NavType.StringType },
                navArgument("roomName") { type = NavType.StringType },
                navArgument("userId") { type = NavType.StringType },
                navArgument("userName") { type = NavType.StringType },
                navArgument("returnTo") {
                    type = NavType.StringType
                    defaultValue = Screen.ChatList.route
                }
            )
        ) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId")
                ?.let { Uri.decode(it) }
                ?.ifBlank { "" }
                ?: ""
            val roomName = backStackEntry.arguments?.getString("roomName")
                ?.let { Uri.decode(it) }
                ?.replace("_", "/")
                ?.ifBlank { "Voice Call" }
                ?: "Voice Call"
            val userId = backStackEntry.arguments?.getString("userId")
                ?.let { Uri.decode(it) }
                ?.ifBlank { "" }
                ?: ""
            val userName = backStackEntry.arguments?.getString("userName")
                ?.let { Uri.decode(it) }
                ?.substringBefore("?")
                ?.replace("_", "/")
                ?.ifBlank { "" }
                ?: ""
            val returnTo = backStackEntry.arguments?.getString("returnTo")
                ?.let { Uri.decode(it) }
                .orEmpty()

            val onVoiceRoomMinimize = {
                minimizeFromVoiceRoom(
                    navController = navController,
                    returnTo = returnTo,
                )
            }

            val onVoiceRoomLeave = {
                onDeepLinkBack()
                navigateAwayFromVoiceRoom(
                    navController = navController,
                    returnTo = returnTo,
                    currentRoute = backStackEntry.destination.route ?: Screen.VoiceRoom.route,
                )
            }

            SwipeBackContainer(
                onBack = { voiceRoomViewModel.minimizeCall() },
            ) {
                VoiceRoomScreen(
                    roomId = roomId,
                    roomName = roomName,
                    userId = userId,
                    userName = userName,
                    authViewModel = authViewModel,
                    returnTo = returnTo,
                    viewModel = voiceRoomViewModel,
                    onMinimizeClick = onVoiceRoomMinimize,
                    onLeaveClick = onVoiceRoomLeave,
                )
            }
        }
        }
    }
}

private fun navigateBackToChatList(navController: NavHostController) {
    val chatListRoute = Screen.ChatList.route
    if (navController.currentBackStackEntry?.destination?.route == chatListRoute) return
    if (navController.popBackStack(chatListRoute, inclusive = false)) return

    val currentDestinationId = navController.currentBackStackEntry?.destination?.id ?: return
    navController.navigate(chatListRoute) {
        popUpTo(currentDestinationId) { inclusive = true }
        launchSingleTop = true
    }
}

private fun isChatReturnRoute(returnTo: String): Boolean =
    returnTo.startsWith("chat/")

private fun minimizeFromVoiceRoom(
    navController: NavHostController,
    returnTo: String,
) {
    try {
        when {
            isChatReturnRoute(returnTo) -> {
                if (!navController.popBackStack()) {
                    navigateBackToChatList(navController)
                }
                val current = navController.currentBackStackEntry?.destination?.route.orEmpty()
                if (current == Screen.ChatList.route) {
                    navController.navigate(returnTo) {
                        popUpTo(Screen.ChatList.route) { inclusive = false }
                        launchSingleTop = true
                    }
                }
            }
            returnTo == Screen.ChatList.route || returnTo.isBlank() -> {
                navigateBackToChatList(navController)
            }
            else -> {
                if (!navController.popBackStack()) {
                    navController.navigate(returnTo) {
                        launchSingleTop = true
                    }
                }
            }
        }
    } catch (e: Exception) {
        Log.e("MessengerNav", "minimizeFromVoiceRoom failed returnTo=$returnTo", e)
        runCatching { navigateBackToChatList(navController) }
    }
}

private fun navigateAwayFromVoiceRoom(
    navController: NavHostController,
    returnTo: String,
    currentRoute: String,
) {
    val chatListRoute = Screen.ChatList.route

    if (navController.popBackStack()) {
        val current = navController.currentBackStackEntry?.destination?.route.orEmpty()
        if (isChatReturnRoute(returnTo) && current == chatListRoute) {
            navController.navigate(returnTo) {
                popUpTo(chatListRoute) { inclusive = false }
                launchSingleTop = true
            }
        }
        return
    }

    when {
        isChatReturnRoute(returnTo) -> {
            navController.navigate(chatListRoute) {
                launchSingleTop = true
            }
            navController.navigate(returnTo) {
                popUpTo(chatListRoute) { inclusive = false }
                launchSingleTop = true
            }
        }
        returnTo.isNotBlank() -> {
            navController.navigate(returnTo) {
                popUpTo(currentRoute) { inclusive = true }
                launchSingleTop = true
            }
        }
        else -> {
            navigateBackToChatList(navController)
        }
    }
}
