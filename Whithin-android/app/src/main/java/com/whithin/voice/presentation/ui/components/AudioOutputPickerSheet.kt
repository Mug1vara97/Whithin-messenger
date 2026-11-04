package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.PhoneIphone
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.presentation.service.AudioOutputDevice
import com.whithin.voice.presentation.service.AudioOutputType
import com.whithin.voice.presentation.ui.theme.DiscordAccent
import com.whithin.voice.presentation.ui.theme.DiscordDarker
import com.whithin.voice.presentation.ui.theme.DiscordOutline
import com.whithin.voice.presentation.ui.theme.DiscordSurface
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AudioOutputPickerSheet(
    devices: List<AudioOutputDevice>,
    selectedDeviceId: String,
    noiseSuppression: Boolean,
    onNoiseSuppressionChange: (Boolean) -> Unit,
    onDismiss: () -> Unit,
    onDeviceSelected: (AudioOutputDevice) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val phoneDevices = devices.filter { it.type != AudioOutputType.BLUETOOTH }
    val bluetoothDevices = devices.filter { it.type == AudioOutputType.BLUETOOTH }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DiscordDarker,
        dragHandle = null,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(top = 20.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                text = "Выберите устройство вывода звука",
                color = DiscordText,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth(),
                scrambleOnce = false,
            )

            SectionBlock(title = "Микрофон") {
                NoiseSuppressionRow(
                    enabled = noiseSuppression,
                    onEnabledChange = onNoiseSuppressionChange,
                )
            }

            if (phoneDevices.isNotEmpty()) {
                SectionBlock(title = "Этот телефон") {
                    phoneDevices.forEachIndexed { index, device ->
                        AudioOutputDeviceRow(
                            device = device,
                            isSelected = device.id == selectedDeviceId,
                            onClick = { onDeviceSelected(device) },
                        )
                        if (index < phoneDevices.lastIndex) {
                            HorizontalDivider(color = DiscordOutline)
                        }
                    }
                }
            }

            if (bluetoothDevices.isNotEmpty()) {
                SectionBlock(title = "Bluetooth") {
                    bluetoothDevices.forEachIndexed { index, device ->
                        AudioOutputDeviceRow(
                            device = device,
                            isSelected = device.id == selectedDeviceId,
                            onClick = { onDeviceSelected(device) },
                        )
                        if (index < bluetoothDevices.lastIndex) {
                            HorizontalDivider(color = DiscordOutline)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NoiseSuppressionRow(
    enabled: Boolean,
    onEnabledChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onEnabledChange(!enabled) }
                .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Подавление шума (RNNoise)",
                color = DiscordText,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                scrambleOnce = false,
            )
            Text(
                text = "Убирает фоновый шум с вашего микрофона",
                color = DiscordTextSecondary,
                fontSize = 13.sp,
                scrambleOnce = false,
            )
        }
        Switch(
            checked = enabled,
            onCheckedChange = onEnabledChange,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = DiscordText,
                    checkedTrackColor = DiscordAccent,
                    uncheckedThumbColor = DiscordTextSecondary,
                    uncheckedTrackColor = DiscordOutline,
                ),
        )
    }
}

@Composable
private fun SectionBlock(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            color = DiscordTextSecondary,
            fontSize = 13.sp,
            modifier = Modifier.padding(start = 4.dp),
            scrambleOnce = false,
        )
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            color = DiscordSurface,
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                content()
            }
        }
    }
}

@Composable
private fun AudioOutputDeviceRow(
    device: AudioOutputDevice,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = iconForDevice(device),
                contentDescription = null,
                tint = DiscordText,
                modifier = Modifier.size(22.dp),
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = device.title,
                color = DiscordText,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                scrambleOnce = false,
            )
            device.subtitle?.takeIf { it.isNotBlank() }?.let { subtitle ->
                Text(
                    text = subtitle,
                    color = DiscordTextSecondary,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    scrambleOnce = false,
                )
            }
        }

        RadioButton(
            selected = isSelected,
            onClick = onClick,
            colors =
                RadioButtonDefaults.colors(
                    selectedColor = DiscordAccent,
                    unselectedColor = DiscordTextSecondary,
                ),
        )
    }
}

private fun iconForDevice(device: AudioOutputDevice): ImageVector {
    return when (device.type) {
        AudioOutputType.SPEAKER -> Icons.Default.VolumeUp
        AudioOutputType.EARPIECE -> Icons.Default.PhoneIphone
        AudioOutputType.BLUETOOTH -> Icons.Default.Bluetooth
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AudioOutputRouteButton(
    selectedDevice: AudioOutputDevice?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val icon =
        selectedDevice?.let { iconForDevice(it) }
            ?: Icons.Default.VolumeUp

    Surface(
        onClick = onClick,
        modifier = modifier.size(36.dp),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = "Выбор устройства вывода",
                tint = DiscordText,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}
