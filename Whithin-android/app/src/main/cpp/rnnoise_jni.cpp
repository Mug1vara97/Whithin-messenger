#include <jni.h>
#include <rnnoise.h>

extern "C" JNIEXPORT jlong JNICALL
Java_com_whithin_voice_audio_RnnoiseNative_nativeCreate(JNIEnv *, jobject) {
    DenoiseState *state = rnnoise_create(nullptr);
    return reinterpret_cast<jlong>(state);
}

extern "C" JNIEXPORT void JNICALL
Java_com_whithin_voice_audio_RnnoiseNative_nativeDestroy(JNIEnv *, jobject, jlong handle) {
    if (handle == 0) {
        return;
    }
    rnnoise_destroy(reinterpret_cast<DenoiseState *>(handle));
}

extern "C" JNIEXPORT jint JNICALL
Java_com_whithin_voice_audio_RnnoiseNative_nativeGetFrameSize(JNIEnv *, jobject) {
    return rnnoise_get_frame_size();
}

extern "C" JNIEXPORT void JNICALL
Java_com_whithin_voice_audio_RnnoiseNative_nativeProcessFrame(
    JNIEnv *env,
    jobject,
    jlong handle,
    jfloatArray buffer,
    jint offset,
    jint frameSize) {
    auto *state = reinterpret_cast<DenoiseState *>(handle);
    if (state == nullptr || buffer == nullptr || frameSize <= 0) {
        return;
    }

    jfloat *elements = env->GetFloatArrayElements(buffer, nullptr);
    if (elements == nullptr) {
        return;
    }

    float *frame = elements + offset;
    float out[512];
    rnnoise_process_frame(state, out, frame);
    for (int i = 0; i < frameSize; ++i) {
        frame[i] = out[i];
    }

    env->ReleaseFloatArrayElements(buffer, elements, 0);
}
