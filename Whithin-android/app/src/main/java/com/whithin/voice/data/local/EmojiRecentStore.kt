package com.whithin.voice.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.whithin.voice.data.emoji.DefaultEmojiCategories

class EmojiRecentStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    fun getRecentEmojis(): List<String> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(raw, type) ?: emptyList()
        }.getOrDefault(emptyList()).filter(DefaultEmojiCategories::isKnownEmoji)
    }

    fun rememberEmoji(emoji: String): List<String> {
        if (!DefaultEmojiCategories.isKnownEmoji(emoji)) return getRecentEmojis()
        val updated = listOf(emoji) + getRecentEmojis().filter { it != emoji }
        val trimmed = updated.take(DefaultEmojiCategories.MAX_RECENT)
        prefs.edit().putString(KEY, gson.toJson(trimmed)).apply()
        return trimmed
    }

    private companion object {
        private const val PREFS_NAME = "emoji_recent_prefs"
        private const val KEY = "recent_emojis"
    }
}
