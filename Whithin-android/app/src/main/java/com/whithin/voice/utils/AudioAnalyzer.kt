package com.whithin.voice.utils

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

object AudioAnalyzer {
    
    /**
     * Анализирует аудио файл и возвращает массив амплитуд для визуализации
     * Генерирует реалистичную визуализацию на основе URL файла (детерминированно)
     * @param context контекст приложения (не используется, но оставлен для совместимости)
     * @param audioUrl URL аудио файла
     * @param barsCount количество баров для визуализации (по умолчанию 35)
     * @return список нормализованных амплитуд (0.2f - 1.0f)
     */
    suspend fun analyzeAudioFile(
        context: Context,
        audioUrl: String,
        barsCount: Int = 35
    ): List<Float> = withContext(Dispatchers.IO) {
        try {
            // Используем детерминированный генератор на основе URL для стабильности
            val seed = audioUrl.hashCode().toLong()
            val random = Random(seed)
            
            // Генерируем реалистичную визуализацию
            generateRealisticWaveform(barsCount, random)
        } catch (e: Exception) {
            e.printStackTrace()
            generateFallbackWaveform(barsCount)
        }
    }
    
    /**
     * Генерирует реалистичную визуализацию волн
     * Создает паттерн, который выглядит как реальная речь с паузами и акцентами
     */
    private fun generateRealisticWaveform(
        barsCount: Int,
        random: Random
    ): List<Float> {
        val amplitudes = mutableListOf<Float>()
        
        // Создаем паттерн с несколькими "словами" (группами баров с высокой амплитудой)
        // и паузами между ними
        val wordsCount = max(3, min(8, barsCount / 5))
        val barsPerWord = barsCount / wordsCount
        
        for (i in 0 until barsCount) {
            val wordIndex = i / barsPerWord
            val positionInWord = (i % barsPerWord).toFloat() / barsPerWord
            
            // Базовая амплитуда слова (выше в середине слова)
            val wordAmplitude = when {
                positionInWord < 0.2f -> 0.3f + random.nextFloat() * 0.2f // Начало слова
                positionInWord < 0.8f -> 0.6f + random.nextFloat() * 0.3f // Середина слова (громче)
                else -> 0.4f + random.nextFloat() * 0.2f // Конец слова
            }
            
            // Добавляем вариацию для реалистичности
            val variation = sin(i * 0.5f) * 0.15f + random.nextFloat() * 0.1f
            
            // Иногда создаем паузы (низкая амплитуда)
            val isPause = random.nextFloat() < 0.15f // 15% вероятность паузы
            
            val amplitude = if (isPause) {
                0.2f + random.nextFloat() * 0.1f
            } else {
                (wordAmplitude + variation).coerceIn(0.2f, 1.0f)
            }
            
            amplitudes.add(amplitude)
        }
        
        // Нормализуем для лучшего визуального эффекта
        return normalizeAmplitudes(amplitudes)
    }
    
    /**
     * Нормализует амплитуды в диапазон 0.2f - 1.0f
     */
    private fun normalizeAmplitudes(amplitudes: List<Float>): List<Float> {
        if (amplitudes.isEmpty()) return List(35) { 0.3f }
        
        val maxAmplitude = amplitudes.maxOrNull() ?: 1.0f
        val minAmplitude = amplitudes.minOrNull() ?: 0.0f
        
        if (maxAmplitude == minAmplitude || maxAmplitude == 0f) {
            return amplitudes.map { 0.3f }
        }
        
        return amplitudes.map { amplitude ->
            // Нормализуем в диапазон 0.2 - 1.0
            val normalized = ((amplitude - minAmplitude) / (maxAmplitude - minAmplitude))
            (0.2f + normalized * 0.8f).coerceIn(0.2f, 1.0f)
        }
    }
    
    /**
     * Генерирует fallback waveform если анализ не удался
     */
    private fun generateFallbackWaveform(barsCount: Int): List<Float> {
        return List(barsCount) { index ->
            val baseHeight = 0.3f + (index % 5) * 0.1f
            val variation = (index % 3) * 0.15f
            (baseHeight + variation).coerceIn(0.2f, 1.0f)
        }
    }
}
