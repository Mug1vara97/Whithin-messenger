package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.os.Build
import android.util.Log
import android.view.Surface
import androidx.camera.core.AspectRatio
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.MirrorMode
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.util.concurrent.Executor
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "VideoNoteRecSession"
private const val MIN_RECORD_MS = 400L

private data class RecordedSegment(
    val file: File,
    val useFrontCamera: Boolean,
    val sensorRotationDegrees: Int,
)

private fun previewSurfaceRotation(previewView: PreviewView): Int =
    previewView.display?.rotation ?: Surface.ROTATION_0

private fun videoNotePreviewResolutionSelector(): ResolutionSelector =
    ResolutionSelector.Builder()
        .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
        .build()

private suspend fun Context.awaitProcessCameraProvider(): ProcessCameraProvider =
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

/**
 * Запись видеокружка: превью в композере, пауза как у голоса только в закреплённом режиме.
 * Смена камеры во время записи: завершается текущий сегмент, перепривязка камеры, новый сегмент;
 * при отправке сегменты склеиваются в один MP4 (при ошибке склейки — отмена).
 */
class VideoNoteRecordingSession(
    private val context: Context,
    private val mainExecutor: Executor,
    private val onRecordingComplete: (File) -> Unit,
    private val onRecordingCancel: () -> Unit,
) : RecordingComposerSession {

    companion object {
        const val MAX_DURATION_DECISECONDS = 600
    }

    private val sessionScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override var isRecording by mutableStateOf(false)
        private set
    override var isPaused by mutableStateOf(false)
        private set
    override var elapsedDeciseconds by mutableIntStateOf(0)
        private set
    override var voiceLevelSmoothed by mutableFloatStateOf(0f)
        private set
    override val supportsPauseWhileRecording: Boolean
        get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N

    var useFrontCamera by mutableStateOf(true)
        private set

    var cameraBindReady by mutableStateOf(false)
        private set
    var bindError: String? by mutableStateOf(null)
        private set

    private var cameraProvider: ProcessCameraProvider? = null
    private var boundCamera: Camera? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var lastSensorRotationDegrees: Int = 0
    private var activeRecording: Recording? = null
    private var outputFile: File? = null
    private var recordingFinishedNormally = false
    private var userCancelledRecording = false

    /** Сегменты до текущего (после смены камеры). */
    private val completedSegments = mutableStateListOf<RecordedSegment>()

    /** Камера и ориентация активного сегмента (фиксируются при старте записи). */
    private var activeSegmentUseFrontCamera: Boolean = true
    private var activeSegmentSensorRotationDegrees: Int = 0

    private var boundLifecycleOwner: LifecycleOwner? = null
    private var boundPreviewView: PreviewView? = null

    /** Ожидаем [Finalize] после [Recording.stop] для смены камеры. */
    private var pendingLensSwitch: Boolean = false

    /** Защита от двойного нажатия «перевернуть» во время переподключения. */
    var lensSwitchInProgress by mutableStateOf(false)
        private set

    suspend fun bindCamera(lifecycleOwner: LifecycleOwner, previewView: PreviewView) {
        bindError = null
        boundLifecycleOwner = lifecycleOwner
        boundPreviewView = previewView
        withContext(Dispatchers.Main) {
            try {
                val provider = context.awaitProcessCameraProvider()
                cameraProvider?.unbindAll()
                cameraProvider = provider

                val rotation = previewSurfaceRotation(previewView)
                val preview =
                    Preview.Builder()
                        .setResolutionSelector(videoNotePreviewResolutionSelector())
                        .setTargetRotation(rotation)
                        .setMirrorMode(MirrorMode.MIRROR_MODE_ON_FRONT_ONLY)
                        .build()
                        .also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }
                val recorder =
                    Recorder.Builder()
                        .setAspectRatio(AspectRatio.RATIO_4_3)
                        .setQualitySelector(
                            QualitySelector.fromOrderedList(
                                listOf(Quality.HD, Quality.SD),
                                FallbackStrategy.lowerQualityOrHigherThan(Quality.SD),
                            ),
                        )
                        .build()
                val vc =
                    VideoCapture.withOutput(recorder).apply {
                        setTargetRotation(rotation)
                    }
                videoCapture = vc
                val selector =
                    if (useFrontCamera) {
                        CameraSelector.DEFAULT_FRONT_CAMERA
                    } else {
                        CameraSelector.DEFAULT_BACK_CAMERA
                    }
                boundCamera =
                    provider.bindToLifecycle(
                        lifecycleOwner,
                        selector,
                        preview,
                        vc,
                    )
                applyCaptureRotation(previewView)
                cameraBindReady = true
            } catch (e: Exception) {
                Log.e(TAG, "bindCamera failed", e)
                bindError = e.message ?: "Камера недоступна"
                cameraBindReady = false
                videoCapture = null
            }
        }
    }

    fun unbindCamera() {
        try {
            cameraProvider?.unbindAll()
        } catch (e: Exception) {
            Log.w(TAG, "unbindAll", e)
        }
        videoCapture = null
        boundCamera = null
        cameraBindReady = false
    }

    fun resetToFrontCamera(): Boolean {
        if (isRecording || lensSwitchInProgress || useFrontCamera) return false
        pendingLensSwitch = false
        useFrontCamera = true
        cameraBindReady = false
        return true
    }

    private fun applyCaptureRotation(previewView: PreviewView) {
        val surfaceRotation = previewSurfaceRotation(previewView)
        videoCapture?.setTargetRotation(surfaceRotation)
        lastSensorRotationDegrees =
            boundCamera?.cameraInfo?.getSensorRotationDegrees(surfaceRotation) ?: 0
    }

    private fun deliverRecording(segments: List<RecordedSegment>) {
        if (segments.isEmpty()) {
            onRecordingCancel()
            return
        }
        sessionScope.launch {
            try {
                val exportedParts = mutableListOf<File>()
                for (seg in segments) {
                    val exported =
                        kotlinx.coroutines.withTimeoutOrNull(45_000) {
                            VideoNoteExporter.export(
                                context = context,
                                input = seg.file,
                                sensorRotationDegrees = seg.sensorRotationDegrees,
                                useFrontCamera = seg.useFrontCamera,
                            )
                        } ?: seg.file
                    if (exported.absolutePath != seg.file.absolutePath) {
                        seg.file.delete()
                    }
                    exportedParts.add(exported)
                }

                val result =
                    if (exportedParts.size == 1) {
                        exportedParts.single()
                    } else {
                        val merged =
                            File(context.cacheDir, "video_note_merged_${System.currentTimeMillis()}.mp4")
                        val ok =
                            VideoNoteMp4Concat.concatOrCopy(
                                segmentsPrior = exportedParts.dropLast(1),
                                finalPart = exportedParts.last(),
                                out = merged,
                            )
                        if (!ok || !merged.exists()) {
                            exportedParts.forEach { it.delete() }
                            onRecordingCancel()
                            return@launch
                        }
                        exportedParts.forEach { it.delete() }
                        merged
                    }
                onRecordingComplete(result)
            } catch (e: Exception) {
                Log.e(TAG, "deliverRecording", e)
                segments.forEach { it.file.delete() }
                onRecordingCancel()
            }
        }
    }

    /**
     * Переключение фронт/тыл. Без записи — просто перепривязка.
     * Во время записи — завершение сегмента и продолжение на другой камере (склейка при отправке).
     */
    fun toggleCameraFacing(): Boolean {
        if (lensSwitchInProgress) return false
        if (!isRecording) {
            pendingLensSwitch = false
            lensSwitchInProgress = false
            useFrontCamera = !useFrontCamera
            return true
        }
        if (pendingLensSwitch) return false
        pendingLensSwitch = true
        lensSwitchInProgress = true
        useFrontCamera = !useFrontCamera
        return try {
            activeRecording?.stop()
            true
        } catch (e: Exception) {
            Log.e(TAG, "stop for lens switch", e)
            pendingLensSwitch = false
            lensSwitchInProgress = false
            useFrontCamera = !useFrontCamera
            false
        }
    }

    fun startRecording(): Boolean {
        if (!useFrontCamera) {
            Log.w(TAG, "startRecording blocked: waiting for front camera bind")
            resetToFrontCamera()
            return false
        }
        completedSegments.clear()
        elapsedDeciseconds = 0
        return startRecordingInternal(resetElapsed = true)
    }

    private fun startRecordingInternal(resetElapsed: Boolean): Boolean {
        recordingFinishedNormally = false
        isPaused = false
        userCancelledRecording = false
        if (!cameraBindReady || videoCapture == null) {
            Log.e(TAG, "startRecording: camera not ready")
            return false
        }
        val vc = videoCapture ?: return false
        boundPreviewView?.let { applyCaptureRotation(it) }
        activeSegmentUseFrontCamera = useFrontCamera
        activeSegmentSensorRotationDegrees = lastSensorRotationDegrees
        Log.d(
            TAG,
            "segment start front=$activeSegmentUseFrontCamera sensor=$activeSegmentSensorRotationDegrees",
        )
        val outFile = File(context.cacheDir, "video_note_${System.currentTimeMillis()}.mp4")
        outputFile = outFile
        return try {
            val pending =
                vc.output
                    .prepareRecording(context, FileOutputOptions.Builder(outFile).build())
                    .withAudioEnabled()
            activeRecording =
                pending.start(mainExecutor) { event ->
                    if (event is VideoRecordEvent.Finalize) {
                        handleFinalize(event, outFile)
                    }
                }
            isRecording = true
            if (resetElapsed) {
                elapsedDeciseconds = 0
            }
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "mic/camera", e)
            outFile.delete()
            outputFile = null
            false
        } catch (e: Exception) {
            Log.e(TAG, "startRecording", e)
            outFile.delete()
            outputFile = null
            false
        }
    }

    private fun handleFinalize(
        event: VideoRecordEvent.Finalize,
        outFile: File,
    ) {
        val switchedLens = pendingLensSwitch
        pendingLensSwitch = false

        isRecording = false
        activeRecording = null
        outputFile = null
        voiceLevelSmoothed = 0f

        if (userCancelledRecording) {
            userCancelledRecording = false
            pendingLensSwitch = false
            lensSwitchInProgress = false
            outFile.delete()
            completedSegments.forEach { it.file.delete() }
            completedSegments.clear()
            recordingFinishedNormally = true
            onRecordingCancel()
            return
        }

        if (event.hasError()) {
            Log.e(TAG, "finalize ${event.error} ${event.cause}")
            lensSwitchInProgress = false
            outFile.delete()
            completedSegments.forEach { it.file.delete() }
            completedSegments.clear()
            recordingFinishedNormally = true
            onRecordingCancel()
            return
        }

        val durationMs = event.recordingStats.recordedDurationNanos / 1_000_000

        if (switchedLens) {
            if (durationMs >= MIN_RECORD_MS && outFile.exists()) {
                completedSegments.add(
                    RecordedSegment(
                        file = outFile,
                        useFrontCamera = activeSegmentUseFrontCamera,
                        sensorRotationDegrees = activeSegmentSensorRotationDegrees,
                    ),
                )
            } else {
                outFile.delete()
                failLensSwitchChain("Короткий фрагмент при смене камеры")
                return
            }
            sessionScope.launch {
                try {
                    unbindCamera()
                    val lo = boundLifecycleOwner
                    val pv = boundPreviewView
                    if (lo == null || pv == null) {
                        failLensSwitchChain("no preview")
                        return@launch
                    }
                    bindCamera(lo, pv)
                    if (!cameraBindReady) {
                        failLensSwitchChain(bindError)
                        return@launch
                    }
                    if (!startRecordingInternal(resetElapsed = false)) {
                        failLensSwitchChain("start next segment")
                    } else {
                        lensSwitchInProgress = false
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "lens switch chain", e)
                    failLensSwitchChain(e.message)
                }
            }
            return
        }

        if (durationMs < MIN_RECORD_MS) {
            outFile.delete()
            completedSegments.forEach { it.file.delete() }
            completedSegments.clear()
            recordingFinishedNormally = true
            onRecordingCancel()
            return
        }

        recordingFinishedNormally = true
        val finalSegment =
            RecordedSegment(
                file = outFile,
                useFrontCamera = activeSegmentUseFrontCamera,
                sensorRotationDegrees = activeSegmentSensorRotationDegrees,
            )
        val allSegments = completedSegments.toList() + finalSegment
        completedSegments.clear()
        resetToFrontCamera()
        deliverRecording(allSegments)
    }

    private fun failLensSwitchChain(reason: String?) {
        lensSwitchInProgress = false
        Log.e(TAG, "lens switch aborted: $reason")
        unbindCamera()
        completedSegments.forEach { it.file.delete() }
        completedSegments.clear()
        isRecording = false
        recordingFinishedNormally = true
        onRecordingCancel()
    }

    override fun stop(send: Boolean) {
        isPaused = false
        userCancelledRecording = !send
        try {
            activeRecording?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "stop recording", e)
        }
        if (!send) {
            activeRecording = null
            outputFile?.delete()
            outputFile = null
            completedSegments.forEach { it.file.delete() }
            completedSegments.clear()
            isRecording = false
            lensSwitchInProgress = false
            voiceLevelSmoothed = 0f
            resetToFrontCamera()
        }
    }

    override fun togglePause() {
        if (!supportsPauseWhileRecording) return
        val r = activeRecording ?: return
        try {
            if (isPaused) {
                r.resume()
                isPaused = false
            } else {
                r.pause()
                isPaused = true
            }
        } catch (e: Exception) {
            Log.e(TAG, "pause/resume video", e)
        }
    }

    override fun bumpElapsedTick() {
        if (!isRecording || isPaused) return
        elapsedDeciseconds++
        if (elapsedDeciseconds >= MAX_DURATION_DECISECONDS) {
            stop(send = true)
        }
    }

    override fun setVoiceMeter(value: Float) {
        voiceLevelSmoothed = value
    }

    fun disposeAbandon() {
        if (recordingFinishedNormally) return
        try {
            activeRecording?.stop()
        } catch (_: Exception) {
        }
        activeRecording = null
        outputFile?.delete()
        outputFile = null
        completedSegments.forEach { it.file.delete() }
        completedSegments.clear()
        isRecording = false
        lensSwitchInProgress = false
        pendingLensSwitch = false
        unbindCamera()
        recordingFinishedNormally = true
        onRecordingCancel()
    }
}
