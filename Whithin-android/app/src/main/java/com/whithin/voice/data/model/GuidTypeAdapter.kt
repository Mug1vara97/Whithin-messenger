package com.whithin.voice.data.model

import com.google.gson.TypeAdapter
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import com.google.gson.stream.JsonWriter

class GuidTypeAdapter : TypeAdapter<String>() {
    override fun write(out: JsonWriter, value: String?) {
        if (value == null) {
            out.nullValue()
        } else {
            out.value(value)
        }
    }

    override fun read(`in`: JsonReader): String? {
        return when (`in`.peek()) {
            JsonToken.NULL -> {
                `in`.nextNull()
                null
            }
            JsonToken.STRING -> {
                `in`.nextString()
            }
            JsonToken.NUMBER -> {
                // GUID может приходить как число (без дефисов), читаем как число и преобразуем в строку
                // Пытаемся прочитать как Long (для больших чисел, которые могут быть GUID)
                try {
                    val longValue = `in`.nextLong()
                    longValue.toString()
                } catch (e: Exception) {
                    // Если не получается как Long, пытаемся как Double
                    try {
                        val doubleValue = `in`.nextDouble()
                        doubleValue.toLong().toString()
                    } catch (e2: Exception) {
                        // В крайнем случае пропускаем значение
                        `in`.skipValue()
                        null
                    }
                }
            }
            else -> {
                `in`.skipValue()
                null
            }
        }
    }
}
