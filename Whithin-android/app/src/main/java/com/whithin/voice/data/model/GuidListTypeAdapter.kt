package com.whithin.voice.data.model

import com.google.gson.*
import java.lang.reflect.Type

class GuidListTypeAdapter : JsonDeserializer<List<String>> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): List<String> {
        if (json == null || !json.isJsonArray) {
            return emptyList()
        }
        
        val result = mutableListOf<String>()
        val array = json.asJsonArray
        
        for (element in array) {
            when {
                element.isJsonPrimitive -> {
                    val primitive = element.asJsonPrimitive
                    when {
                        primitive.isString -> result.add(primitive.asString)
                        primitive.isNumber -> result.add(primitive.asString) // Convert number to string
                        else -> {
                            // Try to convert to string anyway
                            result.add(element.toString().trim('"'))
                        }
                    }
                }
                else -> {
                    // Try to convert to string
                    result.add(element.toString().trim('"'))
                }
            }
        }
        
        return result
    }
}
