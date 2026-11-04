package com.whithin.voice.audio

internal object RnnoiseNative {
    init {
        System.loadLibrary("whithin_rnnoise_jni")
    }

    external fun nativeCreate(): Long

    external fun nativeDestroy(handle: Long)

    external fun nativeGetFrameSize(): Int

    external fun nativeProcessFrame(handle: Long, buffer: FloatArray, offset: Int, frameSize: Int)
}
