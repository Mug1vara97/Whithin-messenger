package com.whithin.voice.presentation.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.*
import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.whithin.voice.domain.model.Participant
import com.whithin.voice.presentation.service.AudioOutputDevice
import com.whithin.voice.presentation.service.AudioOutputType
import com.whithin.voice.presentation.service.LiveKitService
import com.whithin.voice.presentation.ui.components.AudioOutputPickerSheet
import com.whithin.voice.presentation.ui.components.AudioOutputRouteButton
import com.whithin.voice.presentation.ui.components.ControlsBar
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.app.Activity
import android.content.Context
import android.media.projection.MediaProjectionManager
import androidx.compose.ui.platform.LocalContext
import com.whithin.voice.presentation.ui.components.ScreenShareFullscreenOverlay
import com.whithin.voice.presentation.ui.components.VoiceCallParticipantsGrid
import com.whithin.voice.presentation.ui.components.VoiceGridItem
import com.whithin.voice.presentation.ui.model.FullscreenScreenShareState
import com.whithin.voice.presentation.ui.utils.VoiceCallTrackResolver
import com.whithin.voice.presentation.ui.utils.collectAsUiState
import com.whithin.voice.presentation.ui.theme.DiscordBackground
import com.whithin.voice.presentation.ui.theme.DiscordDarker
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import com.whithin.voice.util.visibleName
import com.whithin.voice.presentation.viewmodel.VoiceRoomViewModel
import io.livekit.android.room.Room

