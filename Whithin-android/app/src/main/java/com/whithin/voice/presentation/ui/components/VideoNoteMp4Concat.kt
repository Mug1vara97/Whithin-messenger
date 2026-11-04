package com.whithin.voice.presentation.ui.components

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.File
import java.nio.ByteBuffer

/**
 * Склейка нескольких MP4 (одинаковый пайплайн CameraX) в один файл для отправки.
 */
internal object VideoNoteMp4Concat {
    private const val TAG = "VideoNoteMp4Concat"

    fun concatOrCopy(segmentsPrior: List<File>, finalPart: File?, out: File): Boolean {
        val parts =
            buildList {
                addAll(segmentsPrior.filter { it.exists() && it.length() > 0L })
                if (finalPart != null && finalPart.exists() && finalPart.length() > 0L) {
                    add(finalPart)
                }
            }
        if (parts.isEmpty()) return false
        if (parts.size == 1) {
            return try {
                parts[0].copyTo(out, overwrite = true)
                out.exists() && out.length() > 0L
            } catch (e: Exception) {
                Log.e(TAG, "copy single", e)
                false
            }
        }
        return try {
            muxConcat(parts, out)
        } catch (e: Exception) {
            Log.e(TAG, "muxConcat", e)
            false
        }
    }

    private fun muxConcat(inputs: List<File>, outFile: File): Boolean {
        if (outFile.exists()) outFile.delete()

        val muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

        val probe = MediaExtractor()
        probe.setDataSource(inputs[0].absolutePath)
        var videoInProbe = -1
        var audioInProbe = -1
        for (i in 0 until probe.trackCount) {
            val mime = probe.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith("video/") && videoInProbe < 0) videoInProbe = i
            if (mime.startsWith("audio/") && audioInProbe < 0) audioInProbe = i
        }
        if (videoInProbe < 0) {
            probe.release()
            muxer.release()
            return false
        }
        val muxVideo = muxer.addTrack(probe.getTrackFormat(videoInProbe))
        val muxAudio =
            if (audioInProbe >= 0) {
                muxer.addTrack(probe.getTrackFormat(audioInProbe))
            } else {
                -1
            }
        probe.release()

        muxer.start()
        val buffer = ByteBuffer.allocateDirect(256 * 1024)
        val info = MediaCodec.BufferInfo()

        var videoOffsetUs = 0L
        var audioOffsetUs = 0L

        try {
            for (path in inputs) {
                val ex = MediaExtractor()
                ex.setDataSource(path.absolutePath)
                var vIn = -1
                var aIn = -1
                for (i in 0 until ex.trackCount) {
                    val mime = ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue
                    if (mime.startsWith("video/") && vIn < 0) vIn = i
                    if (mime.startsWith("audio/") && aIn < 0) aIn = i
                }

                if (vIn >= 0) {
                    ex.selectTrack(vIn)
                    var lastPts = videoOffsetUs
                    while (true) {
                        info.offset = 0
                        info.size = ex.readSampleData(buffer, 0)
                        if (info.size < 0) break
                        val t = ex.sampleTime + videoOffsetUs
                        info.presentationTimeUs = t
                        info.flags = ex.sampleFlags
                        muxer.writeSampleData(muxVideo, buffer, info)
                        lastPts = t
                        if (!ex.advance()) break
                    }
                    ex.unselectTrack(vIn)
                    videoOffsetUs = lastPts + 33_000L
                }

                if (muxAudio >= 0 && aIn >= 0) {
                    ex.selectTrack(aIn)
                    var lastPts = audioOffsetUs
                    while (true) {
                        info.offset = 0
                        info.size = ex.readSampleData(buffer, 0)
                        if (info.size < 0) break
                        val t = ex.sampleTime + audioOffsetUs
                        info.presentationTimeUs = t
                        info.flags = ex.sampleFlags
                        muxer.writeSampleData(muxAudio, buffer, info)
                        lastPts = t
                        if (!ex.advance()) break
                    }
                    ex.unselectTrack(aIn)
                    audioOffsetUs = lastPts + 10_000L
                }
                ex.release()
            }
        } finally {
            try {
                muxer.stop()
            } catch (_: Exception) {
            }
            muxer.release()
        }
        return outFile.exists() && outFile.length() > 0L
    }
}
