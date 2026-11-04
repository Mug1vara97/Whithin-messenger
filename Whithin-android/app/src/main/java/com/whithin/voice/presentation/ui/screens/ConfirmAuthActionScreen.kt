package com.whithin.voice.presentation.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.navigation.ConfirmLinkData
import com.whithin.voice.presentation.navigation.ConfirmLinkType
import com.whithin.voice.presentation.viewmodel.AuthViewModel

@Composable
fun ConfirmAuthActionScreen(
    confirmLink: ConfirmLinkData,
    viewModel: AuthViewModel,
    onNavigateToLogin: () -> Unit,
) {
    var status by remember(confirmLink) { mutableStateOf("loading") }
    var message by remember(confirmLink) {
        mutableStateOf(
            when (confirmLink.type) {
                ConfirmLinkType.REGISTER_EMAIL -> "Подтверждаем email..."
                ConfirmLinkType.EMAIL_CHANGE -> "Подтверждаем смену email..."
                ConfirmLinkType.PASSWORD_CHANGE -> "Подтверждаем смену пароля..."
            },
        )
    }

    LaunchedEffect(confirmLink) {
        status = "loading"
        val callback: (Boolean, String) -> Unit = { success, resultMessage ->
            status = if (success) "success" else "error"
            message = resultMessage
        }

        when (confirmLink.type) {
            ConfirmLinkType.REGISTER_EMAIL -> {
                viewModel.confirmEmail(confirmLink.userId, confirmLink.token, callback)
            }
            ConfirmLinkType.EMAIL_CHANGE -> {
                val email = confirmLink.email
                if (email.isNullOrBlank()) {
                    status = "error"
                    message = "Ссылка подтверждения неполная"
                } else {
                    viewModel.confirmEmailChange(confirmLink.userId, email, confirmLink.token, callback)
                }
            }
            ConfirmLinkType.PASSWORD_CHANGE -> {
                viewModel.confirmPasswordChange(confirmLink.userId, confirmLink.token, callback)
            }
        }
    }

    val title = when (confirmLink.type) {
        ConfirmLinkType.REGISTER_EMAIL -> "Подтверждение email"
        ConfirmLinkType.EMAIL_CHANGE -> "Смена email"
        ConfirmLinkType.PASSWORD_CHANGE -> "Смена пароля"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(bottom = 24.dp),
        )

        when (status) {
            "loading" -> CircularProgressIndicator()
            "success" -> {
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 24.dp),
                )
                Button(onClick = onNavigateToLogin, modifier = Modifier.fillMaxWidth()) {
                    Text("Перейти ко входу")
                }
            }
            else -> {
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 24.dp),
                )
                TextButton(onClick = onNavigateToLogin) {
                    Text("Ко входу")
                }
            }
        }
    }
}
