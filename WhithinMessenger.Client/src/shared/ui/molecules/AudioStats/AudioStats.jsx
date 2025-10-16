import React, { useState, useEffect } from 'react';
import { audioAnalyzer } from '../../../lib/utils/audioAnalyzer';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './AudioStats.css';

const AudioStats = ({ mediaFile, isVisible = false }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!mediaFile || !isVisible) return;

    const analyzeAudio = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${BASE_URL}/${mediaFile.filePath}`);
        const audioBlob = await response.blob();
        const audioFile = new File([audioBlob], mediaFile.originalFileName, {
          type: mediaFile.contentType
        });

        const amplitudes = await audioAnalyzer.analyzeAudioFile(audioFile, 35);
        const histogram = audioAnalyzer.createAmplitudeHistogram(amplitudes);
        
        setStats({
          amplitudes,
          histogram,
          fileInfo: {
            name: mediaFile.originalFileName,
            size: mediaFile.fileSize,
            type: mediaFile.contentType
          }
        });
      } catch (error) {
        console.error('Ошибка анализа аудио для статистики:', error);
      } finally {
        setIsLoading(false);
      }
    };

    analyzeAudio();
  }, [mediaFile, isVisible]);

  if (!isVisible || !stats) return null;

  const { histogram, fileInfo } = stats;

  return (
    <div className="audio-stats">
      <div className="audio-stats-header">
        <h4>Статистика аудио</h4>
        <span className="audio-stats-filename">{fileInfo.name}</span>
      </div>
      
      <div className="audio-stats-content">
        <div className="audio-stats-section">
          <h5>Основные показатели</h5>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Минимум:</span>
              <span className="stat-value">{histogram.min.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Максимум:</span>
              <span className="stat-value">{histogram.max.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Среднее:</span>
              <span className="stat-value">{histogram.mean.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Медиана:</span>
              <span className="stat-value">{histogram.median.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Стд. отклонение:</span>
              <span className="stat-value">{histogram.stdDev.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="audio-stats-section">
          <h5>Качество записи</h5>
          <div className={`quality-indicator ${histogram.recordingQuality}`}>
            {histogram.recordingQuality === 'good' && '✅ Хорошее качество'}
            {histogram.recordingQuality === 'poor' && '⚠️ Тихая запись'}
            {histogram.recordingQuality === 'loud' && '🔊 Громкая запись'}
            {histogram.recordingQuality === 'flat' && '📉 Монотонная запись'}
          </div>
        </div>

        <div className="audio-stats-section">
          <h5>Информация о файле</h5>
          <div className="file-info">
            <div className="file-info-item">
              <span>Размер:</span>
              <span>{(fileInfo.size / 1024).toFixed(1)} KB</span>
            </div>
            <div className="file-info-item">
              <span>Тип:</span>
              <span>{fileInfo.type}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioStats;













