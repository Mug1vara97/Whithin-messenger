package com.whithin.voice.presentation.ui.components

/**
 * Общий контракт для полосы удержания / закреплённой записи (голос или видеокружок).
 */
interface RecordingComposerSession {
    val isRecording: Boolean
    val isPaused: Boolean
    val elapsedDeciseconds: Int
    val voiceLevelSmoothed: Float
    /** Пауза в закреплённом режиме (видеокружок — только отправка/отмена). */
    val supportsPauseWhileRecording: Boolean
    fun stop(send: Boolean)
    fun togglePause()
    fun bumpElapsedTick()
    fun setVoiceMeter(value: Float)
}
