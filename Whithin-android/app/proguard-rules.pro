# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep LiveKit classes
-keep class io.livekit.** { *; }
-dontwarn io.livekit.**

# Keep WebRTC classes
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# SignalR / RxJava
-keep class com.microsoft.signalr.** { *; }
-keep class io.reactivex.rxjava3.** { *; }
-dontwarn com.microsoft.signalr.**

# Socket.IO
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# Keep Gson
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken

# Keep data models and E2E
-keep class com.whithin.voice.data.model.** { *; }
-keep class com.whithin.voice.data.api.** { *; }
-keep class com.whithin.voice.data.e2e.** { *; }
-keep class com.whithin.voice.domain.model.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# Keep Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.** {
    volatile <fields>;
}

# Keep Compose
-keep class androidx.compose.** { *; }
-keep class kotlin.coroutines.** { *; }

# JNA (required by lazysodium-android in release/minified builds)
-keep class com.sun.jna.** { *; }
-keep interface com.sun.jna.** { *; }
-dontwarn java.awt.**
-keep public class * extends com.sun.jna.Structure { *; }
-keep class com.goterl.lazysodium.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn org.slf4j.impl.StaticLoggerBinder

# Coil
-keep class coil.** { *; }
-dontwarn coil.**

# Animated WebP / APNG (penfeizhou)
-keep class com.github.penfeizhou.animation.** { *; }
-dontwarn com.github.penfeizhou.animation.**

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Strip verbose logs in release (R8)
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# Our DEBUG-gated perf helpers become no-ops after inlining + BuildConfig.DEBUG=false
-assumenosideeffects class com.whithin.voice.util.ChatOpenPerfLog {
    public static void begin(...);
    public static void mark(...);
    public static void end(...);
    public static void cancel(...);
}
-assumenosideeffects class com.whithin.voice.util.ListLoadPerfLog {
    public static void begin(...);
    public static void mark(...);
    public static void endCacheReady(...);
    public static void endSyncReady(...);
    public static void cancel(...);
}

