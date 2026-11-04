package com.whithin.voice.data.repository

import android.net.Uri
import android.util.Log
import com.whithin.voice.data.api.MediaApi
import com.whithin.voice.data.api.UploadMediaBatchResponse
import com.whithin.voice.data.api.UploadMediaResponse
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream

internal class ChatMediaUploadHelper(
    private val mediaApi: MediaApi,
) {
    suspend fun uploadMedia(
        chatId: String,
        fileUri: Uri,
        context: android.content.Context,
        username: String? = null,
        caption: String? = null,
        isVideoNote: Boolean = false,
    ): Result<UploadMediaResponse> {
        return try {
            Log.d("ChatRepository", "Uploading media for chatId: $chatId")
        
            // Get file from URI
            val inputStream = context.contentResolver.openInputStream(fileUri)
                ?: return Result.failure(Exception("Cannot open file"))
        
            // Get original file name first (needed for temp file extension)
            var fileName = "upload_${System.currentTimeMillis()}.tmp"
        
            // Handle file:// URIs (from File objects)
            if (fileUri.scheme == "file") {
                val file = File(fileUri.path ?: "")
                if (file.exists()) {
                    fileName = file.name
                    Log.d("ChatRepository", "File URI detected, using file name: $fileName")
                }
            } else {
                // For content:// URIs, query content resolver
                context.contentResolver.query(fileUri, null, null, null, null)?.use { cursor ->
                    val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (cursor.moveToFirst() && nameIndex >= 0) {
                        val originalName = cursor.getString(nameIndex)
                        if (!originalName.isNullOrEmpty()) {
                            fileName = originalName
                            Log.d("ChatRepository", "Original file name from content resolver: $fileName")
                        }
                    }
                }
            }
            Log.d("ChatRepository", "Using file name: $fileName")
        
            // Create temporary file - preserve original extension if possible
            val tempFileName = if (fileName.contains('.')) {
                val extension = fileName.substringAfterLast('.')
                "upload_${System.currentTimeMillis()}.$extension"
            } else {
                "upload_${System.currentTimeMillis()}.tmp"
            }
            val tempFile = File(context.cacheDir, tempFileName)
        
            // Copy file using buffered streams for better performance and reliability
            var bytesCopied = 0L
            BufferedInputStream(inputStream, 8192).use { bufferedInput ->
                BufferedOutputStream(FileOutputStream(tempFile), 8192).use { bufferedOutput ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    while (bufferedInput.read(buffer).also { bytesRead = it } != -1) {
                        bufferedOutput.write(buffer, 0, bytesRead)
                        bytesCopied += bytesRead
                    }
                    bufferedOutput.flush()
                }
            }
        
            // Verify file was copied correctly
            val fileSize = tempFile.length()
            if (fileSize != bytesCopied) {
                Log.w("ChatRepository", "File size mismatch: expected $bytesCopied, got $fileSize")
                // Still try to upload, but log the warning
            }
        
            if (fileSize == 0L) {
                Log.e("ChatRepository", "File is empty after copy!")
                tempFile.delete()
                return Result.failure(Exception("File is empty"))
            }
        
            Log.d("ChatRepository", "File copied: $bytesCopied bytes to ${tempFile.absolutePath}, size=$fileSize")
        
            // Get MIME type - try contentResolver first, then fallback to extension
            var mimeType = if (fileUri.scheme == "file") {
                // For file:// URIs, contentResolver.getType() may not work, so we'll determine from extension
                null
            } else {
                context.contentResolver.getType(fileUri)
            }
            val extension = fileName.substringAfterLast('.', "").lowercase()
        
            if (mimeType.isNullOrEmpty() || mimeType == "application/octet-stream") {
                // Fallback: determine MIME type from file extension
                mimeType = when (extension) {
                    "jpg", "jpeg" -> "image/jpeg"
                    "png" -> "image/png"
                    "gif" -> "image/gif"
                    "webp" -> "image/webp"
                    "mp4" -> "video/mp4"
                    "avi" -> "video/x-msvideo"  // Fixed: should be video/x-msvideo, not video/avi
                    "mov" -> "video/quicktime"
                    "wmv" -> "video/x-ms-wmv"
                    "webm" -> "video/webm"
                    "3gp" -> "video/3gpp"
                    "mkv" -> "video/x-matroska"
                    "mp3" -> "audio/mpeg"
                    "wav" -> "audio/wav"
                    "ogg" -> "audio/ogg"
                    "m4a" -> "audio/mp4"
                    else -> "application/octet-stream"
                }
                Log.d("ChatRepository", "MIME type determined from extension: $extension -> $mimeType")
            } else {
                // Validate MIME type matches extension for videos
                if (mimeType.startsWith("video/") && !extension.isEmpty()) {
                    val expectedMime = when (extension) {
                        "mp4" -> "video/mp4"
                        "webm" -> "video/webm"
                        "mov" -> "video/quicktime"
                        "avi" -> "video/x-msvideo"
                        "wmv" -> "video/x-ms-wmv"
                        "3gp" -> "video/3gpp"
                        "mkv" -> "video/x-matroska"
                        else -> null
                    }
                    if (expectedMime != null && mimeType != expectedMime) {
                        Log.w("ChatRepository", "MIME type mismatch: contentResolver=$mimeType, expected=$expectedMime, using expected")
                        mimeType = expectedMime
                    }
                }
                Log.d("ChatRepository", "MIME type from contentResolver: $mimeType")
            }
        
            // Ensure we have a valid MIME type for video files
            if (mimeType.startsWith("video/") && mimeType == "application/octet-stream") {
                Log.e("ChatRepository", "Failed to determine video MIME type, defaulting to video/mp4")
                mimeType = "video/mp4"
            }
        
            // Create request body for file
            val mediaType = mimeType.toMediaTypeOrNull() ?: "application/octet-stream".toMediaTypeOrNull()
            val requestFile = tempFile.asRequestBody(mediaType)
            val filePart = MultipartBody.Part.createFormData("file", fileName, requestFile)
        
            // Final validation before upload
            val finalFileSize = tempFile.length()
            Log.d("ChatRepository", "Preparing upload: name=$fileName, mimeType=$mimeType, size=$finalFileSize bytes, extension=$extension")
        
            if (finalFileSize == 0L) {
                tempFile.delete()
                return Result.failure(Exception("File is empty, cannot upload"))
            }
        
            // For video files, ensure we have a valid video MIME type
            if (mimeType.startsWith("video/")) {
                Log.d("ChatRepository", "Video file detected: mimeType=$mimeType, size=$finalFileSize bytes, fileName=$fileName")
            }
        
            // Create request bodies for other fields
            val chatIdBody = chatId.toRequestBody("text/plain".toMediaTypeOrNull())
            val captionBody = caption?.toRequestBody("text/plain".toMediaTypeOrNull())
            val usernameBody = username?.toRequestBody("text/plain".toMediaTypeOrNull())
            val isVideoNoteBody =
                (if (isVideoNote) "true" else "false").toRequestBody("text/plain".toMediaTypeOrNull())
        
            Log.d("ChatRepository", "Starting upload to server: fileName=$fileName, mimeType=$mimeType, size=$finalFileSize bytes")
        
            // Upload
            val response = mediaApi.uploadMedia(
                chatId = chatIdBody,
                file = filePart,
                caption = captionBody,
                username = usernameBody,
                isVideoNote = isVideoNoteBody,
            )
        
            Log.d("ChatRepository", "Upload response: code=${response.code()}, isSuccessful=${response.isSuccessful}")
        
            // Clean up temp file
            tempFile.delete()
        
            if (response.isSuccessful && response.body() != null) {
                val result = response.body()!!
                if (result.success) {
                    Log.d("ChatRepository", "Media uploaded successfully: ${result.filePath}")
                    Result.success(result)
                } else {
                    Log.e("ChatRepository", "Upload failed: ${result.error}")
                    Result.failure(Exception(result.error ?: "Upload failed"))
                }
            } else {
                val errorMessage = response.errorBody()?.string() ?: "Upload failed"
                Log.e("ChatRepository", "Upload error: $errorMessage, code: ${response.code()}")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while uploading media", e)
            Result.failure(e)
        }
    }

    suspend fun uploadMediaBatch(
        chatId: String,
        fileUris: List<Uri>,
        context: android.content.Context,
        username: String? = null,
        caption: String? = null,
    ): Result<UploadMediaBatchResponse> {
        if (fileUris.isEmpty()) {
            return Result.failure(Exception("No files selected"))
        }
        val preparedFiles = mutableListOf<File>()
        return try {
            Log.d("ChatRepository", "Uploading media batch for chatId: $chatId, count=${fileUris.size}")
            val fileParts =
                fileUris.mapNotNull { uri ->
                    prepareUploadPart(context, uri)?.also { prepared ->
                        preparedFiles.add(prepared.tempFile)
                    }?.part
                }
            if (fileParts.isEmpty()) {
                return Result.failure(Exception("Cannot open files"))
            }
            val chatIdBody = chatId.toRequestBody("text/plain".toMediaTypeOrNull())
            val captionBody = caption?.toRequestBody("text/plain".toMediaTypeOrNull())
            val usernameBody = username?.toRequestBody("text/plain".toMediaTypeOrNull())
            val response =
                mediaApi.uploadMediaBatch(
                    chatId = chatIdBody,
                    files = fileParts,
                    caption = captionBody,
                    username = usernameBody,
                )
            if (response.isSuccessful && response.body()?.success == true) {
                Log.d("ChatRepository", "Media batch uploaded successfully: messageId=${response.body()?.messageId}")
                Result.success(response.body()!!)
            } else {
                val errorMessage = response.errorBody()?.string() ?: response.body()?.error ?: "Upload failed"
                Log.e("ChatRepository", "Batch upload error: $errorMessage, code: ${response.code()}")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Log.e("ChatRepository", "Exception while uploading media batch", e)
            Result.failure(e)
        } finally {
            preparedFiles.forEach { it.delete() }
        }
    }

    private data class PreparedUploadPart(
        val tempFile: File,
        val part: MultipartBody.Part,
    )

    private fun prepareUploadPart(
        context: android.content.Context,
        fileUri: Uri,
    ): PreparedUploadPart? {
        val inputStream =
            context.contentResolver.openInputStream(fileUri) ?: run {
                Log.e("ChatRepository", "Cannot open file: $fileUri")
                return null
            }
        var fileName = "upload_${System.currentTimeMillis()}.tmp"
        if (fileUri.scheme == "file") {
            val file = File(fileUri.path ?: "")
            if (file.exists()) {
                fileName = file.name
            }
        } else {
            context.contentResolver.query(fileUri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (cursor.moveToFirst() && nameIndex >= 0) {
                    fileName = cursor.getString(nameIndex)?.takeIf { it.isNotBlank() } ?: fileName
                }
            }
        }
        val tempFileName =
            if (fileName.contains('.')) {
                "upload_${System.currentTimeMillis()}.${fileName.substringAfterLast('.')}"
            } else {
                "upload_${System.currentTimeMillis()}.tmp"
            }
        val tempFile = File(context.cacheDir, tempFileName)
        var bytesCopied = 0L
        BufferedInputStream(inputStream, 8192).use { bufferedInput ->
            BufferedOutputStream(FileOutputStream(tempFile), 8192).use { bufferedOutput ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (bufferedInput.read(buffer).also { bytesRead = it } != -1) {
                    bufferedOutput.write(buffer, 0, bytesRead)
                    bytesCopied += bytesRead
                }
                bufferedOutput.flush()
            }
        }
        if (tempFile.length() == 0L) {
            tempFile.delete()
            return null
        }
        var mimeType =
            if (fileUri.scheme == "file") {
                null
            } else {
                context.contentResolver.getType(fileUri)
            }
        val extension = fileName.substringAfterLast('.', "").lowercase()
        if (mimeType.isNullOrEmpty() || mimeType == "application/octet-stream") {
            mimeType =
                when (extension) {
                    "jpg", "jpeg" -> "image/jpeg"
                    "png" -> "image/png"
                    "gif" -> "image/gif"
                    "webp" -> "image/webp"
                    "mp4" -> "video/mp4"
                    "mov" -> "video/quicktime"
                    "webm" -> "video/webm"
                    "mkv" -> "video/x-matroska"
                    "pdf" -> "application/pdf"
                    "txt" -> "text/plain"
                    "zip" -> "application/zip"
                    else -> "application/octet-stream"
                }
        }
        val mediaType = mimeType.toMediaTypeOrNull() ?: "application/octet-stream".toMediaTypeOrNull()
        val requestFile = tempFile.asRequestBody(mediaType)
        val part = MultipartBody.Part.createFormData("files", fileName, requestFile)
        return PreparedUploadPart(tempFile = tempFile, part = part)
    }
}
