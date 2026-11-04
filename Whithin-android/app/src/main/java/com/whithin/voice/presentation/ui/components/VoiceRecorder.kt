package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.Manifest
import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import kotlin.math.ln
import kotlin.math.sin
import kotlinx.coroutines.delay

/** Одна строка с текстовым полем в чате / полосой записи (~56 dp). */
val VoiceComposerBarHeightDp = 56.dp

/** Высота строки текста в композере (как на вебе: 22px). */
val ComposerMessageLineHeightDp = 22.dp

/** Максимум видимых строк в поле ввода до появления прокрутки. */
const val ComposerMessageMaxLines = 5

/** Максимальная высота многострочного поля ввода. */
val ComposerInputMaxHeightDp = ComposerMessageLineHeightDp * ComposerMessageMaxLines + 16.dp

/** Скругление капсулы композера (Telegram). */
val ComposerPillCornerRadius = 28.dp

/** Круглая кнопка справа от капсулы (отправка / микрофон). */
val ComposerActionButtonSize = 48.dp

/** Зазор между капсулой и кнопкой действия. */
val ComposerRowGap = 8.dp

/**
 * Холст RecordCircle: кнопка до ~71dp радиуса + blob-волны вокруг.
 * (Telegram: circleRadius=41 + circleRadiusAmplitude=30 при amp=1.)
 */
val ComposerHoldOrbOuterDp = 168.dp

/** @deprecated Используй [ComposerHoldOrbOuterDp]. */
val VoiceMicOrbOuterDp = ComposerHoldOrbOuterDp

/** Отступ между низом плавающей паузы и верхней кромкой строки записи (как в Telegram). */
private val VoicePauseFloatingGap = 6.dp

/** Дополнительно поднять паузу над полосой записи. */
private val VoicePauseExtraRaise = 12.dp

private val VoicePauseFloatingSize = 36.dp

/** Смещение FAB «Пауза» над кнопкой отправки. */
val ComposerPauseFabOffsetY = VoicePauseFloatingGap + VoicePauseExtraRaise + VoicePauseFloatingSize

@Composable
fun Modifier.composerPillSurface(): Modifier =
    this
        .clip(RoundedCornerShape(ComposerPillCornerRadius))
        .background(TelegramMessageUi.InputBackground)

@Composable
fun ComposerActionButton(
    icon: ImageVector,
    contentDescription: String,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    Box(
        modifier =
            modifier
                .size(ComposerActionButtonSize)
                .clip(CircleShape)
                .background(
                    if (enabled) TelegramMessageUi.AccentBlue
                    else TelegramMessageUi.AccentBlue.copy(alpha = 0.45f),
                )
                .then(
                    if (onClick != null && enabled) {
                        Modifier.clickable(onClick = onClick)
                    } else {
                        Modifier
                    },
                ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = Color.White,
            modifier = Modifier.size(24.dp),
        )
    }
}

private fun formatVoiceTimer(deciseconds: Int): String {
    val secsTotal = deciseconds / 10
    val tenth = deciseconds % 10
    val m = secsTotal / 60
    val s = secsTotal % 60
    return String.format(Locale.US, "%02d:%02d,%d", m, s, tenth)
}

