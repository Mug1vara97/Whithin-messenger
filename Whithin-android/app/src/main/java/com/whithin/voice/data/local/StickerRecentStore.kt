package com.whithin.voice.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StickerRecentStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson,
) {
    private val prefs = context.getSharedPreferences("sticker_recent_prefs", Context.MODE_PRIVATE)
    private val key = "recent_sticker_ids"
    private val maxRecent = 30

    fun getRecentStickerIds(): List<String> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return runCatching {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(raw, type) ?: emptyList()
        }.getOrDefault(emptyList())
    }

    fun addRecent(stickerId: String) {
        if (stickerId.isBlank()) return
        val updated = listOf(stickerId) + getRecentStickerIds().filter { it != stickerId }
        prefs.edit().putString(key, gson.toJson(updated.take(maxRecent))).apply()
    }

    fun clearRecent() {
        prefs.edit().remove(key).apply()
    }
}
