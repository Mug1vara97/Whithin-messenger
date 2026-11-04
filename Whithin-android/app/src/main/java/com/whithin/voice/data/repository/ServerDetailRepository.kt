package com.whithin.voice.data.repository

import android.util.Log
import com.google.gson.Gson
import com.whithin.voice.data.api.ServerApi
import com.whithin.voice.data.model.ServerDetail
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ServerDetailRepository @Inject constructor(
    private val serverApi: ServerApi,
    private val gson: Gson
) {
    suspend fun getServer(serverId: String): Result<ServerDetail> {
        return try {
            Log.d("ServerDetailRepository", "Fetching server: $serverId")
            
            // Используем ResponseBody для получения сырого ответа без десериализации
            val rawResponse = serverApi.getServerRaw(serverId)
            
            if (!rawResponse.isSuccessful) {
                val errorBody = rawResponse.errorBody()?.string() ?: "Unknown error"
                Log.e("ServerDetailRepository", "Error response (${rawResponse.code()}): $errorBody")
                return Result.failure(Exception("Server returned error: ${rawResponse.code()} - $errorBody"))
            }
            
            // Логируем сырой JSON из ответа
            val responseBody = rawResponse.body()
            if (responseBody != null) {
                val responseString = responseBody.string()
                Log.d("ServerDetailRepository", "Raw JSON response (length: ${responseString.length}): $responseString")
                
                // Вручную десериализуем
                try {
                    val server = gson.fromJson(responseString, ServerDetail::class.java)
                    Log.d("ServerDetailRepository", "Server deserialized successfully: ${server.nameValue}")
                    Result.success(server)
                } catch (e: Exception) {
                    Log.e("ServerDetailRepository", "Error deserializing JSON: $responseString", e)
                    Result.failure(e)
                }
            } else {
                Log.e("ServerDetailRepository", "Response body is null")
                Result.failure(Exception("Response body is null"))
            }
        } catch (e: Exception) {
            Log.e("ServerDetailRepository", "Error fetching server", e)
            Result.failure(e)
        }
    }
}