/** Один файл записи за сессию (удержание / отмена / фиксация). */
class VoiceRecordingSession(
    private val context: Context,
    private val onRecordingComplete: (File) -> Unit,
    private val onRecordingCancel: () -> Unit,
) : RecordingComposerSession {
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

    private var mediaRecorder: MediaRecorder? = null
    private var audioFile: File? = null
    private var recordingFinishedNormally = false

    internal fun recorderForMetering(): MediaRecorder? = mediaRecorder

    fun start(): Boolean {
        recordingFinishedNormally = false
        isPaused = false
        try {
            if (
                ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) !=
                android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                Log.e("VoiceRecorder", "RECORD_AUDIO permission not granted")
                return false
            }
            val audioDir = File(context.cacheDir, "voice_messages")
            if (!audioDir.exists()) {
                audioDir.mkdirs()
            }
            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(java.util.Date())
            val file = File(audioDir, "voice_$timestamp.m4a")
            audioFile = file

            val recorder =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    MediaRecorder(context)
                } else {
                    @Suppress("DEPRECATION") MediaRecorder()
                }
            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128000)
                setAudioSamplingRate(44100)
                setOutputFile(file.absolutePath)
                try {
                    prepare()
                    start()
                    isRecording = true
                    elapsedDeciseconds = 0
                    mediaRecorder = recorder
                    Log.d("VoiceRecorder", "Recording started: ${file.absolutePath}")
                    return true
                } catch (e: Exception) {
                    Log.e("VoiceRecorder", "Failed to start recording", e)
                    release()
                    return false
                }
            }
        } catch (e: Exception) {
            Log.e("VoiceRecorder", "Error starting recording", e)
            return false
        }
        return false
    }

    override fun stop(send: Boolean) {
        recordingFinishedNormally = true
        isPaused = false
        try {
            mediaRecorder?.apply {
                try {
                    stop()
                    release()
                } catch (e: Exception) {
                    Log.e("VoiceRecorder", "Error stopping recorder", e)
                }
            }
            mediaRecorder = null
            isRecording = false
            voiceLevelSmoothed = 0f
            if (send && audioFile != null && audioFile!!.exists()) {
                onRecordingComplete(audioFile!!)
            } else {
                audioFile?.delete()
                onRecordingCancel()
            }
            audioFile = null
        } catch (e: Exception) {
            Log.e("VoiceRecorder", "Error stopping recording", e)
            recordingFinishedNormally = true
            runCatching { mediaRecorder?.release() }
            mediaRecorder = null
            audioFile?.delete()
            audioFile = null
            onRecordingCancel()
        }
    }

    override fun togglePause() {
        val r = mediaRecorder ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        try {
            if (isPaused) {
                r.resume()
                isPaused = false
            } else {
                r.pause()
                isPaused = true
            }
        } catch (e: Exception) {
            Log.e("VoiceRecorder", "pause/resume failed", e)
        }
    }

    /** Сброс при уходе с чата без штатного завершения. */
    fun disposeAbandon() {
        if (recordingFinishedNormally) return
        runCatching {
            mediaRecorder?.run {
                try {
                    stop()
                } catch (_: Exception) {
                }
                try {
                    release()
                } catch (_: Exception) {
                }
            }
        }
        mediaRecorder = null
        audioFile?.delete()
        audioFile = null
        isRecording = false
        onRecordingCancel()
        recordingFinishedNormally = true
    }

    override fun bumpElapsedTick() {
        elapsedDeciseconds++
    }

    override fun setVoiceMeter(value: Float) {
        voiceLevelSmoothed = value
    }
}

@Composable
fun VoiceRecordingSessionEffects(session: RecordingComposerSession) {
    LaunchedEffect(session.isRecording, session.isPaused) {
        if (!session.isRecording || session.isPaused) return@LaunchedEffect
        while (session.isRecording && !session.isPaused) {
            delay(100)
            session.bumpElapsedTick()
        }
    }

    LaunchedEffect(session.isRecording, session.isPaused) {
        if (!session.isRecording || session.isPaused) {
            session.setVoiceMeter(0f)
            return@LaunchedEffect
        }
        if (session is VideoNoteRecordingSession) {
            var phase = 0f
            while (session.isRecording && !session.isPaused) {
                delay(40)
                phase += 0.12f
                val w = ((sin(phase.toDouble()).toFloat() * 0.5f + 0.5f) * 0.65f + 0.18f).coerceIn(0.18f, 0.92f)
                session.setVoiceMeter(w)
            }
            return@LaunchedEffect
        }
        val voiceSession = session as VoiceRecordingSession
        var peakDecay = 0f
        var warmup = 0
        while (voiceSession.isRecording && !voiceSession.isPaused) {
            delay(40)
            val r = voiceSession.recorderForMetering() ?: break
            warmup++
            if (warmup < 10) {
                runCatching { r.maxAmplitude }
                continue
            }
            val raw = runCatching { r.maxAmplitude.toFloat() }.getOrElse { 0f }
            // Близко к Telegram WaveDrawable.MAX_AMPLITUDE (~1800 raw → 1.0).
            val norm = (raw / 1800f).coerceIn(0f, 1f)
            peakDecay = kotlin.math.max(norm, peakDecay * 0.92f)
            val target = peakDecay.coerceIn(0f, 1f)
            val smoothed =
                voiceSession.voiceLevelSmoothed + (target - voiceSession.voiceLevelSmoothed) * 0.55f
            voiceSession.setVoiceMeter(smoothed)
        }
    }
}

