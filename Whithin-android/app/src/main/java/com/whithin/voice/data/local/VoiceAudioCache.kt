package com.whithin.voice.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VoiceAudioCache @Inject constructor(
    @ApplicationContext private val context: Context,
    private val mediaDownloadHelper: MediaDownloadHelper,
) {
    private val downloadLimiter = Semaphore(2)

    private val cacheDir: File
        get() = File(context.cacheDir, "voice_cache").also { it.mkdirs() }

    fun localFileForKey(cacheKey: String, extension: String = "webm"): File {
        val safeExt = extension.substringAfterLast('.', extension).ifBlank { "webm" }
        return File(cacheDir, "$cacheKey.$safeExt")
    }

    fun cacheKeyForUrl(audioUrl: String): String =
        audioUrl.hashCode().toUInt().toString(16)

    fun durationSidecar(audioFile: File): File =
        File(audioFile.absolutePath + ".duration")

    fun readCachedDurationMs(audioFile: File): Int? =
        durationSidecar(audioFile)
            .takeIf { it.exists() && it.length() > 0L }
            ?.readText()
            ?.trim()
            ?.toIntOrNull()
            ?.takeIf { it > 0 }

    fun writeCachedDurationMs(audioFile: File, durationMs: Int) {
        if (durationMs <= 0) return
        runCatching {
            durationSidecar(audioFile).writeText(durationMs.toString())
        }
    }

    fun existingFile(audioUrl: String, storagePath: String): File? {
        val file = localFileForKey(
            cacheKey = cacheKeyForUrl(audioUrl),
            extension = storagePath.substringAfterLast('.', "webm"),
        )
        return file.takeIf { it.exists() && it.length() > 0L }
    }

    suspend fun ensureLocalFile(storagePath: String, audioUrl: String): File? =
        withContext(Dispatchers.IO) {
            val cacheKey = cacheKeyForUrl(audioUrl)
            val extension = storagePath.substringAfterLast('.', "webm")
            val destination = localFileForKey(cacheKey, extension)

            existingFile(audioUrl, storagePath)?.let { return@withContext it }

            downloadLimiter.withPermit {
                if (destination.exists() && destination.length() > 0L) {
                    return@withPermit destination
                }

                mediaDownloadHelper
                    .downloadToCacheFile(storagePath, destination)
                    .getOrNull()
            }
        }
}
