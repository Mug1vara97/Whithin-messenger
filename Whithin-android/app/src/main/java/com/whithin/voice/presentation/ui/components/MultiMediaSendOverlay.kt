package com.whithin.voice.presentation.ui.components

import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.whithin.voice.presentation.ui.media.sizedImageRequest
import com.whithin.voice.presentation.ui.components.AppText as Text

const val MAX_BATCH_MEDIA_COUNT = 10

private data class MediaStoreUriInfo(
    val mimeType: String?,
    val mediaType: Int?,
)

private fun queryMediaStoreUriInfo(context: Context, uri: Uri): MediaStoreUriInfo? {
    if (uri.scheme != "content") return null
    return runCatching {
        context.contentResolver.query(
            uri,
            arrayOf(
                MediaStore.Files.FileColumns.MIME_TYPE,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
            ),
            null,
            null,
            null,
        )?.use { cursor ->
            if (!cursor.moveToFirst()) return@use null
            val mimeIdx = cursor.getColumnIndex(MediaStore.Files.FileColumns.MIME_TYPE)
            val typeIdx = cursor.getColumnIndex(MediaStore.Files.FileColumns.MEDIA_TYPE)
            MediaStoreUriInfo(
                mimeType = if (mimeIdx >= 0) cursor.getString(mimeIdx) else null,
                mediaType = if (typeIdx >= 0 && !cursor.isNull(typeIdx)) cursor.getInt(typeIdx) else null,
            )
        }
    }.getOrNull()
}

internal fun isBatchSendableUri(context: Context, uri: Uri): Boolean {
    val storeInfo = queryMediaStoreUriInfo(context, uri)
    when (storeInfo?.mediaType) {
        MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE,
        MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO,
        -> return true
        MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO -> return false
    }

    val mime =
        (
            storeInfo?.mimeType
                ?: runCatching { context.contentResolver.getType(uri) }.getOrNull()
                ?: inferMimeTypeFromUri(uri)
        )?.lowercase().orEmpty()

    if (mime.startsWith("audio/")) {
        Log.d("BatchMedia", "Excluded audio uri=$uri mime=$mime")
        return false
    }
    return true
}

fun filterBatchSendableUris(context: Context, uris: List<Uri>): List<Uri> {
    return uris
        .distinct()
        .filter { uri -> isBatchSendableUri(context, uri) }
        .take(MAX_BATCH_MEDIA_COUNT)
}

private fun batchFilesCountLabel(count: Int): String {
    val mod10 = count % 10
    val mod100 = count % 100
    val noun =
        when {
            mod10 == 1 && mod100 != 11 -> "файл"
            mod10 in 2..4 && mod100 !in 12..14 -> "файла"
            else -> "файлов"
        }
    return "$count $noun"
}

@Composable
fun MultiMediaSendOverlay(
    items: List<PendingMediaSend>,
    chatTitle: String,
    onDismiss: () -> Unit,
    onSend: (caption: String) -> Unit,
) {
    var caption by remember(items) { mutableStateOf("") }

    BackHandler(onBack = onDismiss)

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color.Black),
    ) {
        Column(Modifier.fillMaxSize()) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .background(Color.Black.copy(alpha = 0.55f))
                        .padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = Color.White)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = chatTitle,
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = batchFilesCountLabel(items.size),
                        color = Color(0xFF8E8E93),
                        fontSize = 13.sp,
                    )
                }
            }

            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                contentPadding = PaddingValues(bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(items, key = { it.uri.toString() }) { item ->
                    BatchMediaPreviewTile(item = item)
                }
            }
        }

        Row(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars))
                    .background(Color(0xE6000000))
                    .padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextField(
                value = caption,
                onValueChange = { caption = it },
                modifier = Modifier.weight(1f),
                placeholder = {
                    Text("Добавить подпись…", color = Color(0xFF8E8E93))
                },
                singleLine = false,
                maxLines = 4,
                shape = RoundedCornerShape(24.dp),
                colors =
                    TextFieldDefaults.colors(
                        focusedContainerColor = Color(0xFF1C1C1E),
                        unfocusedContainerColor = Color(0xFF1C1C1E),
                        disabledContainerColor = Color(0xFF1C1C1E),
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        disabledIndicatorColor = Color.Transparent,
                        cursorColor = TelegramMessageUi.AccentBlue,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                    ),
            )
            FloatingActionButton(
                onClick = { onSend(caption.trim()) },
                modifier = Modifier.padding(start = 8.dp),
                containerColor = TelegramMessageUi.AccentBlue,
                contentColor = Color.White,
            ) {
                Icon(Icons.Default.Send, contentDescription = "Отправить")
            }
        }
    }
}

@Composable
private fun BatchMediaPreviewTile(item: PendingMediaSend) {
    val mime = item.mimeType.orEmpty().lowercase()
    val isImage = mime.startsWith("image/") || inferMimeTypeFromUri(item.uri)?.startsWith("image/") == true
    val isVideo = mime.startsWith("video/")

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF1C1C1E)),
        contentAlignment = Alignment.Center,
    ) {
        val context = LocalContext.current
        val thumbPx = with(LocalDensity.current) { 160.dp.roundToPx() }
        val thumbRequest =
            remember(item.uri, thumbPx) {
                sizedImageRequest(context, item.uri, thumbPx)
            }
        when {
            isImage -> {
                AsyncImage(
                    model = thumbRequest,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            isVideo -> {
                AsyncImage(
                    model = thumbRequest,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomStart)
                            .padding(6.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.Black.copy(alpha = 0.55f))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    Text("Видео", color = Color.White, fontSize = 10.sp)
                }
            }
            else -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.padding(8.dp),
                ) {
                    Icon(
                        Icons.Default.AttachFile,
                        contentDescription = null,
                        tint = TelegramMessageUi.AccentBlue,
                        modifier = Modifier.size(28.dp),
                    )
                    Text(
                        text = item.displayName ?: "Файл",
                        color = Color.White,
                        fontSize = 11.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