/**
 * Полоса удержания записи — как Telegram ChatActivityEnterView / RecordCircle:
 * красный таймер слева, «‹ Отмена» уезжает влево, замок появляется при свайпе вверх.
 */
@Composable
fun VoiceRecordingHoldBar(
    session: RecordingComposerSession,
    modifier: Modifier = Modifier,
    cancelProgress: Float = 0f,
    lockProgress: Float = 0f,
) {
    val tgAccent = TelegramMessageUi.AccentBlue
    val tgRed = Color(0xFFE53935)
    val cancel = cancelProgress.coerceIn(0f, 1f)
    val lock = lockProgress.coerceIn(0f, 1f)
    val infiniteTransition = rememberInfiniteTransition(label = "recording_hold")
    val dotAlpha by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 0.35f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(900, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "dot",
    )
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(VoiceComposerBarHeightDp),
    ) {
        Row(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 14.dp)
                    .fillMaxHeight(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(
                            if (session.isPaused) tgRed.copy(alpha = 0.5f)
                            else tgRed.copy(alpha = (dotAlpha * (1f - cancel * 0.55f)).coerceIn(0.2f, 1f)),
                        ),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = formatVoiceTimer(session.elapsedDeciseconds),
                color = Color.White.copy(alpha = (1f - cancel * 0.35f).coerceIn(0.4f, 1f)),
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
            )
        }

        // Slide-to-cancel hint (Telegram: текст уезжает вместе с пальцем).
        Text(
            text = "‹  Отмена",
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .graphicsLayer {
                        translationX = -48f * cancel
                        alpha = (1f - cancel * 1.15f).coerceIn(0f, 1f) * (1f - lock * 0.4f)
                    }
                    .padding(horizontal = 8.dp),
            color = tgAccent,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.2.sp,
            maxLines = 1,
        )

        // Lock affordance — растёт при свайпе вверх.
        Column(
            modifier =
                Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 10.dp)
                    .alpha((0.25f + lock * 0.75f).coerceIn(0.25f, 1f))
                    .graphicsLayer {
                        translationY = 10f * (1f - lock)
                        scaleX = 0.85f + 0.15f * lock
                        scaleY = 0.85f + 0.15f * lock
                    },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = "Закрепить запись",
                tint = if (lock > 0.85f) Color.White else tgAccent.copy(alpha = 0.9f),
                modifier =
                    Modifier
                        .size(18.dp)
                        .then(
                            if (lock > 0.85f) {
                                Modifier
                                    .clip(CircleShape)
                                    .background(tgAccent)
                                    .padding(2.dp)
                            } else {
                                Modifier
                            },
                        ),
            )
            if (lock < 0.55f) {
                Text(
                    text = "↑",
                    color = tgAccent.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/**
 * Закреплённая запись — как на скрине Telegram: таймер слева, «ОТМЕНА» по центру.
 * Справа — send-orb с BlobDrawable-волнами (отдельно в композере).
 */
@Composable
fun VoiceRecordingLockedBar(session: RecordingComposerSession, modifier: Modifier = Modifier) {
    val tgAccent = TelegramMessageUi.AccentBlue
    val tgRed = Color(0xFFE53935)
    val infiniteTransition = rememberInfiniteTransition(label = "recording_locked")
    val dotAlpha by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 0.35f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(900, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "dot",
    )
    BackHandler(enabled = session.isRecording) {
        session.stop(send = false)
    }
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(VoiceComposerBarHeightDp),
    ) {
        Row(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 14.dp)
                    .fillMaxHeight(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(
                            if (session.isPaused) tgRed.copy(alpha = 0.5f)
                            else tgRed.copy(alpha = dotAlpha),
                        ),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = formatVoiceTimer(session.elapsedDeciseconds),
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
            )
        }
        Text(
            text = "ОТМЕНА",
            color = tgAccent,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .clickable { session.stop(send = false) }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
        )
    }
}

