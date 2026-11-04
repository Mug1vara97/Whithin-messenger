package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.presentation.ui.theme.DiscordText
import com.whithin.voice.presentation.ui.theme.DiscordTextSecondary
import com.whithin.voice.presentation.ui.components.TelegramMessageUi

private const val MIN_OPTIONS = 2
private const val MAX_OPTIONS = 10

@Composable
fun CreatePollSheet(
    visible: Boolean,
    isSubmitting: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (question: String, options: List<String>, allowMultiple: Boolean, isAnonymous: Boolean) -> Unit,
) {
    if (!visible) return

    var question by remember { mutableStateOf("") }
    var options by remember { mutableStateOf(listOf("", "")) }
    var allowMultiple by remember { mutableStateOf(false) }
    var isAnonymous by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    fun resetForm() {
        question = ""
        options = listOf("", "")
        allowMultiple = false
        isAnonymous = true
        error = null
    }

    ChatBottomSheet(
        onDismiss = {
            if (!isSubmitting) {
                resetForm()
                onDismiss()
            }
        },
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Создать опрос",
                    color = DiscordText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = {
                        if (!isSubmitting) {
                            resetForm()
                            onDismiss()
                        }
                    },
                    enabled = !isSubmitting,
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = DiscordTextSecondary)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(text = "Вопрос", color = DiscordTextSecondary, fontSize = 13.sp)
            TextField(
                value = question,
                onValueChange = { question = it },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSubmitting,
                placeholder = { Text("Задайте вопрос", color = DiscordTextSecondary) },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = pollFieldColors(),
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(text = "Варианты ответа", color = DiscordTextSecondary, fontSize = 13.sp)
            options.forEachIndexed { index, value ->
                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextField(
                        value = value,
                        onValueChange = { next ->
                            options = options.toMutableList().also { it[index] = next }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !isSubmitting,
                        placeholder = { Text("Вариант ${index + 1}", color = DiscordTextSecondary) },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        colors = pollFieldColors(),
                    )
                    if (options.size > MIN_OPTIONS) {
                        IconButton(
                            onClick = {
                                options = options.filterIndexed { i, _ -> i != index }
                            },
                            enabled = !isSubmitting,
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = "Удалить", tint = DiscordTextSecondary)
                        }
                    }
                }
            }

            if (options.size < MAX_OPTIONS) {
                TextButton(
                    onClick = { options = options + "" },
                    enabled = !isSubmitting,
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text("Добавить вариант", modifier = Modifier.padding(start = 4.dp))
                }
            }

            PollToggleRow(
                title = "Несколько вариантов",
                description = "Участники смогут выбрать больше одного ответа",
                checked = allowMultiple,
                enabled = !isSubmitting,
                onCheckedChange = { allowMultiple = it },
            )
            PollToggleRow(
                title = "Анонимный опрос",
                description =
                    if (isAnonymous) {
                        "Голоса участников будут скрыты"
                    } else {
                        "Участники увидят, кто за что проголосовал"
                    },
                checked = isAnonymous,
                enabled = !isSubmitting,
                onCheckedChange = { isAnonymous = it },
            )

            error?.let {
                Text(text = it, color = Color(0xFFED4245), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            }

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TextButton(
                    onClick = {
                        if (!isSubmitting) {
                            resetForm()
                            onDismiss()
                        }
                    },
                    enabled = !isSubmitting,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Отмена")
                }
                Button(
                    onClick = {
                        val trimmedQuestion = question.trim()
                        val trimmedOptions = options.map { it.trim() }.filter { it.isNotBlank() }
                        when {
                            trimmedQuestion.isBlank() -> error = "Введите вопрос опроса"
                            trimmedOptions.size < MIN_OPTIONS -> error = "Добавьте минимум 2 варианта ответа"
                            else -> {
                                error = null
                                onSubmit(trimmedQuestion, trimmedOptions, allowMultiple, isAnonymous)
                            }
                        }
                    },
                    enabled = !isSubmitting,
                    modifier = Modifier.weight(1f),
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = TelegramMessageUi.AccentBlue,
                        ),
                ) {
                    Text(if (isSubmitting) "Создание…" else "Создать опрос")
                }
            }
        }
    }
}

@Composable
private fun PollToggleRow(
    title: String,
    description: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, color = DiscordText, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(text = description, color = DiscordTextSecondary, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = TelegramMessageUi.AccentBlue,
                ),
        )
    }
}

@Composable
private fun pollFieldColors() =
    TextFieldDefaults.colors(
        focusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        disabledContainerColor = MaterialTheme.colorScheme.surface,
        focusedIndicatorColor = Color.Transparent,
        unfocusedIndicatorColor = Color.Transparent,
        disabledIndicatorColor = Color.Transparent,
        cursorColor = TelegramMessageUi.AccentBlue,
        focusedTextColor = MaterialTheme.colorScheme.onSurface,
        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
    )
