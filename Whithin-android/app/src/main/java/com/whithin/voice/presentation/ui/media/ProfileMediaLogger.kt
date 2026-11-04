package com.whithin.voice.presentation.ui.media

import android.util.Log
import com.whithin.voice.BuildConfig

object ProfileMediaLogger {
    const val TAG = "WhithinProfileMedia"

    /** Debug-only — hot paths (list scroll / Coil decode) must not spam release Logcat. */
    fun i(message: String) {
        if (BuildConfig.DEBUG) {
            Log.i(TAG, message)
        }
    }

    fun d(message: String) {
        if (BuildConfig.DEBUG) {
            Log.d(TAG, message)
        }
    }

    fun w(message: String, throwable: Throwable? = null) {
        Log.w(TAG, message, throwable)
    }

    fun e(message: String, throwable: Throwable? = null) {
        Log.e(TAG, message, throwable)
    }
}

fun describeDrawable(drawable: android.graphics.drawable.Drawable?): String {
    if (drawable == null) return "null"
    val animatable = drawable is android.graphics.drawable.Animatable
    val running =
        if (drawable is android.graphics.drawable.Animatable) {
            @Suppress("DEPRECATION")
            try {
                // Animatable2Compat exposes isRunning on some drawables via reflection-free check
                when (drawable) {
                    is androidx.vectordrawable.graphics.drawable.Animatable2Compat ->
                        drawable.isRunning
                    else -> animatable
                }
            } catch (_: Exception) {
                false
            }
        } else {
            false
        }
    return buildString {
        append(drawable.javaClass.simpleName)
        append("(w=").append(drawable.intrinsicWidth)
        append(",h=").append(drawable.intrinsicHeight)
        append(",animatable=").append(animatable)
        append(",running=").append(running)
        append(')')
    }
}

fun bytesContainAscii(
    bytes: ByteArray,
    needle: String,
    scanLimit: Int = 65_536,
): Boolean {
    val n = needle.toByteArray(Charsets.US_ASCII)
    if (n.isEmpty()) return false
    val limit = minOf(bytes.size, scanLimit)
    if (limit < n.size) return false
    for (i in 0..limit - n.size) {
        var match = true
        for (j in n.indices) {
            if (bytes[i + j] != n[j]) {
                match = false
                break
            }
        }
        if (match) return true
    }
    return false
}

fun describeBytesHeader(bytes: ByteArray): String {
    if (bytes.isEmpty()) return "empty"
    val hex = bytes.take(12).joinToString("-") { "%02X".format(it) }
    val format =
        when {
            bytes.size >= 4 &&
                bytes[0] == 0x1A.toByte() &&
                bytes[1] == 0x45.toByte() &&
                bytes[2] == 0xDF.toByte() &&
                bytes[3] == 0xA3.toByte() -> "webm/matroska"

            bytes.size >= 12 &&
                bytes[0] == 'R'.code.toByte() &&
                bytes[1] == 'I'.code.toByte() &&
                bytes[2] == 'F'.code.toByte() &&
                bytes[3] == 'F'.code.toByte() &&
                bytes[8] == 'W'.code.toByte() &&
                bytes[9] == 'E'.code.toByte() &&
                bytes[10] == 'B'.code.toByte() &&
                bytes[11] == 'P'.code.toByte() -> "webp"

            bytes.size >= 8 &&
                bytes[0] == 0x89.toByte() &&
                bytes[1] == 'P'.code.toByte() &&
                bytes[2] == 'N'.code.toByte() &&
                bytes[3] == 'G'.code.toByte() ->
                if (bytesContainAscii(bytes, "acTL")) "apng" else "png"

            bytes.size >= 3 &&
                bytes[0] == 'G'.code.toByte() &&
                bytes[1] == 'I'.code.toByte() &&
                bytes[2] == 'F'.code.toByte() -> "gif"

            else -> "unknown"
        }
    return "$format hex=$hex size=${bytes.size}"
}