/** Живая полоска амплитуды во время записи (Telegram-подобная). */
@Composable
private fun VoiceLiveWaveform(
    level: Float,
    paused: Boolean,
    color: Color,
    modifier: Modifier = Modifier,
    barCount: Int = 28,
) {
    val bars = remember { mutableStateListOf<Float>().apply { repeat(barCount) { add(0.12f) } } }
    LaunchedEffect(level, paused) {
        if (paused) return@LaunchedEffect
        while (true) {
            val peak = level.coerceIn(0f, 1f)
            val next = FloatArray(barCount) { i ->
                val falloff = 1f - (i.toFloat() / barCount) * 0.35f
                val wobble = (0.55f + 0.45f * sin(i * 0.9f + peak * 9f)).toFloat()
                (0.1f + peak * falloff * wobble).coerceIn(0.08f, 1f)
            }
            // Сдвиг влево — как бегущая волна Telegram.
            for (i in 0 until barCount - 1) {
                bars[i] = bars[i + 1] * 0.82f + next[i] * 0.18f
            }
            bars[barCount - 1] = next[barCount - 1]
            delay(42)
        }
    }
    Canvas(modifier = modifier) {
        val gap = 2.dp.toPx()
        val barW = ((size.width - gap * (barCount - 1)) / barCount).coerceAtLeast(1.5.dp.toPx())
        val midY = size.height / 2f
        for (i in 0 until barCount) {
            val h = size.height * bars.getOrElse(i) { 0.12f }
            val x = i * (barW + gap)
            drawRoundRect(
                color = color.copy(alpha = if (paused) 0.35f else 0.85f),
                topLeft = androidx.compose.ui.geometry.Offset(x, midY - h / 2f),
                size = androidx.compose.ui.geometry.Size(barW, h),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barW / 2f, barW / 2f),
            )
        }
    }
}

