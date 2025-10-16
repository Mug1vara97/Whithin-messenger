import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './AudioMessage.css';

const AudioMessage = ({ mediaFile }) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(null);

  const audioUrl = `${BASE_URL}/${mediaFile.filePath}`;

  useEffect(() => {
    if (!waveformRef.current) return;

    // Небольшая задержка для предотвращения конфликтов
    const timeoutId = setTimeout(() => {
      // Создаем WaveSurfer
      const waveSurferOptions = {
        container: waveformRef.current,
        waveColor: '#b9bbbe',
        progressColor: '#5865f2',
        cursorColor: '#ffffff',
        barWidth: 2,
        barHeight: 0.7,
        responsive: true,
        height: 40,
        cursorWidth: 0,
        minPxPerSec: 1,
      };

      wavesurferRef.current = WaveSurfer.create(waveSurferOptions);
      wavesurferRef.current.load(audioUrl);

      // События
      wavesurferRef.current.on('ready', () => {
        setDuration(wavesurferRef.current.getDuration());
      });

      wavesurferRef.current.on('audioprocess', () => {
        setCurrentTime(wavesurferRef.current.getCurrentTime());
      });

      wavesurferRef.current.on('play', () => {
        setIsPlaying(true);
      });

      wavesurferRef.current.on('pause', () => {
        setIsPlaying(false);
      });

      wavesurferRef.current.on('finish', () => {
        setIsPlaying(false);
      });

      wavesurferRef.current.on('error', (err) => {
        setError('Ошибка при загрузке аудио');
        console.error('WaveSurfer error:', err);
      });
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (wavesurferRef.current && !wavesurferRef.current.isDestroyed) {
        try {
          wavesurferRef.current.destroy();
        } catch (error) {
          console.warn('Ошибка при уничтожении WaveSurfer:', error);
        }
      }
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (wavesurferRef.current && !wavesurferRef.current.isDestroyed) {
      try {
        wavesurferRef.current.playPause();
      } catch (error) {
        console.warn('Ошибка при воспроизведении:', error);
      }
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className={`audio-message ${isPlaying ? 'playing' : ''}`}>
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <button onClick={togglePlay} className="play-pause-button">
            {isPlaying ? (
              <PauseIcon sx={{ width: 24, height: 24, color: '#5865f2' }} />
            ) : (
              <PlayArrowIcon sx={{ width: 24, height: 24, color: '#5865f2' }} />
            )}
          </button>
          <div ref={waveformRef} className="waveform-container" style={{ width: '200px', height: '40px' }}>
          </div>
          <span className="duration">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </>
      )}
    </div>
  );
};

export default AudioMessage;