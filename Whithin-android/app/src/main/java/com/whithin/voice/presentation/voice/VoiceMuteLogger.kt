package com.whithin.voice.presentation.voice

import android.util.Log

/**
 * Logcat filter: `adb logcat -s WhithinVoiceMute`
 * or in Android Studio: tag:WhithinVoiceMute
 */
object VoiceMuteLogger {
    const val TAG = "WhithinVoiceMute"

    fun d(message: String) {
        Log.d(TAG, message)
    }

    fun w(message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            Log.w(TAG, message, throwable)
        } else {
            Log.w(TAG, message)
        }
    }

    fun e(message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            Log.e(TAG, message, throwable)
        } else {
            Log.e(TAG, message)
        }
    }
}