@Composable
fun ComposerRecordingPauseFab(
    session: RecordingComposerSession,
    modifier: Modifier = Modifier,
) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N || !session.supportsPauseWhileRecording) return
    val pauseLabel = if (session.isPaused) "Продолжить" else "Пауза"
    Box(
        modifier =
            modifier
                .size(VoicePauseFloatingSize)
                .semantics { contentDescription = pauseLabel }
                .clip(CircleShape)
                .background(TelegramMessageUi.PeerBubbleEnd)
                .clickable(onClick = { session.togglePause() }),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = if (session.isPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
fun ComposerRecordingSendOrb(
    session: RecordingComposerSession,
    modifier: Modifier = Modifier,
) {
    val voiceLevelDisplayed by animateFloatAsState(
        targetValue = session.voiceLevelSmoothed.coerceIn(0f, 1f),
        animationSpec = tween(45, easing = LinearEasing),
        label = "voiceMeterUi",
    )
    ComposerHoldActionOrb(
        voiceLevel = voiceLevelDisplayed,
        centerIcon = Icons.Default.Send,
        centerContentDescription = "Отправить",
        interactive = true,
        onClick = { session.stop(send = true) },
        modifier = modifier,
    )
}

/** Микрофон / камера с волновыми кольцами при удержании записи. */
@Composable
fun VoiceMicOrbWithWaveRings(
    voiceLevel: Float,
    modifier: Modifier = Modifier,
    accentColor: Color = TelegramMessageUi.AccentBlue,
    centerIcon: ImageVector = Icons.Default.Mic,
    centerContentDescription: String = "Микрофон",
) {
    ComposerHoldActionOrb(
        voiceLevel = voiceLevel,
        centerIcon = centerIcon,
        centerContentDescription = centerContentDescription,
        modifier = modifier,
    )
}

@Composable
fun ComposerHoldActionOrb(
    voiceLevel: Float,
    centerIcon: ImageVector,
    centerContentDescription: String,
    modifier: Modifier = Modifier,
    interactive: Boolean = false,
    onClick: () -> Unit = {},
) {
    TelegramRecordWaveOrb(
        voiceLevel = voiceLevel,
        accentColor = TelegramMessageUi.AccentBlue,
        centerIcon = centerIcon,
        centerContentDescription = centerContentDescription,
        interactive = interactive,
        onClick = onClick,
        modifier = modifier,
    )
}

/**
 * Индикатор записи как Telegram `RecordCircle`:
 * - синий круг растёт: radius = 41dp + 30dp × amplitude
 * - две BlobDrawable-волны (α 0.30 / 0.15), scale = SCALE_*_MIN + 1.4 × amp
 */
@Composable
private fun TelegramRecordWaveOrb(
    voiceLevel: Float,
    accentColor: Color,
    centerIcon: ImageVector,
    centerContentDescription: String?,
    interactive: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = androidx.compose.ui.platform.LocalDensity.current
    // Константы из ChatActivityEnterView.RecordCircle
    val circleRadiusPx = with(density) { 41.dp.toPx() }
    val circleRadiusAmplitudePx = with(density) { 30.dp.toPx() }

    val bigBlob =
        remember(density) {
            TelegramBlobDrawable(12).apply {
                // RecordCircle: min=50, max=50+12*FORM_BIG_MAX
                minRadius = with(density) { 50.dp.toPx() }
                maxRadius = with(density) { (50.dp + 12.dp * TelegramBlobDrawable.FORM_BIG_MAX).toPx() }
                generateBlob()
            }
        }
    val tinyBlob =
        remember(density) {
            TelegramBlobDrawable(11).apply {
                minRadius = with(density) { 47.dp.toPx() }
                maxRadius = with(density) { (47.dp + 15.dp * TelegramBlobDrawable.FORM_SMALL_MAX).toPx() }
                generateBlob()
            }
        }
    val bigPath = remember { Path() }
    val tinyPath = remember { Path() }
    var frameTick by remember { mutableIntStateOf(0) }
    var wavesEnter by remember { mutableFloatStateOf(0f) }
    var ampCircle by remember { mutableFloatStateOf(0f) }
    var ampBig by remember { mutableFloatStateOf(0f) }
    var ampTiny by remember { mutableFloatStateOf(0f) }
    var idleProgress by remember { mutableFloatStateOf(0f) }
    var idleInc by remember { mutableStateOf(true) }

    val targetLevel = voiceLevel.coerceIn(0f, 1f)
    LaunchedEffect(targetLevel) {
        var last = 0L
        // Сглаживание амплитуды круга — как animateAmplitudeDiff в RecordCircle.
        var circleAmp = 0f
        var circleTarget = 0f
        var circleDiff = 0f
        while (true) {
            withFrameMillis { now ->
                val dt = if (last == 0L) 16L else (now - last).coerceIn(1L, 32L)
                last = now

                circleTarget = targetLevel
                val animSpeedCircle = 1f - 0.45f
                circleDiff = (circleTarget - circleAmp) / (100f + 500f * animSpeedCircle)
                circleAmp = (circleAmp + circleDiff * dt).let {
                    if (circleDiff > 0f) it.coerceAtMost(circleTarget) else it.coerceAtLeast(circleTarget)
                }
                ampCircle = circleAmp

                bigBlob.setValue(targetLevel, isBig = true)
                tinyBlob.setValue(targetLevel, isBig = false)
                bigBlob.updateAmplitude(dt)
                tinyBlob.updateAmplitude(dt)
                // RecordCircle: update radii each frame from FORM_* then update blobs
                bigBlob.minRadius = with(density) { 50.dp.toPx() }
                bigBlob.maxRadius =
                    with(density) { (50.dp + 12.dp * TelegramBlobDrawable.FORM_BIG_MAX).toPx() }
                tinyBlob.minRadius = with(density) { 47.dp.toPx() }
                tinyBlob.maxRadius =
                    with(density) { (47.dp + 15.dp * TelegramBlobDrawable.FORM_SMALL_MAX).toPx() }
                bigBlob.update(bigBlob.amplitude, 1.01f)
                tinyBlob.update(tinyBlob.amplitude, 1.02f)
                ampBig = bigBlob.amplitude
                ampTiny = tinyBlob.amplitude

                // idleProgress 0↔1 — лёгкое «дыхание» даже в тишине
                if (idleInc) {
                    idleProgress = (idleProgress + 0.01f * (dt / 16f)).coerceAtMost(1f)
                    if (idleProgress >= 1f) idleInc = false
                } else {
                    idleProgress = (idleProgress - 0.01f * (dt / 16f)).coerceAtLeast(0f)
                    if (idleProgress <= 0f) idleInc = true
                }

                if (wavesEnter < 1f) {
                    wavesEnter = (wavesEnter + 0.04f * (dt / 16f)).coerceAtMost(1f)
                }
                frameTick++
            }
        }
    }

    val enter =
        remember(wavesEnter) {
            val u = 1f - wavesEnter
            1f - u * u * u // EASE_OUT
        }
    // RecordCircle.drawWaves: SCALE_*_MIN + 1.4f * amplitude
    val scaleBig =
        (TelegramBlobDrawable.SCALE_BIG_MIN + 1.4f * ampBig) * enter
    val scaleTiny =
        (TelegramBlobDrawable.SCALE_SMALL_MIN + 1.4f * ampTiny) * enter

    // radius = (circleRadius + circleRadiusAmplitude * amplitude)
    // + лёгкий idle pulse ~2dp
    val idlePulsePx = with(density) { 2.dp.toPx() } * idleProgress * (1f - ampCircle)
    val buttonRadiusPx =
        (circleRadiusPx + circleRadiusAmplitudePx * ampCircle + idlePulsePx)
    val buttonSizeDp = with(density) { (buttonRadiusPx * 2f).toDp() }

    Box(
        modifier = modifier.size(ComposerHoldOrbOuterDp),
        contentAlignment = Alignment.Center,
    ) {
        TelegramBlobLayer(
            blob = bigBlob,
            path = bigPath,
            scale = scaleBig,
            color = accentColor.copy(alpha = TelegramBlobDrawable.CIRCLE_ALPHA_BIG),
            frameTick = frameTick,
            modifier = Modifier.fillMaxSize(),
        )
        TelegramBlobLayer(
            blob = tinyBlob,
            path = tinyPath,
            scale = scaleTiny,
            color = accentColor.copy(alpha = TelegramBlobDrawable.CIRCLE_ALPHA_TINY),
            frameTick = frameTick,
            modifier = Modifier.fillMaxSize(),
        )

        // Растущая синяя кнопка — главное отличие RecordCircle от статичного FAB.
        Box(
            modifier =
                Modifier
                    .size(buttonSizeDp)
                    .clip(CircleShape)
                    .background(accentColor)
                    .clickable(enabled = interactive, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = centerIcon,
                contentDescription = centerContentDescription,
                tint = Color.White,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

@Composable
private fun TelegramBlobLayer(
    blob: TelegramBlobDrawable,
    path: Path,
    scale: Float,
    color: Color,
    frameTick: Int,
    modifier: Modifier = Modifier,
) {
    Canvas(
        modifier =
            modifier.graphicsLayer {
                scaleX = scale.coerceAtLeast(0.01f)
                scaleY = scale.coerceAtLeast(0.01f)
                this.alpha = color.alpha.coerceIn(0f, 1f)
            },
    ) {
        @Suppress("UNUSED_EXPRESSION")
        frameTick
        val cx = size.width / 2f
        val cy = size.height / 2f
        blob.buildPath(cx, cy, path)
        drawPath(path = path, color = color.copy(alpha = 1f))
    }
}
