package com.whithin.voice.presentation.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.*
import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.whithin.voice.presentation.viewmodel.AuthViewModel

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit,
    onNavigateToForgotPassword: (String) -> Unit = {},
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var usernameError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var resendMessage by remember { mutableStateOf<String?>(null) }
    var isResending by remember { mutableStateOf(false) }
    var showForgotPassword by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) {
            onLoginSuccess()
        }
    }

    LaunchedEffect(uiState.error) {
        showForgotPassword = uiState.error == "Неверный пароль"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Whithin",
            style = MaterialTheme.typography.headlineLarge,
            modifier = Modifier.padding(bottom = 48.dp)
        )

        OutlinedTextField(
            value = username,
            onValueChange = {
                username = it
                usernameError = null
                viewModel.clearError()
                viewModel.clearLoginPendingConfirmation()
                resendMessage = null
            },
            label = { Text("Логин или email") },
            placeholder = { Text("Введите логин или email") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            singleLine = true,
            isError = usernameError != null,
            supportingText = usernameError?.let { { Text(it) } }
        )

        OutlinedTextField(
            value = password,
            onValueChange = {
                password = it
                passwordError = null
                showForgotPassword = false
                viewModel.clearError()
            },
            label = { Text("Пароль") },
            placeholder = { Text("Введите пароль") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            isError = passwordError != null,
            supportingText = passwordError?.let { { Text(it) } }
        )

        uiState.error?.let { error ->
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }

        if (showForgotPassword) {
            TextButton(
                onClick = {
                    val emailHint =
                        if (username.contains('@')) {
                            username.trim()
                        } else {
                            ""
                        }
                    onNavigateToForgotPassword(emailHint)
                },
                modifier = Modifier
                    .align(Alignment.End)
                    .padding(bottom = 8.dp),
            ) {
                Text("Забыли пароль?")
            }
        }

        uiState.loginPendingConfirmationEmail?.let { pendingEmail ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Подтвердите email перед входом",
                        style = MaterialTheme.typography.titleSmall,
                    )
                    Text(
                        text = pendingEmail,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                    resendMessage?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    OutlinedButton(
                        onClick = {
                            isResending = true
                            resendMessage = null
                            viewModel.resendConfirmation(pendingEmail) { success, message ->
                                isResending = false
                                resendMessage = message
                            }
                        },
                        enabled = !isResending,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (isResending) "Отправка..." else "Отправить письмо ещё раз")
                    }
                }
            }
        }

        Button(
            onClick = {
                var hasError = false

                if (username.isBlank()) {
                    usernameError = "Укажите логин или email"
                    hasError = true
                }

                if (password.isBlank()) {
                    passwordError = "Укажите пароль"
                    hasError = true
                }

                if (!hasError) {
                    viewModel.login(username.trim(), password)
                }
            },
            enabled = !uiState.isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text("Войти")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = onNavigateToRegister) {
            Text("Нет аккаунта? Зарегистрироваться")
        }
    }
}
