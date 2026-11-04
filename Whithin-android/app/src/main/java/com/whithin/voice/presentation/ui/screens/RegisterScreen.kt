package com.whithin.voice.presentation.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import com.whithin.voice.presentation.ui.components.AppText as Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.whithin.voice.presentation.viewmodel.AuthViewModel
import java.util.regex.Pattern

@Composable
fun RegisterScreen(
    onNavigateToLogin: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    var usernameError by remember { mutableStateOf<String?>(null) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var confirmPasswordError by remember { mutableStateOf<String?>(null) }
    var resendMessage by remember { mutableStateOf<String?>(null) }
    var isResending by remember { mutableStateOf(false) }

    val registeredEmail = uiState.registrationCompletedEmail

    val emailPattern = Pattern.compile(
        "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\$"
    )

    if (registeredEmail != null) {
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
                text = "Проверьте почту",
                style = MaterialTheme.typography.headlineLarge,
                modifier = Modifier.padding(bottom = 16.dp),
            )
            Text(
                text = "Мы отправили письмо на $registeredEmail",
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(bottom = 16.dp),
            )
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                ),
            ) {
                Text(
                    text = "Подтвердите email по ссылке из письма, затем войдите в аккаунт.",
                    modifier = Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            resendMessage?.let {
                Text(
                    text = it,
                    modifier = Modifier.padding(top = 16.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedButton(
                onClick = {
                    isResending = true
                    resendMessage = null
                    viewModel.resendConfirmation(registeredEmail) { _, message ->
                        isResending = false
                        resendMessage = message
                    }
                },
                enabled = !isResending,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (isResending) "Отправка..." else "Отправить письмо ещё раз")
            }
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    viewModel.clearRegistrationCompleted()
                    onNavigateToLogin()
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Перейти ко входу")
            }
        }
        return
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
            text = "Регистрация",
            style = MaterialTheme.typography.headlineLarge,
            modifier = Modifier.padding(bottom = 48.dp)
        )

        OutlinedTextField(
            value = username,
            onValueChange = {
                username = it
                usernameError = null
                viewModel.clearError()
            },
            label = { Text("Имя пользователя") },
            placeholder = { Text("Введите имя пользователя") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            singleLine = true,
            isError = usernameError != null,
            supportingText = usernameError?.let { { Text(it) } }
        )

        OutlinedTextField(
            value = email,
            onValueChange = {
                email = it
                emailError = null
                viewModel.clearError()
            },
            label = { Text("Email") },
            placeholder = { Text("Введите email") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            singleLine = true,
            isError = emailError != null,
            supportingText = emailError?.let { { Text(it) } }
        )

        OutlinedTextField(
            value = password,
            onValueChange = {
                password = it
                passwordError = null
                viewModel.clearError()
            },
            label = { Text("Пароль") },
            placeholder = { Text("Минимум 6 символов") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            isError = passwordError != null,
            supportingText = passwordError?.let { { Text(it) } }
        )

        OutlinedTextField(
            value = confirmPassword,
            onValueChange = {
                confirmPassword = it
                confirmPasswordError = null
                viewModel.clearError()
            },
            label = { Text("Повторите пароль") },
            placeholder = { Text("Повторите пароль") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            isError = confirmPasswordError != null,
            supportingText = confirmPasswordError?.let { { Text(it) } }
        )

        uiState.error?.let { error ->
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }

        Button(
            onClick = {
                var hasError = false

                if (username.isBlank()) {
                    usernameError = "Укажите имя пользователя"
                    hasError = true
                } else if (username.length < 3) {
                    usernameError = "Минимум 3 символа"
                    hasError = true
                }

                if (email.isBlank()) {
                    emailError = "Укажите email"
                    hasError = true
                } else if (!emailPattern.matcher(email).matches()) {
                    emailError = "Некорректный email"
                    hasError = true
                }

                if (password.isBlank()) {
                    passwordError = "Укажите пароль"
                    hasError = true
                } else if (password.length < 6) {
                    passwordError = "Минимум 6 символов"
                    hasError = true
                }

                if (confirmPassword.isBlank()) {
                    confirmPasswordError = "Повторите пароль"
                    hasError = true
                } else if (password != confirmPassword) {
                    confirmPasswordError = "Пароли не совпадают"
                    hasError = true
                }

                if (!hasError) {
                    viewModel.register(username.trim(), password, email.trim())
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
                Text("Зарегистрироваться")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = onNavigateToLogin) {
            Text("Уже есть аккаунт? Войти")
        }
    }
}
