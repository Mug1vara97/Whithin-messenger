package com.whithin.voice.presentation.ui.media

import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import coil.ImageLoader
import coil.decode.DecodeResult
import coil.decode.Decoder
import coil.decode.ImageSource
import coil.fetch.SourceResult
import coil.request.Options
import coil.size.Size
import com.github.penfeizhou.animation.apng.APNGDrawable
import com.github.penfeizhou.animation.apng.decode.APNGParser
import com.github.penfeizhou.animation.io.ByteBufferReader
import com.github.penfeizhou.animation.io.Reader
import com.github.penfeizhou.animation.io.StreamReader
import com.github.penfeizhou.animation.loader.Loader
import com.github.penfeizhou.animation.webp.WebPDrawable
import com.github.penfeizhou.animation.webp.decode.WebPParser
import java.io.ByteArrayInputStream
import java.nio.ByteBuffer
import java.nio.file.Files
import java.nio.file.Paths
import okio.BufferedSource

private class ByteArrayLoader(private val bytes: ByteArray) : Loader {
    override fun obtain(): Reader = ByteBufferReader(ByteBuffer.wrap(bytes))
}

private const val FORMAT_PROBE_BYTES = 16 * 1024

/** Coil [coil.request.Parameters] key — request wants Animatable even if size is set. */
const val WHITHIN_PREFER_ANIMATED = "whithin_prefer_animated"

/** Stable key for [AnimatedMediaBytesCache] (usually the media URL). */
const val WHITHIN_ANIM_BYTES_KEY = "whithin_anim_bytes_key"

/**
 * Full animated decode for profile (Size.ORIGINAL) or chat requests marked
 * [WHITHIN_PREFER_ANIMATED]. Sized requests without the flag fall through to Coil's
 * default decoder (static + sampled) for scroll-friendly placeholders.
 */
private fun Options.allowsAnimatedDrawable(): Boolean {
    if (parameters.value<Boolean>(WHITHIN_PREFER_ANIMATED) == true) return true
    return size == Size.ORIGINAL
}

private fun Options.animBytesCacheKey(): String =
    parameters.value<String>(WHITHIN_ANIM_BYTES_KEY)
        ?: "anim-src-${System.identityHashCode(this)}"

private fun ImageSource.readBytes(): ByteArray =
    source().use { bufferedSource ->
        bufferedSource.readByteArray()
    }

private fun ImageSource.readBytesCached(cacheKey: String): ByteArray =
    AnimatedMediaBytesCache.getOrPut(cacheKey) { readBytes() }

private fun ImageSource.probeHeaderBytes(): ByteArray {
    file()?.let { path ->
        return Files.newInputStream(Paths.get(path.toString())).use { input ->
            val buf = ByteArray(FORMAT_PROBE_BYTES)
            val read = input.read(buf)
            if (read > 0) buf.copyOf(read) else ByteArray(0)
        }
    }
    return source().use { bufferedSource -> bufferedSource.probeBytes() }
}

private fun BufferedSource.probeBytes(): ByteArray =
    peek().use { peeked ->
        peeked.request(FORMAT_PROBE_BYTES.toLong())
        val available = peeked.buffer.size.coerceAtMost(FORMAT_PROBE_BYTES.toLong())
        if (available == 0L) {
            ByteArray(0)
        } else {
            peeked.readByteArray(available)
        }
    }

private fun probeStream(bytes: ByteArray): StreamReader =
    StreamReader(ByteArrayInputStream(bytes))

private fun staticPngDecodeResult(bytes: ByteArray, reason: String): DecodeResult {
    ProfileMediaLogger.w("ApngCoilDecoder static fallback ($reason) bytes=${bytes.size}")
    val bitmap =
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: error("PNG/APNG static decode failed")
    return DecodeResult(
        drawable = BitmapDrawable(bitmap),
        isSampled = true,
    )
}

private fun staticWebpDecodeResult(bytes: ByteArray, reason: String): DecodeResult {
    ProfileMediaLogger.w("AnimatedWebpCoilDecoder static fallback ($reason) bytes=${bytes.size}")
    val bitmap =
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: error("WebP static decode failed")
    return DecodeResult(
        drawable = BitmapDrawable(bitmap),
        isSampled = true,
    )
}

