package com.whithin.voice.data.local

import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

/**
 * Retries idempotent requests on transient network failures (slow/unstable connections).
 */
class NetworkRetryInterceptor(
    private val maxRetries: Int = 2,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.method !in RETRYABLE_METHODS) {
            return chain.proceed(request)
        }

        var lastException: IOException? = null
        repeat(maxRetries + 1) {
            try {
                val response = chain.proceed(request)
                if (response.isSuccessful || response.code in CLIENT_ERROR_RANGE) {
                    return response
                }
                response.close()
            } catch (e: IOException) {
                lastException = e
            }
        }

        throw lastException ?: IOException("Network request failed: ${request.url}")
    }

    companion object {
        private val RETRYABLE_METHODS = setOf("GET", "HEAD")
        private val CLIENT_ERROR_RANGE = 400..499
    }
}
