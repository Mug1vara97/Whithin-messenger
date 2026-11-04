package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import androidx.compose.animation.core.*
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.common.util.UnstableApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Canvas
import androidx.compose.ui.viewinterop.AndroidView
import com.masoudss.lib.WaveformSeekBar
import com.whithin.voice.data.model.MediaFile
import com.whithin.voice.data.local.VoiceAudioCache
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import android.os.Handler
import android.os.Looper
import android.media.MediaMetadataRetriever

@EntryPoint
@InstallIn(SingletonComponent::class)
interface VoiceAudioCacheEntryPoint {
    fun voiceAudioCache(): VoiceAudioCache
}

@UnstableApi
@Composable
fun VoiceMessageItem(
    mediaFile: MediaFile,
    modifier: Modifier = Modifier,
    isOwn: Boolean = false,
    /** When true, ExoPlayer is created only after the user taps play. */
    lazyLoad: Boolean = false,
    /** When true (default), audio file is downloaded for the waveform without waiting for play. */
    preloadWaveform: Boolean = true,
    layoutMaxWidth: Dp? = 300.dp,
    /** Inside a chat bubble: no second card background. */
    embedInBubble: Boolean = false,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    var isPlaying by remember { mutableStateOf(false) }
    var currentPosition by remember { mutableStateOf(0) }
    var duration by remember { mutableStateOf(0) }
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var waveformSeekBarRef by remember { mutableStateOf<WaveformSeekBar?>(null) }
    var localAudioFile by remember { mutableStateOf<File?>(null) }
    var waveformLoaded by remember { mutableStateOf(false) }
    var shouldLoadFile by remember { mutableStateOf(false) }
    var shouldInitPlayer by remember { mutableStateOf(!lazyLoad) }
    var userInitiatedPlay by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val colorScheme = MaterialTheme.colorScheme
    val containerColor =
        when {
            embedInBubble -> Color.Transparent
            isOwn -> colorScheme.primary.copy(alpha = 0.18f)
            else -> colorScheme.surfaceVariant
        }
    val accentColor = colorScheme.primary
    val mutedColor = colorScheme.onSurfaceVariant
    val waveformBgColor = mutedColor.copy(alpha = 0.45f)
    val accentArgb = accentColor.toArgb()
    val waveformBgArgb = waveformBgColor.toArgb()

    val audioUrl = remember(mediaFile.filePath) {
        val filePath = mediaFile.filePath ?: ""
        when {
            filePath.startsWith("http://") || filePath.startsWith("https://") -> filePath
            filePath.startsWith("/uploads/") -> "https://whithin.ru$filePath"
            filePath.startsWith("uploads/") -> "https://whithin.ru/$filePath"
            else -> "https://whithin.ru/uploads/$filePath"
        }
    }

    val voiceAudioCache =
        remember(context) {
            EntryPointAccessors.fromApplication(
                context.applicationContext,
                VoiceAudioCacheEntryPoint::class.java,
            ).voiceAudioCache()
        }

    val storagePath = remember(mediaFile.filePathValue) { mediaFile.filePathValue }

    // Preload waveform when requested; defer ExoPlayer until play when lazyLoad=true.
    LaunchedEffect(preloadWaveform, lazyLoad, audioUrl, storagePath) {
        if (!preloadWaveform) return@LaunchedEffect
        voiceAudioCache.existingFile(audioUrl, storagePath)?.let { cached ->
            voiceAudioCache.readCachedDurationMs(cached)?.let { cachedDuration ->
                if (duration == 0) duration = cachedDuration
            }
        }
        delay(if (lazyLoad) 80 else 150)
        shouldLoadFile = true
    }
    val playbackId = remember(audioUrl) { "voice:$audioUrl" }

    LaunchedEffect(ChatPlaybackCoordinator.activePlaybackId, exoPlayer) {
        val player = exoPlayer ?: return@LaunchedEffect
        if (ChatPlaybackCoordinator.activePlaybackId != playbackId && player.isPlaying) {
            player.pause()
            userInitiatedPlay = false
        }
    }
    
    // Initialize ExoPlayer with local file (after download) - better .webm support
    LaunchedEffect(localAudioFile, shouldInitPlayer) {
        if (!shouldInitPlayer) return@LaunchedEffect
        localAudioFile?.let { file ->
            try {
                // Освобождаем предыдущий ExoPlayer, если он существует
                exoPlayer?.release()
                
                // Инициализируем ExoPlayer с DefaultRenderersFactory для лучшей поддержки .webm/Opus
                val renderersFactory = DefaultRenderersFactory(context)
                    .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
                val player = ExoPlayer.Builder(context)
                    .setRenderersFactory(renderersFactory)
                    .build()
                val mediaItem = MediaItem.fromUri(android.net.Uri.fromFile(file))
                player.setMediaItem(mediaItem)
                // Отключаем автоматическое повторное воспроизведение ДО prepare()
                player.repeatMode = Player.REPEAT_MODE_OFF
                player.shuffleModeEnabled = false
                
                // Создаем listener с замыканием на переменные composable
                player.addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlayingValue: Boolean) {
                        // Не обновляем isPlaying, если воспроизведение завершено
                        if (player.playbackState == Player.STATE_ENDED) {
                            // Если воспроизведение завершено, явно останавливаем
                            if (isPlayingValue) {
                                player.pause()
                            }
                            isPlaying = false
                            userInitiatedPlay = false
                        } else {
                            isPlaying = isPlayingValue
                            // Если воспроизведение остановилось не по инициативе пользователя, сбрасываем флаг
                            if (!isPlayingValue) {
                                userInitiatedPlay = false
                            }
                        }
                    }
                    
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        val stateName = when (playbackState) {
                            Player.STATE_IDLE -> "IDLE"
                            Player.STATE_BUFFERING -> "BUFFERING"
                            Player.STATE_READY -> "READY"
                            Player.STATE_ENDED -> "ENDED"
                            else -> "UNKNOWN"
                        }
                        android.util.Log.d("VoiceMessageItem", "[STATE] Changed to: $stateName, isPlaying=${player.isPlaying}")
                        
                        when (playbackState) {
                            Player.STATE_READY -> {
                                val newDuration = player.duration
                                if (newDuration > 0 && duration == 0) {
                                    duration = newDuration.toInt()
                                    val minutes = newDuration.toInt() / 60000
                                    val seconds = (newDuration.toInt() % 60000) / 1000
                                    android.util.Log.d("VoiceMessageItem", "[DURATION] From ExoPlayer: ${newDuration}ms = ${minutes}:${String.format("%02d", seconds)}")
                                }
                                // Если после STATE_READY автоматически началось воспроизведение (не по инициативе пользователя), останавливаем
                                if (player.isPlaying && !isPlaying && !userInitiatedPlay) {
                                    android.util.Log.w("VoiceMessageItem", "[STATE] Auto-play detected after READY, pausing")
                                    player.pause()
                                } else if (userInitiatedPlay && player.isPlaying) {
                                    // Пользователь нажал play, разрешаем воспроизведение
                                    isPlaying = true
                                    userInitiatedPlay = false // Сбрасываем флаг
                                }
                            }
                            Player.STATE_ENDED -> {
                                android.util.Log.d("VoiceMessageItem", "[STATE] Playback ended, stopping")
                                // Явно останавливаем воспроизведение
                                player.pause()
                                isPlaying = false
                                userInitiatedPlay = false
                                ChatPlaybackCoordinator.deactivate(playbackId)
                                // НЕ сбрасываем позицию здесь - это может вызвать автоматический запуск
                                // Позиция будет сброшена при следующем нажатии play
                                // Если длительность не была определена, используем текущую позицию
                                if (duration == 0 && currentPosition > 0) {
                                    duration = currentPosition
                                    val minutes = currentPosition / 60000
                                    val seconds = (currentPosition % 60000) / 1000
                                    android.util.Log.d("VoiceMessageItem", "[DURATION] Set from completion: ${currentPosition}ms = ${minutes}:${String.format("%02d", seconds)}")
                                }
                            }
                        }
                    }
                    
                    override fun onPlayerError(playbackError: androidx.media3.common.PlaybackException) {
                        android.util.Log.e("VoiceMessageItem", "[EXOPLAYER] Error: ${playbackError.message}", playbackError)
                        error = "Ошибка воспроизведения: ${playbackError.message}"
                    }
                })
                
                player.prepare()
                exoPlayer = player
                
                // Проверяем длительность чаще для быстрого определения (каждые 50ms, максимум 10 раз)
                var checkCount = 0
                val maxChecks = 10
                val checkInterval = 50L
                
                fun checkDuration() {
                    if (checkCount < maxChecks && duration == 0) {
                        val checkDuration = player.duration
                        if (checkDuration > 0) {
                            duration = checkDuration.toInt()
                            val minutes = checkDuration.toInt() / 60000
                            val seconds = (checkDuration.toInt() % 60000) / 1000
                            android.util.Log.d("VoiceMessageItem", "[DURATION] From ExoPlayer: ${checkDuration}ms = ${minutes}:${String.format("%02d", seconds)}")
                        } else {
                            checkCount++
                            Handler(Looper.getMainLooper()).postDelayed({ checkDuration() }, checkInterval)
                        }
                    }
                }
                
                // Начинаем проверку через 50ms для быстрого определения
                Handler(Looper.getMainLooper()).postDelayed({ checkDuration() }, checkInterval)
            } catch (e: Exception) {
                error = "Ошибка загрузки аудио"
                android.util.Log.e("VoiceMessageItem", "Failed to initialize ExoPlayer with local file", e)
            }
        }
    }

    LaunchedEffect(exoPlayer, userInitiatedPlay) {
        if (!userInitiatedPlay) return@LaunchedEffect
        val player = exoPlayer ?: return@LaunchedEffect
        if (player.isPlaying) return@LaunchedEffect
        if (player.playbackState == Player.STATE_ENDED) {
            player.seekTo(0)
            currentPosition = 0
        }
        ChatPlaybackCoordinator.activate(playbackId)
        player.play()
    }
    
    // Update current position while playing
    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            exoPlayer?.let { player ->
                // Проверяем, что воспроизведение действительно идет и не завершено
                if (player.isPlaying && player.playbackState != Player.STATE_ENDED) {
                    val newPosition = player.currentPosition.toInt()
                    currentPosition = newPosition
                    // Логируем прогресс только при значительных изменениях (каждую секунду)
                    if (newPosition % 1000 < 50) {
                        val progressPercent = if (duration > 0) {
                            (newPosition.toFloat() / duration.toFloat() * 100f).coerceIn(0f, 100f)
                        } else 0f
                        android.util.Log.d("VoiceMessageItem", "[PROGRESS] pos=${newPosition}ms/${duration}ms (${String.format("%.1f", progressPercent)}%)")
                    }
                } else if (player.playbackState == Player.STATE_ENDED) {
                    // Если воспроизведение завершено, останавливаем цикл
                    isPlaying = false
                }
            }
            delay(50) // Обновляем чаще для плавного прогресса
        }
    }
    
    // Также обновляем позицию при паузе и после завершения (чтобы прогресс оставался видимым)
    LaunchedEffect(exoPlayer, isPlaying) {
        exoPlayer?.let { player ->
            if (!isPlaying) {
                val newPosition = player.currentPosition.toInt()
                // Если воспроизведение завершено, сбрасываем позицию
                if (player.playbackState == Player.STATE_ENDED) {
                    currentPosition = 0
                } else {
                    currentPosition = newPosition
                }
            }
        }
    }
    
    // Cleanup
    DisposableEffect(Unit) {
        onDispose {
            ChatPlaybackCoordinator.deactivate(playbackId)
            exoPlayer?.release()
            exoPlayer = null
        }
    }
    
    val togglePlay: () -> Unit = {
        if (!shouldLoadFile) {
            shouldLoadFile = true
        }
        if (!shouldInitPlayer) {
            shouldInitPlayer = true
            userInitiatedPlay = true
        }
        
        exoPlayer?.let { player ->
            if (isPlaying) {
                android.util.Log.d("VoiceMessageItem", "[TOGGLE] Pausing playback")
                player.pause()
                ChatPlaybackCoordinator.deactivate(playbackId)
                userInitiatedPlay = false
            } else {
                android.util.Log.d("VoiceMessageItem", "[TOGGLE] Starting playback, state=${player.playbackState}")
                // Устанавливаем флаг, что пользователь инициировал воспроизведение
                userInitiatedPlay = true
                // Если воспроизведение завершено, начинаем с начала
                if (player.playbackState == Player.STATE_ENDED) {
                    player.seekTo(0)
                    currentPosition = 0
                }
                ChatPlaybackCoordinator.activate(playbackId)
                player.play()
            }
        }
    }
    
    // Format time helper
    fun formatTime(milliseconds: Int): String {
        val totalSeconds = milliseconds / 1000
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return String.format("%d:%02d", minutes, seconds)
    }
    
    
    // Calculate progress (0.0 to 1.0)
    val progress = if (duration > 0) {
        (currentPosition.toFloat() / duration.toFloat()).coerceIn(0f, 1f)
    } else {
        0f
    }
    
    // Voice message container (like web client)
    Box(
        modifier =
            modifier
                .then(
                    if (embedInBubble) {
                        Modifier
                    } else {
                        Modifier.clip(RoundedCornerShape(10.dp)).background(containerColor)
                    },
                )
                .padding(if (embedInBubble) 0.dp else 8.dp)
                .fillMaxWidth()
                .then(
                    if (layoutMaxWidth != null) {
                        Modifier.widthIn(max = layoutMaxWidth)
                    } else {
                        Modifier
                    },
                ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Play/Pause button
            IconButton(
                onClick = togglePlay,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (isPlaying) "Pause" else "Play",
                    tint = accentColor,
                    modifier = Modifier.size(24.dp)
                )
            }
            
            // Waveform visualization using waveformSeekBar library (Telegram-style)
            // Telegram использует: тонкие бары (2-3px), маленькие промежутки (1-2px), высота ~20-30px
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(20.dp)
            ) {
                AndroidView(
                    factory = { ctx ->
                        try {
                            // Получаем density из ресурсов
                            val displayMetrics = ctx.resources.displayMetrics
                            val density = displayMetrics.density
                            
                            // Конвертируем dp в px
                            val waveWidthPx = 2.5f * density
                            val waveGapPx = 1.5f * density
                            val waveMinHeightPx = 2f * density
                            val waveCornerRadiusPx = 1.5f * density
                            
                            WaveformSeekBar(ctx).apply {
                                // Точные параметры как в Telegram
                                waveWidth = waveWidthPx // Тонкие бары (2-3px как в Telegram)
                                waveGap = waveGapPx // Маленький промежуток (1-2px)
                                waveMinHeight = waveMinHeightPx // Минимальная высота баров
                                waveCornerRadius = waveCornerRadiusPx // Закругленные углы
                                // waveGravity по умолчанию CENTER (центрирование по вертикали)

                                waveBackgroundColor = waveformBgArgb
                                waveProgressColor = accentArgb
                                maxProgress = 100f
                                // Начальный прогресс по умолчанию 0
                                
                                // Сохраняем ссылку для асинхронной загрузки
                                waveformSeekBarRef = this
                            }
                        } catch (e: Exception) {
                            android.util.Log.e("VoiceMessageItem", "Failed to create WaveformSeekBar", e)
                            // Возвращаем пустой View в случае ошибки
                            android.view.View(ctx)
                        }
                    },
                    update = { view ->
                        try {
                            if (view is WaveformSeekBar) {
                                view.waveProgressColor = accentArgb
                                view.waveBackgroundColor = waveformBgArgb
                                if (waveformLoaded) {
                                    val newProgress = (progress * 100f).coerceIn(0f, 100f)
                                    if (kotlin.math.abs(view.progress - newProgress) > 0.01f) {
                                        view.progress = newProgress
                                        view.invalidate()
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            android.util.Log.e("VoiceMessageItem", "Failed to update waveform progress", e)
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
            
            // Download voice file for waveform + duration (OkHttp with auth + disk cache).
            LaunchedEffect(audioUrl, storagePath, shouldLoadFile) {
                if (!shouldLoadFile) return@LaunchedEffect
                try {
                    val file =
                        voiceAudioCache.ensureLocalFile(
                            storagePath = storagePath.ifBlank { audioUrl },
                            audioUrl = audioUrl,
                        ) ?: return@LaunchedEffect

                    localAudioFile = file

                    voiceAudioCache.readCachedDurationMs(file)?.let { cachedDuration ->
                        if (duration == 0) duration = cachedDuration
                    }

                    withContext(Dispatchers.IO) {
                        try {
                            val retriever = MediaMetadataRetriever()
                            retriever.setDataSource(file.absolutePath)
                            val durationString =
                                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                            retriever.release()

                            durationString?.toIntOrNull()?.takeIf { it > 0 }?.let { durationMs ->
                                if (duration == 0) duration = durationMs
                                voiceAudioCache.writeCachedDurationMs(file, durationMs)
                            }
                        } catch (e: Exception) {
                            android.util.Log.w(
                                "VoiceMessageItem",
                                "[DURATION] Metadata unavailable, will use player: ${e.message}",
                            )
                        }
                    }
                } catch (e: kotlinx.coroutines.CancellationException) {
                    android.util.Log.d("VoiceMessageItem", "Voice download cancelled")
                } catch (e: Exception) {
                    android.util.Log.e("VoiceMessageItem", "Failed to download voice from $audioUrl", e)
                }
            }

            // Replace placeholder with real waveform when the local file is ready.
            LaunchedEffect(localAudioFile, waveformSeekBarRef, accentArgb, waveformBgArgb) {
                waveformSeekBarRef?.let { seekBar ->
                    localAudioFile?.let { file ->
                        try {
                            seekBar.setSampleFrom(file.absolutePath)
                            seekBar.waveProgressColor = accentArgb
                            seekBar.waveBackgroundColor = waveformBgArgb
                            Handler(Looper.getMainLooper()).postDelayed({
                                val initialProgress = (progress * 100f).coerceIn(0f, 100f)
                                seekBar.progress = initialProgress
                                seekBar.invalidate()
                                seekBar.requestLayout()
                                waveformLoaded = true
                            }, 150)
                        } catch (e: Exception) {
                            android.util.Log.e("VoiceMessageItem", "Failed to load waveform from local file", e)
                        }
                    }
                }
            }
            
            // Отдельный LaunchedEffect для обновления прогресса в реальном времени
            LaunchedEffect(progress, waveformSeekBarRef, waveformLoaded) {
                if (waveformLoaded) {
                    waveformSeekBarRef?.let { seekBar ->
                        val newProgress = (progress * 100f).coerceIn(0f, 100f)
                        // Обновляем прогресс на главном потоке
                        seekBar.post {
                            if (kotlin.math.abs(seekBar.progress - newProgress) > 0.1f) {
                                seekBar.progress = newProgress
                                seekBar.invalidate()
                                android.util.Log.d("VoiceMessageItem", "[WAVEFORM_PROGRESS] Updated: $newProgress%")
                            }
                        }
                    }
                }
            }
            
            // Duration (показываем "текущее / общее" во время воспроизведения, иначе только общее)
            Text(
                text = if (error != null) {
                    error ?: "Ошибка"
                } else if (duration > 0) {
                    if (isPlaying || (currentPosition > 0 && currentPosition < duration)) {
                        // Во время воспроизведения показываем "текущее / общее"
                        "${formatTime(currentPosition)} / ${formatTime(duration)}"
                    } else {
                        // Когда не играет или завершено, показываем только общую длительность
                        formatTime(duration)
                    }
                } else {
                    // Пока длительность не загружена, показываем текущее время или 0:00
                    if (currentPosition > 0) {
                        formatTime(currentPosition)
                    } else {
                        "0:00"
                    }
                },
                fontSize = 14.sp,
                color = mutedColor,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
