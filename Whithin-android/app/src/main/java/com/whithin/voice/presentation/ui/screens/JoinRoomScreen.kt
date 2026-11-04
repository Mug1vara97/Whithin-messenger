package com.whithin.voice.presentation.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.whithin.voice.presentation.viewmodel.JoinRoomViewModel
import com.whithin.voice.presentation.viewmodel.VoiceRoomViewModel

@Composable
fun JoinRoomScreen(
    onJoinClick: (String, String) -> Unit,
    joinRoomViewModel: JoinRoomViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    voiceRoomViewModel: VoiceRoomViewModel = hiltViewModel()
) {
    val uiState by joinRoomViewModel.uiState.collectAsState()
    val roomState by voiceRoomViewModel.uiState.collectAsState()
    
    var roomName by remember { mutableStateOf(TextFieldValue()) }
    var userName by remember { mutableStateOf(TextFieldValue()) }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Join Voice Room",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(bottom = 32.dp)
        )
        
        OutlinedTextField(
            value = roomName,
            onValueChange = { 
                roomName = it
                joinRoomViewModel.updateRoomName(it.text)
            },
            label = { Text("Room Name") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            singleLine = true
        )
        
        OutlinedTextField(
            value = userName,
            onValueChange = { 
                userName = it
                joinRoomViewModel.updateUserName(it.text)
            },
            label = { Text("Your Name") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
            singleLine = true
        )
        
        roomState.error?.let { error ->
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }
        
        Button(
            onClick = { 
                onJoinClick(roomName.text, userName.text)
            },
            enabled = uiState.canJoin && !roomState.isJoining,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (roomState.isJoining) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text("Join Room")
            }
        }
    }
}
