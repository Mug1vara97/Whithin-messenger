package com.whithin.voice.presentation.ui.components

import android.net.Uri
import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordBackground
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

@Composable
fun CreateServerBottomSheet(
    visible: Boolean,
    defaultServerName: String,
    isSubmitting: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onCreate: (serverName: String, isPublic: Boolean, description: String, avatarUri: Uri?) -> Unit,
) {
    if (!visible) return

    var serverName by remember { mutableStateOf(defaultServerName) }
    var description by remember { mutableStateOf("") }
    var isPrivate by remember { mutableStateOf(false) }
    var avatarUri by remember { mutableStateOf<Uri?>(null) }

    LaunchedEffect(defaultServerName) {
        if (serverName.isBlank()) {
            serverName = defaultServerName
        }
    }

    val pickAvatar =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            avatarUri = uri
        }

    ChatBottomSheet(onDismiss = { if (!isSubmitting) onDismiss() }) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 560.dp)
                    .imePadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Создать сервер",
                color = DiscordText,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                scrambleOnce = false,
            )
            Text(
                text = "Название и значок можно изменить позже в настройках.",
                color = DiscordTextSecondary,
                fontSize = 13.sp,
                scrambleOnce = false,
            )

            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier.size(72.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(DiscordAccent)
                                .clickable(enabled = !isSubmitting) {
                                    pickAvatar.launch(
                                        PickVisualMediaRequest(
                                            ActivityResultContracts.PickVisualMedia.ImageOnly,
                                        ),
                                    )
                                },
                        contentAlignment = Alignment.Center,
                    ) {
                        val pickedAvatar = avatarUri
                        if (pickedAvatar != null) {
                            val context = LocalContext.current
                            val px = with(LocalDensity.current) { 72.dp.roundToPx() }
                            val request =
                                remember(pickedAvatar, px) {
                                    sizedImageRequest(context, pickedAvatar, px)
                                }
                            AsyncImage(
                                model = request,
                                contentDescription = "Значок сервера",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                            )
                        } else {
                            Text(
                                text =
                                    serverName.trim().firstOrNull()?.uppercaseChar()?.toString()
                                        ?: "S",
                                color = Color.White,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.BottomEnd)
                                .size(26.dp)
                                .clip(CircleShape)
                                .background(DiscordBackground)
                                .clickable(enabled = !isSubmitting) {
                                    pickAvatar.launch(
                                        PickVisualMediaRequest(
                                            ActivityResultContracts.PickVisualMedia.ImageOnly,
                                        ),
                                    )
                                },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhotoCamera,
                            contentDescription = "Загрузить значок",
                            tint = DiscordText,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }

            Text(
                text = "Нажмите, чтобы загрузить значок",
                color = DiscordTextSecondary,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
                scrambleOnce = false,
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "Название сервера",
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    scrambleOnce = false,
                )
                OutlinedTextField(
                    value = serverName,
                    onValueChange = { if (it.length <= 100) serverName = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    enabled = !isSubmitting,
                    textStyle = TextStyle(fontSize = 15.sp),
                    colors = createServerFieldColors(),
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "Описание (необязательно)",
                    color = DiscordTextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    scrambleOnce = false,
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { if (it.length <= 500) description = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 3,
                    enabled = !isSubmitting,
                    textStyle = TextStyle(fontSize = 15.sp),
                    colors = createServerFieldColors(),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Приватный сервер",
                        color = DiscordText,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        scrambleOnce = false,
                    )
                    Text(
                        text = "Не показывать в обзоре",
                        color = DiscordTextSecondary,
                        fontSize = 12.sp,
                        scrambleOnce = false,
                    )
                }
                Switch(
                    checked = isPrivate,
                    onCheckedChange = { isPrivate = it },
                    enabled = !isSubmitting,
                    colors =
                        SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = DiscordAccent,
                        ),
                )
            }

            if (!error.isNullOrBlank()) {
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                    scrambleOnce = false,
                )
            }

            Button(
                onClick = {
                    val trimmedName = serverName.trim()
                    if (trimmedName.isNotEmpty()) {
                        onCreate(trimmedName, !isPrivate, description.trim(), avatarUri)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSubmitting && serverName.trim().isNotEmpty(),
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = Color.White,
                    )
                } else {
                    Text("Создать", scrambleOnce = false)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun createServerFieldColors() =
    OutlinedTextFieldDefaults.colors(
        focusedTextColor = DiscordText,
        unfocusedTextColor = DiscordText,
        focusedBorderColor = DiscordAccent,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedLabelColor = DiscordAccent,
        unfocusedLabelColor = DiscordTextSecondary,
        cursorColor = DiscordAccent,
        focusedContainerColor = DiscordBackground,
        unfocusedContainerColor = DiscordBackground,
    )
