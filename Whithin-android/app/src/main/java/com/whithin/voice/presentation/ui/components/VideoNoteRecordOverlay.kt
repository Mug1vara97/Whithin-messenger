package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.Manifest
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.MultiplePermissionsState
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "VideoNoteRecord"
private const val MAX_RECORD_MS = 60_000L
private const val MIN_RECORD_MS = 400L

private suspend fun android.content.Context.awaitProcessCameraProvider(): ProcessCameraProvider =
    suspendCoroutine { cont ->
        val future = ProcessCameraProvider.getInstance(this)
        val executor = ContextCompat.getMainExecutor(this)
        future.addListener(
            {
                try {
                    cont.resume(future.get())
                } catch (e: Throwable) {
                    cont.resumeWithException(e)
                }
            },
            executor,
        )
    }

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VideoNoteRecordOverlay(
    onDismiss: () -> Unit,
    onVideoReadyForUpload: (Uri) -> Unit,
    onError: (String) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val mainExecutor = remember { ContextCompat.getMainExecutor(context) }

    val permissionsState: MultiplePermissionsState = rememberMultiplePermissionsState(
        listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
    )

    var previewView by remember { mutableStateOf<PreviewView?>(null) }
    val captureHolder = remember { object { var videoCapture: VideoCapture<Recorder>? = null } }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var bindFailed by remember { mutableStateOf<String?>(null) }

    var activeRecording: Recording? by remember { mutableStateOf(null) }
    var uiRecording by remember { mutableStateOf(false) }
    var progress01 by remember { mutableFloatStateOf(0f) }
    var recordStartedAt by remember { mutableStateOf(0L) }
    var currentOutputFile by remember { mutableStateOf<File?>(null) }

    val pickGallery = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        if (uri != null) {
            onVideoReadyForUpload(uri)
            onDismiss()
        }
    }

    fun unbindCamera() {
        try {
            cameraProvider?.unbindAll()
        } catch (e: Exception) {
            Log.w(TAG, "unbindAll", e)
        }
        captureHolder.videoCapture = null
    }

    fun reportError(msg: String) {
        scope.launch { onError(msg) }
    }

    LaunchedEffect(permissionsState.allPermissionsGranted, previewView) {
        val pv = previewView ?: return@LaunchedEffect
        if (!permissionsState.allPermissionsGranted) return@LaunchedEffect
        bindFailed = null
        withContext(Dispatchers.Main) {
            try {
                val provider = context.awaitProcessCameraProvider()
                cameraProvider = provider
                provider.unbindAll()

                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(pv.surfaceProvider)
                }
                val recorder = Recorder.Builder()
                    .setQualitySelector(
                        QualitySelector.fromOrderedList(
                            listOf(Quality.SD, Quality.HD),
                            FallbackStrategy.lowerQualityOrHigherThan(Quality.SD),
                        ),
                    )
                    .build()
                val videoCapture = VideoCapture.withOutput(recorder)
                captureHolder.videoCapture = videoCapture

                provider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    preview,
                    videoCapture,
                )
            } catch (e: Exception) {
                Log.e(TAG, "bind camera failed", e)
                bindFailed = e.message ?: "Камера недоступна"
                captureHolder.videoCapture = null
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            try {
                activeRecording?.stop()
            } catch (_: Exception) {
            }
            activeRecording = null
            unbindCamera()
        }
    }

    LaunchedEffect(uiRecording) {
        if (!uiRecording) {
            progress01 = 0f
            return@LaunchedEffect
        }
        recordStartedAt = SystemClock.elapsedRealtime()
        while (uiRecording) {
            val elapsed = (SystemClock.elapsedRealtime() - recordStartedAt).coerceAtMost(MAX_RECORD_MS)
            progress01 = elapsed / MAX_RECORD_MS.toFloat()
            if (elapsed >= MAX_RECORD_MS) {
                try {
                    activeRecording?.stop()
                } catch (_: Exception) {
                }
                break
            }
            delay(40)
        }
    }

    val accentBlue = TelegramMessageUi.AccentBlue

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0C0E)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = {
                    if (uiRecording) return@IconButton
                    unbindCamera()
                    onDismiss()
                },
                enabled = !uiRecording,
            ) {
                Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Color.White)
            }
            IconButton(
                onClick = {
                    if (uiRecording) return@IconButton
                    pickGallery.launch("video/*")
                },
                enabled = !uiRecording && permissionsState.allPermissionsGranted,
            ) {
                Icon(Icons.Default.Image, contentDescription = "Из галереи", tint = Color.White.copy(alpha = 0.9f))
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 56.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (!permissionsState.allPermissionsGranted) {
                Text(
                    text = "Нужны камера и микрофон, чтобы записать кружок.",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 15.sp,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
                Spacer(modifier = Modifier.height(16.dp))
                TextButton(onClick = { permissionsState.launchMultiplePermissionRequest() }) {
                    Text("Выдать разрешения", color = TelegramMessageUi.AccentBlue, fontWeight = FontWeight.SemiBold)
                }
            } else {
                bindFailed?.let { err ->
                    Text(
                        text = err,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }

                val ringSize = 308.dp
                val previewSize = 280.dp
                Box(
                    modifier = Modifier.size(ringSize),
                    contentAlignment = Alignment.Center,
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        val stroke = 5.dp.toPx()
                        val pad = stroke / 2f + 2.dp.toPx()
                        val diameter = size.minDimension - pad * 2
                        val topLeft = Offset(pad, pad)
                        val arcSize = Size(diameter, diameter)
                        drawArc(
                            color = Color.White.copy(alpha = 0.2f),
                            startAngle = -90f,
                            sweepAngle = 360f,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = stroke, cap = StrokeCap.Round),
                        )
                        val sweep = 360f * progress01.coerceIn(0f, 1f)
                        if (sweep > 0.5f) {
                            drawArc(
                                color = accentBlue,
                                startAngle = -90f,
                                sweepAngle = sweep,
                                useCenter = false,
                                topLeft = topLeft,
                                size = arcSize,
                                style = Stroke(width = stroke, cap = StrokeCap.Round),
                            )
                        }
                    }
                    AndroidView(
                        factory = { ctx ->
                            PreviewView(ctx).apply {
                                scaleType = PreviewView.ScaleType.FILL_CENTER
                                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                            }.also { previewView = it }
                        },
                        modifier = Modifier
                            .size(previewSize)
                            .clip(CircleShape),
                    )
                }

                Spacer(modifier = Modifier.height(36.dp))

                Text(
                    text = if (uiRecording) "Отпустите — отправить" else "Удерживайте кнопку — запись",
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 14.sp,
                )
                Spacer(modifier = Modifier.height(20.dp))

                Box(
                    modifier = Modifier
                        .size(88.dp)
                        .pointerInput(permissionsState.allPermissionsGranted, bindFailed) {
                            if (!permissionsState.allPermissionsGranted) return@pointerInput
                            awaitEachGesture {
                                awaitFirstDown(requireUnconsumed = false)
                                val vc = captureHolder.videoCapture
                                if (vc == null || bindFailed != null) {
                                    reportError("Камера не готова")
                                    return@awaitEachGesture
                                }

                                val outFile = File(context.cacheDir, "video_note_${System.currentTimeMillis()}.mp4")
                                currentOutputFile = outFile
                                val outputOptions = FileOutputOptions.Builder(outFile).build()
                                try {
                                    val pending = vc.output
                                        .prepareRecording(context, outputOptions)
                                        .withAudioEnabled()

                                    activeRecording = pending.start(mainExecutor) { event ->
                                        if (event is VideoRecordEvent.Finalize) {
                                            uiRecording = false
                                            activeRecording = null
                                            val file = currentOutputFile
                                            currentOutputFile = null
                                            if (event.hasError()) {
                                                Log.e(TAG, "finalize error ${event.error} ${event.cause}")
                                                file?.delete()
                                                reportError("Ошибка записи видео")
                                                return@start
                                            }
                                            val durationMs =
                                                event.recordingStats.recordedDurationNanos / 1_000_000
                                            if (durationMs < MIN_RECORD_MS) {
                                                file?.delete()
                                                return@start
                                            }
                                            if (file != null && file.exists()) {
                                                onVideoReadyForUpload(Uri.fromFile(file))
                                                onDismiss()
                                            }
                                        }
                                    }
                                    uiRecording = true
                                } catch (e: SecurityException) {
                                    Log.e(TAG, "mic denied?", e)
                                    reportError("Нет доступа к микрофону")
                                    outFile.delete()
                                    currentOutputFile = null
                                    uiRecording = false
                                    activeRecording = null
                                } catch (e: Exception) {
                                    Log.e(TAG, "startRecording", e)
                                    reportError(e.message ?: "Не удалось начать запись")
                                    outFile.delete()
                                    currentOutputFile = null
                                    uiRecording = false
                                    activeRecording = null
                                }

                                waitForUpOrCancellation(PointerEventPass.Main)
                                try {
                                    activeRecording?.stop()
                                } catch (_: Exception) {
                                }
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(if (uiRecording) 72.dp else 64.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFE53935).copy(alpha = if (uiRecording) 1f else 0.92f)),
                    )
                }
            }
        }
    }
}
