package com.whithin.voice.presentation.ui.components

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.RotateRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale
import kotlinx.coroutines.launch

@Composable
fun ImageEditOverlay(
    imageUri: Uri,
    onCancel: () -> Unit,
    onDone: (Uri) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var straightenDegrees by remember(imageUri) { mutableFloatStateOf(0f) }
    var quarterTurns by remember(imageUri) { mutableIntStateOf(0) }
    var mirrored by remember(imageUri) { mutableStateOf(false) }
    var cropRect by remember(imageUri) { mutableStateOf<Rect?>(null) }
    var imageSourceSize by remember(imageUri) { mutableStateOf<Size?>(null) }
    var previewBitmap by remember(imageUri) { mutableStateOf<Bitmap?>(null) }
    var exporting by remember { mutableStateOf(false) }
    var currentTransform by remember(imageUri) { mutableStateOf<ImageEditTransform?>(null) }

    LaunchedEffect(imageUri) {
        previewBitmap?.recycle()
        previewBitmap = null
        imageSourceSize = null
        cropRect = null
        runCatching {
            val bitmap = ImageEditExporter.loadPreviewBitmap(context, imageUri)
            previewBitmap = bitmap
            imageSourceSize = Size(bitmap.width.toFloat(), bitmap.height.toFloat())
        }
    }

    DisposableEffect(imageUri) {
        onDispose {
            previewBitmap?.recycle()
            previewBitmap = null
        }
    }

    BackHandler(onBack = onCancel)

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color.Black),
    ) {
        Column(Modifier.fillMaxSize()) {
            BoxWithConstraints(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .statusBarsPadding(),
            ) {
                val viewWidthPx = constraints.maxWidth.toFloat()
                val imageAreaHeightPx = constraints.maxHeight.toFloat()
                val imageBounds =
                    remember(
                        viewWidthPx,
                        imageAreaHeightPx,
                        imageSourceSize,
                        quarterTurns,
                        straightenDegrees,
                        mirrored,
                    ) {
                        val sourceW = imageSourceSize?.width?.takeIf { it > 0f } ?: viewWidthPx
                        val sourceH = imageSourceSize?.height?.takeIf { it > 0f } ?: imageAreaHeightPx
                        ImageTransformMath.computeDisplayedBounds(
                            viewWidth = viewWidthPx,
                            viewHeight = imageAreaHeightPx,
                            sourceWidth = sourceW,
                            sourceHeight = sourceH,
                            quarterTurns = quarterTurns,
                            straightenDegrees = straightenDegrees,
                            mirrored = mirrored,
                        )
                    }
                LaunchedEffect(imageBounds, quarterTurns, mirrored) {
                    cropRect = imageBounds
                }

                LaunchedEffect(straightenDegrees, imageBounds) {
                    cropRect =
                        cropRect?.coerceInBounds(
                            bounds = imageBounds,
                            minSize = 96f,
                        ) ?: imageBounds
                }

                val activeCropRect = cropRect ?: imageBounds

                SideEffect {
                    currentTransform =
                        ImageEditTransform(
                            viewWidth = viewWidthPx,
                            imageAreaHeight = imageAreaHeightPx,
                            cropRect = activeCropRect,
                            straightenDegrees = straightenDegrees,
                            quarterTurns = quarterTurns,
                            mirrored = mirrored,
                        )
                }

                Box(Modifier.fillMaxSize().clipToBounds()) {
                    val bitmap = previewBitmap
                    if (bitmap != null) {
                        TransformedImagePreview(
                            bitmap = bitmap,
                            viewWidth = viewWidthPx,
                            viewHeight = imageAreaHeightPx,
                            quarterTurns = quarterTurns,
                            straightenDegrees = straightenDegrees,
                            mirrored = mirrored,
                        )
                    } else {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(
                                color = TelegramMessageUi.AccentBlue,
                                strokeWidth = 2.dp,
                            )
                        }
                    }

                    DraggableCropFrame(
                        cropRect = activeCropRect,
                        mediaBounds = imageBounds,
                        onChange = { nextRect ->
                            cropRect =
                                nextRect.coerceInBounds(
                                    bounds = imageBounds,
                                    minSize = 96f,
                                )
                        },
                    )
                }
            }

            ImageEditControls(
                straightenDegrees = straightenDegrees,
                onStraightenChange = { straightenDegrees = it },
                onMirror = { mirrored = !mirrored },
                onRotateQuarter = {
                    quarterTurns = (quarterTurns + 1) % 4
                    straightenDegrees = 0f
                },
            )

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .windowInsetsPadding(WindowInsets.navigationBars)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onCancel, enabled = !exporting) {
                    AppText(
                        text = "ОТМЕНА",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.5.sp,
                    )
                }
                TextButton(
                    onClick = {
                        straightenDegrees = 0f
                        quarterTurns = 0
                        mirrored = false
                    },
                    enabled = !exporting,
                ) {
                    AppText(
                        text = "СБРОС",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.5.sp,
                    )
                }
                if (exporting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(28.dp),
                        color = TelegramMessageUi.AccentBlue,
                        strokeWidth = 2.dp,
                    )
                } else {
                    TextButton(
                        onClick = {
                            val transform = currentTransform ?: return@TextButton
                            exporting = true
                            scope.launch {
                                runCatching {
                                    ImageEditExporter.export(
                                        context = context,
                                        sourceUri = imageUri,
                                        transform = transform,
                                    )
                                }.onSuccess { onDone(it) }
                                    .onFailure { exporting = false }
                            }
                        },
                    ) {
                        AppText(
                            text = "ГОТОВО",
                            color = TelegramMessageUi.AccentBlue,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.5.sp,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ImageEditControls(
    straightenDegrees: Float,
    onStraightenChange: (Float) -> Unit,
    onMirror: () -> Unit,
    onRotateQuarter: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF111111))
                .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        AppText(
            text = String.format(Locale.getDefault(), "%.1f°", straightenDegrees),
            color = Color.White,
            fontSize = 13.sp,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onMirror) {
                AppText(
                    text = "ЗЕРКАЛО",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
            Box(modifier = Modifier.weight(1f)) {
                StraightenRuler(straightenDegrees = straightenDegrees)
                Slider(
                    value = straightenDegrees,
                    onValueChange = onStraightenChange,
                    valueRange = -45f..45f,
                    modifier = Modifier.fillMaxWidth(),
                    colors =
                        SliderDefaults.colors(
                            thumbColor = Color.Transparent,
                            activeTrackColor = Color.Transparent,
                            inactiveTrackColor = Color.Transparent,
                        ),
                )
            }
            IconButton(onClick = onRotateQuarter) {
                Icon(
                    Icons.Default.RotateRight,
                    contentDescription = "Повернуть на 90°",
                    tint = Color.White,
                )
            }
        }
    }
}

@Composable
private fun StraightenRuler(straightenDegrees: Float) {
    val accentBlue = TelegramMessageUi.AccentBlue
    Canvas(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(28.dp),
    ) {
        val tickCount = 45
        for (i in 0..tickCount) {
            val x = i / tickCount.toFloat() * size.width
            val isCenter = i == tickCount / 2
            val tickHeight = if (isCenter) size.height else size.height * 0.55f
            drawLine(
                color = if (isCenter) accentBlue else Color.White.copy(alpha = 0.35f),
                start = Offset(x, size.height - tickHeight),
                end = Offset(x, size.height),
                strokeWidth = if (isCenter) 2.5f else 1.5f,
            )
        }
        val markerX = ((straightenDegrees + 45f) / 90f).coerceIn(0f, 1f) * size.width
        drawLine(
            color = accentBlue,
            start = Offset(markerX, 0f),
            end = Offset(markerX, size.height),
            strokeWidth = 2.5f,
        )
    }
}

