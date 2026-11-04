package com.whithin.voice.data.repository

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import com.whithin.voice.data.api.SendStickerRequest
import com.whithin.voice.data.api.StickerApi
import com.whithin.voice.data.local.StickerRecentStore
import com.whithin.voice.data.model.StickerPack
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "StickerRepository"

@Singleton
class StickerRepository @Inject constructor(
    private val stickerApi: StickerApi,
    private val recentStore: StickerRecentStore,
    @ApplicationContext private val context: Context,
) {
    suspend fun loadAvailableStickerPacks(): Result<List<StickerPack>> =
        withContext(Dispatchers.IO) {
            try {
                val response = stickerApi.getAvailableStickerPacks()
                if (response.isSuccessful) {
                    Result.success(response.body().orEmpty())
                } else {
                    Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось загрузить каталог"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun installStickerPack(packId: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = stickerApi.installStickerPack(packId)
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось добавить стикерпак"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun loadStickerPacks(): Result<List<StickerPack>> =
        withContext(Dispatchers.IO) {
            try {
                val response = stickerApi.getStickerPacks()
                if (response.isSuccessful) {
                    val packs = response.body().orEmpty()
                    Log.d(
                        TAG,
                        "Loaded ${packs.size} packs, stickers=${packs.sumOf { it.stickersValue.size }}",
                    )
                    Result.success(packs)
                } else {
                    Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось загрузить стикеры"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun uploadStickerPack(title: String, archiveUri: Uri): Result<StickerPack> =
        withContext(Dispatchers.IO) {
            try {
                val tempFile = copyUriToCache(archiveUri) ?: return@withContext Result.failure(Exception("Не удалось прочитать архив"))
                val part =
                    MultipartBody.Part.createFormData(
                        "archive",
                        tempFile.name,
                        tempFile.asRequestBody("application/zip".toMediaTypeOrNull()),
                    )
                val titleBody = title.trim().toRequestBody("text/plain".toMediaTypeOrNull())
                Log.d(TAG, "Uploading sticker pack: title=$title, archive=${tempFile.name}, size=${tempFile.length()}")
                val response = stickerApi.uploadStickerPack(titleBody, part)
                tempFile.delete()
                if (response.isSuccessful) {
                    val pack = response.body()
                    if (pack == null) {
                        Log.e(TAG, "Upload response body is null, code=${response.code()}")
                        Result.failure(Exception("Пустой ответ сервера"))
                    } else {
                        val stickerCount = pack.stickersValue.size
                        Log.d(
                            TAG,
                            "Upload response: code=${response.code()}, packId=${pack.idValue}, stickers=$stickerCount",
                        )
                        if (stickerCount == 0) {
                            Result.failure(
                                Exception(
                                    "Сервер создал пак без стикеров. Проверьте ZIP: webp/png/gif/jpg/webm, размер до 2–5 МБ на файл.",
                                ),
                            )
                        } else {
                            Result.success(pack)
                        }
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "Upload failed: code=${response.code()}, body=$errorBody")
                    Result.failure(Exception(errorBody ?: "Не удалось загрузить стикерпак"))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Upload exception", e)
                Result.failure(e)
            }
        }

    suspend fun sendSticker(
        chatId: String,
        stickerId: String,
        repliedToMessageId: String? = null,
    ): Result<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response =
                    stickerApi.sendSticker(
                        chatId = chatId,
                        stickerId = stickerId,
                        body = SendStickerRequest(repliedToMessageId = repliedToMessageId),
                    )
                if (response.isSuccessful) {
                    recentStore.addRecent(stickerId)
                    Result.success(Unit)
                } else {
                    Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось отправить стикер"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    fun getRecentStickerIds(): List<String> = recentStore.getRecentStickerIds()

    suspend fun deleteStickerPack(packId: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = stickerApi.deleteStickerPack(packId)
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось удалить стикерпак"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    fun clearRecentStickers() = recentStore.clearRecent()

    private fun copyUriToCache(uri: Uri): File? {
        val name =
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor ->
                    if (cursor.moveToFirst()) cursor.getString(0) else null
                }
                ?: "sticker_pack.zip"
        val safeName = if (name.endsWith(".zip", ignoreCase = true)) name else "$name.zip"
        val out = File(context.cacheDir, "sticker_upload_${System.currentTimeMillis()}_$safeName")
        return try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(out).use { output -> input.copyTo(output) }
            }
            out
        } catch (_: Exception) {
            out.delete()
            null
        }
    }
}