@Composable
fun VoiceRoomScreen(
    roomId: String,
    roomName: String,
    userId: String,
    userName: String,
    authViewModel: AuthViewModel,
    onLeaveClick: () -> Unit,
    onMinimizeClick: () -> Unit,
    returnTo: String = "",
    viewModel: VoiceRoomViewModel,
) {
    val uiState by viewModel.uiState.collectAsUiState()
    val authState by authViewModel.uiState.collectAsUiState()
    var didRequestExit by remember { mutableStateOf(false) }
    var joinStarted by remember { mutableStateOf(false) }
    var hadActiveVoiceSession by remember { mutableStateOf(false) }
    val resolvedUserName = authState.user?.visibleName()
        ?.takeIf { it.isNotBlank() }
        ?: userName.substringBefore("?").takeIf { it.isNotBlank() }
        ?: ""
    val resolvedAvatar = authState.user?.avatarUrl
    val resolvedAvatarColor = authState.user?.avatarColor
    val resolvedBanner = authState.user?.bannerUrl
    var showAudioOutputPicker by remember { mutableStateOf(false) }
    var fullscreenScreenShare by remember { mutableStateOf<FullscreenScreenShareState?>(null) }
    var minimizeNavigationSent by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val screenShareLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult(),
        ) { result ->
            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                viewModel.enableScreenShare(result.data!!)
            }
        }
    val selectedAudioOutput =
        remember(uiState.audioOutputDevices, uiState.selectedAudioOutputId) {
            uiState.audioOutputDevices.firstOrNull { it.id == uiState.selectedAudioOutputId }
                ?: audioOutputFallback(uiState.selectedAudioOutputId)
        }
    
    // Auto-join room when screen opens
    LaunchedEffect(roomId, roomName, resolvedUserName, userId, returnTo, resolvedAvatar, resolvedAvatarColor, resolvedBanner) {
        if (roomId.isNotEmpty() && roomName.isNotEmpty() && userId.isNotEmpty()) {
            joinStarted = true
            // Use roomId for connection, but roomName for display
            viewModel.joinRoom(
                roomId = roomId,
                userName = resolvedUserName,
                userId = userId,
                displayName = roomName,
                avatar = resolvedAvatar,
                avatarColor = resolvedAvatarColor,
                banner = resolvedBanner,
                returnTo = returnTo,
            )
        }
    }

    LaunchedEffect(uiState.isJoining, uiState.isConnected, uiState.sessionRoomId) {
        if (uiState.isJoining || uiState.isConnected || uiState.sessionRoomId.isNotBlank()) {
            hadActiveVoiceSession = true
        }
    }

    LaunchedEffect(uiState.isMinimized) {
        if (!uiState.isMinimized) {
            minimizeNavigationSent = false
            return@LaunchedEffect
        }
        if (minimizeNavigationSent) return@LaunchedEffect
        minimizeNavigationSent = true
        kotlinx.coroutines.yield()
        onMinimizeClick()
    }

    val requestMinimize: () -> Unit = {
        fullscreenScreenShare = null
        if (!uiState.isMinimized) {
            viewModel.minimizeCall()
        }
    }

    // Remote disconnect / forced leave: exit only after we had an active join/connection,
    // not on the initial frame before joinRoom() updates VM state.
    LaunchedEffect(
        uiState.isConnected,
        uiState.isJoining,
        uiState.sessionRoomId,
        joinStarted,
        hadActiveVoiceSession,
    ) {
        if (!joinStarted) return@LaunchedEffect
        if (didRequestExit) return@LaunchedEffect
        if (!hadActiveVoiceSession) return@LaunchedEffect
        if (uiState.isJoining || uiState.isConnected || uiState.sessionRoomId.isNotBlank()) {
            return@LaunchedEffect
        }
        didRequestExit = true
        onLeaveClick()
    }

    BackHandler(enabled = uiState.isConnected && fullscreenScreenShare == null) {
        requestMinimize()
    }
    
    // Observe room changes reactively - update when connection state or participants change
    var room by remember { mutableStateOf<Room?>(viewModel.getRoom()) }
    
    // Update room when connection state changes
    LaunchedEffect(uiState.isConnected) {
        room = viewModel.getRoom()
    }
    
    // Also update room when participants list changes to ensure we have latest participant data
    LaunchedEffect(uiState.participants.size) {
        room = viewModel.getRoom()
    }
    
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(DiscordBackground),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
        ) {
            // AppBar
            @OptIn(ExperimentalMaterial3Api::class)
            TopAppBar(
                title = { Text(uiState.roomName.ifEmpty { roomName }) },
                navigationIcon = {
                    IconButton(
                        onClick = requestMinimize,
                        enabled = uiState.isConnected || uiState.isJoining,
                    ) {
                        Icon(
                            imageVector = Icons.Default.KeyboardArrowDown,
                            contentDescription = "Свернуть звонок",
                            tint = Color.White,
                        )
                    }
                },
                actions = {
                    AudioOutputRouteButton(
                        selectedDevice = selectedAudioOutput,
                        onClick = {
                            viewModel.refreshAudioOutputDevices()
                            showAudioOutputPicker = true
                        },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                },
                colors =
                    TopAppBarDefaults.topAppBarColors(
                        containerColor = DiscordDarker,
                    ),
            )

            val gridItems =
                remember(
                    room,
                    uiState.participants,
                    uiState.isVideoEnabled,
                    uiState.isScreenSharing,
                    uiState.gridRefreshTick,
                    uiState.isMuted,
                    uiState.localIsSpeaking,
                    authState,
                ) {
                    buildList {
                        room?.localParticipant?.let { localParticipant ->
                            val identity = localParticipant.identity?.value ?: "local"
                            val localDecoration =
                                uiState.localAvatarDecoration
                                    ?: authState.user?.avatarDecoration
                            val localName =
                                uiState.userName.ifEmpty { localParticipant.name ?: "You" }
                            add(
                                VoiceGridItem.ParticipantTile(
                                    tileId = "participant-$identity",
                                    participant =
                                        Participant(
                                            identity = identity,
                                            name = localName,
                                            isMuted = uiState.isMuted,
                                            isSpeaking = uiState.localIsSpeaking,
                                            hasVideo = uiState.isVideoEnabled,
                                            hasAudio = true,
                                            isGlobalAudioMuted = !uiState.isAudioEnabled,
                                            avatarUrl = uiState.localAvatarUrl ?: authState.user?.avatarUrl,
                                            avatarColor =
                                                uiState.localAvatarColor.ifBlank {
                                                    authState.user?.avatarColor ?: "#5865f2"
                                                },
                                            bannerUrl = uiState.localBannerUrl ?: authState.user?.bannerUrl,
                                            nameplate = uiState.localNameplate ?: authState.user?.nameplate,
                                            avatarDecoration = localDecoration,
                                        ),
                                    room = room,
                                    videoTrack = VoiceCallTrackResolver.cameraTrack(localParticipant),
                                    showVolumeControl = false,
                                ),
                            )
                            VoiceCallTrackResolver.screenShareTrack(localParticipant)?.let { screenTrack ->
                                add(
                                    VoiceGridItem.ScreenShareTile(
                                        tileId = "screen-share-local-$identity",
                                        ownerIdentity = identity,
                                        ownerName = localName,
                                        room = room,
                                        screenTrack = screenTrack,
                                        cameraTrack =
                                            if (uiState.isVideoEnabled) {
                                                VoiceCallTrackResolver.cameraTrack(localParticipant)
                                            } else {
                                                null
                                            },
                                        mirrorCamera = true,
                                    ),
                                )
                            }
                        }
                        uiState.participants.forEach { participant ->
                            val remoteParticipant =
                                room?.remoteParticipants?.values?.find {
                                    it.identity?.value == participant.identity
                                }
                            add(
                                VoiceGridItem.ParticipantTile(
                                    tileId = "participant-${participant.identity}",
                                    participant = participant,
                                    room = room,
                                    videoTrack =
                                        remoteParticipant?.let {
                                            VoiceCallTrackResolver.cameraTrack(it)
                                        },
                                    showVolumeControl = true,
                                ),
                            )
                            remoteParticipant?.let { remote ->
                                VoiceCallTrackResolver.screenShareTrack(remote)?.let { screenTrack ->
                                    val ownerHasCamera =
                                        participant.hasVideo &&
                                            VoiceCallTrackResolver.cameraTrack(remote) != null
                                    add(
                                        VoiceGridItem.ScreenShareTile(
                                            tileId = "screen-share-remote-${participant.identity}",
                                            ownerIdentity = participant.identity,
                                            ownerName = participant.name,
                                            room = room,
                                            screenTrack = screenTrack,
                                            cameraTrack =
                                                if (ownerHasCamera) {
                                                    VoiceCallTrackResolver.cameraTrack(remote)
                                                } else {
                                                    null
                                                },
                                            mirrorCamera = false,
                                        ),
                                    )
                                }
                            }
                        }
                    }
                }

            if (!uiState.isMinimized && !didRequestExit && uiState.isConnected) {
                VoiceCallParticipantsGrid(
                    items = gridItems,
                    onScreenShareFullscreenRequest = { fullscreenScreenShare = it },
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                )
            } else {
                Spacer(modifier = Modifier.weight(1f))
            }
        }

        if (fullscreenScreenShare == null) {
            ControlsBar(
                modifier = Modifier.align(Alignment.BottomCenter),
                isMuted = uiState.isMuted,
                isVideoEnabled = uiState.isVideoEnabled,
                isScreenSharing = uiState.isScreenSharing,
                isAudioEnabled = uiState.isAudioEnabled,
                onMuteClick = { viewModel.toggleMute() },
                onVideoClick = { viewModel.toggleVideo() },
                onScreenShareClick = {
                    if (uiState.isScreenSharing) {
                        viewModel.disableScreenShare()
                    } else {
                        val projectionManager =
                            context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                        screenShareLauncher.launch(projectionManager.createScreenCaptureIntent())
                    }
                },
                onAudioClick = { viewModel.toggleAudio() },
                onLeaveClick = {
                    fullscreenScreenShare = null
                    didRequestExit = true
                    viewModel.leaveRoom()
                    onLeaveClick()
                },
            )
        }

        fullscreenScreenShare?.let { fullscreen ->
            ScreenShareFullscreenOverlay(
                state = fullscreen,
                isMuted = uiState.isMuted,
                isVideoEnabled = uiState.isVideoEnabled,
                isScreenSharing = uiState.isScreenSharing,
                isAudioEnabled = uiState.isAudioEnabled,
                onMuteClick = { viewModel.toggleMute() },
                onVideoClick = { viewModel.toggleVideo() },
                onScreenShareClick = {
                    if (uiState.isScreenSharing) {
                        viewModel.disableScreenShare()
                    } else {
                        val projectionManager =
                            context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                        screenShareLauncher.launch(projectionManager.createScreenCaptureIntent())
                    }
                },
                onAudioClick = { viewModel.toggleAudio() },
                onLeaveClick = {
                    fullscreenScreenShare = null
                    didRequestExit = true
                    viewModel.leaveRoom()
                    onLeaveClick()
                },
                onDismiss = { fullscreenScreenShare = null },
            )
        }

        if (showAudioOutputPicker) {
            AudioOutputPickerSheet(
                devices = uiState.audioOutputDevices,
                selectedDeviceId = uiState.selectedAudioOutputId,
                noiseSuppression = uiState.isNoiseSuppressed,
                onNoiseSuppressionChange = { viewModel.setNoiseSuppression(it) },
                onDismiss = { showAudioOutputPicker = false },
                onDeviceSelected = { device ->
                    viewModel.selectAudioOutput(device)
                    showAudioOutputPicker = false
                },
            )
        }

        if (uiState.isJoining) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.45f)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Color.White)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Подключение к звонку…",
                        color = Color.White
                    )
                }
            }
        }

        uiState.error?.let { err ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.6f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        err,
                        color = Color.White,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = {
                        viewModel.leaveRoom()
                        onLeaveClick()
                    }) {
                        Text("Назад")
                    }
                }
            }
        }
    }
}

private fun audioOutputFallback(selectedDeviceId: String): AudioOutputDevice {
    val type =
        when {
            selectedDeviceId == LiveKitService.ID_EARPIECE -> AudioOutputType.EARPIECE
            selectedDeviceId == LiveKitService.ID_BLUETOOTH_GENERIC ||
                selectedDeviceId.startsWith("bt-") -> AudioOutputType.BLUETOOTH
            else -> AudioOutputType.SPEAKER
        }
    return AudioOutputDevice(
        id = selectedDeviceId,
        title = "",
        subtitle = null,
        type = type,
    )
}
