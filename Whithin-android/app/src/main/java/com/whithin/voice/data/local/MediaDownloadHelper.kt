package com.whithin.voice.data.local

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.webkit.MimeTypeMap
import android.widget.Toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

enum class MediaSaveTarget {
    GALLERY,
    DOWNLOADS,
}

@Singleton
class MediaDownloadHelper @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val tokenManager: TokenManager,
) {
    suspend fun saveMedia(
        context: Context,
        filePath: String,
        contentType: String,
        displayName: String,
        target: MediaSaveTarget,
    ): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val bytes = downloadBytes(context, filePath)
                val safeName = sanitizeFileName(displayName.ifBlank { filePath.substringAfterLast('/') })
                when (target) {
                    MediaSaveTarget.GALLERY -> saveToGallery(context, bytes, contentType, safeName)
                    MediaSaveTarget.DOWNLOADS -> saveToDownloads(context, bytes, contentType, safeName)
                }
            }
        }

    /** Downloads media into [destination], trying API auth URL first then public /uploads. */
    suspend fun downloadToCacheFile(filePath: String, destination: File): Result<File> =
        withContext(Dispatchers.IO) {
            runCatching {
                val bytes = downloadBytesForPath(filePath)
                destination.parentFile?.mkdirs()
                destination.outputStream().use { it.write(bytes) }
                destination
            }
        }

    private suspend fun downloadBytes(context: Context, filePath: String): ByteArray {
        return downloadBytesForPath(filePath, context)
    }

    private suspend fun downloadBytesForPath(
        filePath: String,
        context: Context? = null,
    ): ByteArray {
        val storagePath = normalizeStoragePath(filePath)
        if (storagePath.isBlank()) {
            error("Путь к файлу пустой")
        }

        if (storagePath.startsWith("content://") || storagePath.startsWith("file://")) {
            val ctx = context ?: error("Context required for local URI")
            return readLocalUri(ctx, storagePath)
        }

        val token = tokenManager.getToken()
        downloadViaApi(storagePath, token)?.let { return it }
        downloadViaPublicUrl(storagePath)?.let { return it }

        error("Не удалось скачать файл")
    }

    private fun readLocalUri(context: Context, uriString: String): ByteArray {
        val uri = Uri.parse(uriString)
        context.contentResolver.openInputStream(uri)?.use { input ->
            return input.readBytes()
        } ?: error("Не удалось прочитать файл")
    }

    private fun downloadViaApi(storagePath: String, token: String?): ByteArray? {
        val url =
            BASE_URL.toHttpUrl()
                .newBuilder()
                .addPathSegments("api/media/download")
                .addQueryParameter("filePath", storagePath)
                .build()
        return executeDownload(url.toString(), token = token, label = "api")
    }

    private fun downloadViaPublicUrl(storagePath: String): ByteArray? {
        val publicPath = storagePath.trimStart('/')
        val url = "$BASE_URL/$publicPath"
        return executeDownload(url, token = null, label = "public")
    }

    private fun executeDownload(url: String, token: String?, label: String): ByteArray? {
        val request =
            Request.Builder()
                .url(url)
                .apply {
                    if (!token.isNullOrBlank()) {
                        header("Authorization", "Bearer $token")
                    }
                }
                .build()
        return try {
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.w(TAG, "Download ($label) failed: HTTP ${response.code} for $url")
                    return null
                }
                response.body?.bytes()?.takeIf { it.isNotEmpty() }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Download ($label) error for $url", e)
            null
        }
    }

    /** Converts API paths, /uploads/... and full URLs to `uploads/...` storage keys. */
    internal fun normalizeStoragePath(filePath: String): String {
        var path = filePath.trim()
        if (path.isBlank()) return ""

        if (path.startsWith("content://") || path.startsWith("file://")) {
            return path
        }

        if (path.startsWith("http://") || path.startsWith("https://")) {
            val uri = Uri.parse(path)
            path = uri.path?.trim().orEmpty().trimStart('/')
        } else {
            path = path.trimStart('/')
        }

        if (path.startsWith("uploads/")) {
            return path
        }

        // Some records store only the folder/file segment without the uploads prefix.
        return if (path.contains("/")) {
            "uploads/$path"
        } else {
            "uploads/$path"
        }
    }

    private fun saveToGallery(
        context: Context,
        bytes: ByteArray,
        contentType: String,
        fileName: String,
    ): String {
        val isVideo = contentType.startsWith("video/")
        val resolver = context.contentResolver
        val values =
            ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, contentType.ifBlank { guessMime(fileName) })
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val relativePath =
                        if (isVideo) {
                            "${Environment.DIRECTORY_MOVIES}/Whithin"
                        } else {
                            "${Environment.DIRECTORY_PICTURES}/Whithin"
                        }
                    put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }
        val collection =
            if (isVideo) {
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            } else {
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            }
        val uri = resolver.insert(collection, values) ?: error("Не удалось создать файл")
        resolver.openOutputStream(uri)?.use { it.write(bytes) }
            ?: error("Не удалось записать файл")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        }
        return uri.toString()
    }

    private fun saveToDownloads(
        context: Context,
        bytes: ByteArray,
        contentType: String,
        fileName: String,
    ): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = context.contentResolver
            val values =
                ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, contentType.ifBlank { guessMime(fileName) })
                    put(
                        MediaStore.MediaColumns.RELATIVE_PATH,
                        "${Environment.DIRECTORY_DOWNLOADS}/Whithin",
                    )
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            val uri =
                resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: error("Не удалось создать файл")
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: error("Не удалось записать файл")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return uri.toString()
        }

        @Suppress("DEPRECATION")
        val downloadsDir =
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val outFile = File(File(downloadsDir, "Whithin").apply { mkdirs() }, fileName)
        outFile.outputStream().use { it.write(bytes) }
        return outFile.absolutePath
    }

    private fun sanitizeFileName(name: String): String =
        name.replace(Regex("""[\\/:*?"<>|]"""), "_").ifBlank { "file" }

    private fun guessMime(fileName: String): String {
        val ext = fileName.substringAfterLast('.', "").lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
    }

    fun showResultToast(context: Context, result: Result<String>, target: MediaSaveTarget) {
        result
            .onSuccess {
                val message =
                    when (target) {
                        MediaSaveTarget.GALLERY -> "Сохранено в галерею"
                        MediaSaveTarget.DOWNLOADS -> "Сохранено в загрузки"
                    }
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
            .onFailure { error ->
                Toast.makeText(
                    context,
                    error.message ?: "Не удалось сохранить файл",
                    Toast.LENGTH_SHORT,
                ).show()
            }
    }

    companion object {
        private const val TAG = "MediaDownloadHelper"
        private const val BASE_URL = "https://whithin.ru"
    }
}
