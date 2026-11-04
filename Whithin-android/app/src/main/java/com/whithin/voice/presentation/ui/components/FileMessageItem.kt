package com.whithin.voice.presentation.ui.components

import com.whithin.voice.presentation.ui.components.AppText as Text

import android.app.DownloadManager
import android.content.Context
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.whithin.voice.data.model.MediaFile

@Composable
fun FileMessageItem(
    mediaFile: MediaFile,
    modifier: Modifier = Modifier,
    onDownload: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val fileUrl = buildMediaUrl(mediaFile.filePathValue)
    val fileName = mediaFile.displayNameValue
    val fileSize = formatFileSize(mediaFile.fileSize)
    val icon = resolveFileIcon(fileName, mediaFile.contentTypeValue)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.Black.copy(alpha = 0.18f))
            .clickable {
                if (onDownload != null) {
                    onDownload()
                } else {
                    downloadFile(context, fileUrl, fileName)
                }
            }
            .padding(horizontal = 10.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = "File",
                tint = Color.White.copy(alpha = 0.88f)
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = fileName,
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = fileSize,
                color = Color.White.copy(alpha = 0.64f),
                fontSize = 11.sp
            )
        }
        Icon(
            imageVector = Icons.Default.Download,
            contentDescription = "Download",
            tint = TelegramMessageUi.AccentBlue,
            modifier = Modifier.size(20.dp)
        )
    }
}

private fun downloadFile(
    context: Context,
    url: String,
    fileName: String
) {
    try {
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(fileName)
            .setDescription("Скачивание файла")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setMimeType("*/*")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)

        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        manager.enqueue(request)
        Toast.makeText(context, "Скачивание началось", Toast.LENGTH_SHORT).show()
    } catch (_: Exception) {
        // Fallback for restricted environments/devices
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(context, "Не удалось скачать файл", Toast.LENGTH_SHORT).show()
        }
    }
}

private fun buildMediaUrl(filePath: String?): String {
    val path = filePath ?: ""
    return when {
        path.startsWith("http://") || path.startsWith("https://") -> path
        path.startsWith("content://") || path.startsWith("file://") -> path
        path.startsWith("/uploads/") -> "https://whithin.ru$path"
        path.startsWith("uploads/") -> "https://whithin.ru/$path"
        else -> "https://whithin.ru/uploads/$path"
    }
}

private fun resolveFileIcon(
    fileName: String,
    contentType: String?
): androidx.compose.ui.graphics.vector.ImageVector {
    val lower = fileName.lowercase()
    return when {
        contentType?.startsWith("application/pdf") == true || lower.endsWith(".pdf") -> Icons.Default.PictureAsPdf
        lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z") || lower.endsWith(".tar") || lower.endsWith(".gz") -> Icons.Default.Archive
        lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv") -> Icons.Default.TableChart
        else -> Icons.Default.Description
    }
}

private fun formatFileSize(bytes: Long?): String {
    val b = bytes ?: return "Unknown size"
    if (b <= 0L) return "0 B"
    val units = listOf("B", "KB", "MB", "GB")
    var value = b.toDouble()
    var idx = 0
    while (value >= 1024 && idx < units.lastIndex) {
        value /= 1024.0
        idx++
    }
    return String.format("%.1f %s", value, units[idx])
}