class ApngCoilDecoder(
    private val source: ImageSource,
    private val options: Options,
) : Decoder {
    override suspend fun decode(): DecodeResult {
        val cacheKey = options.animBytesCacheKey()
        val bytes = source.readBytesCached(cacheKey)
        ProfileMediaLogger.i(
            "ApngCoilDecoder.decode cacheKey=$cacheKey header=${describeBytesHeader(bytes)}",
        )
        if (bytes.size > ProfileMediaSpecs.MAX_APNG_ANIMATION_BYTES) {
            return staticPngDecodeResult(bytes, "too large for animation")
        }
        return try {
            val drawable = APNGDrawable(ByteArrayLoader(bytes))
            DecodeResult(
                drawable = drawable,
                isSampled = false,
            )
        } catch (e: OutOfMemoryError) {
            ProfileMediaLogger.e("ApngCoilDecoder OOM, using static frame", e)
            staticPngDecodeResult(bytes, "oom")
        }
    }

    class Factory : Decoder.Factory {
        override fun create(
            result: SourceResult,
            options: Options,
            imageLoader: ImageLoader,
        ): Decoder? {
            return try {
                val probe = result.source.probeHeaderBytes()
                val isApng =
                    probe.isNotEmpty() &&
                        (APNGParser.isAPNG(probeStream(probe)) ||
                            bytesContainAscii(probe, "acTL"))
                val allowAnim = options.allowsAnimatedDrawable()
                ProfileMediaLogger.i(
                    "ApngCoilDecoder.check isApng=$isApng allowAnim=$allowAnim " +
                        "header=${describeBytesHeader(probe)}",
                )
                when {
                    !isApng -> null
                    !allowAnim -> null
                    else -> ApngCoilDecoder(result.source, options)
                }
            } catch (e: Exception) {
                ProfileMediaLogger.e("ApngCoilDecoder.check failed", e)
                null
            }
        }
    }
}

class AnimatedWebpCoilDecoder(
    private val source: ImageSource,
    private val options: Options,
) : Decoder {
    override suspend fun decode(): DecodeResult {
        val cacheKey = options.animBytesCacheKey()
        val bytes = source.readBytesCached(cacheKey)
        ProfileMediaLogger.i(
            "AnimatedWebpCoilDecoder.decode cacheKey=$cacheKey header=${describeBytesHeader(bytes)}",
        )
        // ~3MB chat stickers must still animate; only block pathological assets.
        if (bytes.size > ProfileMediaSpecs.MAX_WEBP_ANIMATION_BYTES * 3) {
            return staticWebpDecodeResult(bytes, "too large for animation")
        }
        return try {
            val drawable = WebPDrawable(ByteArrayLoader(bytes))
            DecodeResult(
                drawable = drawable,
                isSampled = false,
            )
        } catch (e: OutOfMemoryError) {
            ProfileMediaLogger.e("AnimatedWebpCoilDecoder OOM, using static frame", e)
            staticWebpDecodeResult(bytes, "oom")
        }
    }

    class Factory : Decoder.Factory {
        override fun create(
            result: SourceResult,
            options: Options,
            imageLoader: ImageLoader,
        ): Decoder? {
            return try {
                val probe = result.source.probeHeaderBytes()
                val isAnimatedWebp =
                    probe.isNotEmpty() && WebPParser.isAWebP(probeStream(probe))
                val allowAnim = options.allowsAnimatedDrawable()
                ProfileMediaLogger.i(
                    "AnimatedWebpCoilDecoder.check isAnimatedWebp=$isAnimatedWebp " +
                        "allowAnim=$allowAnim header=${describeBytesHeader(probe)}",
                )
                when {
                    !isAnimatedWebp -> null
                    !allowAnim -> null
                    else -> AnimatedWebpCoilDecoder(result.source, options)
                }
            } catch (e: Exception) {
                ProfileMediaLogger.e("AnimatedWebpCoilDecoder.check failed", e)
                null
            }
        }
    }
}
