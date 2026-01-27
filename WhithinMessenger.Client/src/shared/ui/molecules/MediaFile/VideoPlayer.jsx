import React, { useState, useRef, useEffect, useCallback } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import './VideoPlayer.css';

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoPlayer = ({ src, poster, onError, onLoad, className = '' }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const hideControlsTimer = useRef(null);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
      setHasStarted(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (isSeeking) return;
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  }, [isSeeking]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      onLoad?.();
    }
  }, [onLoad]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  }, []);

  const handleSeek = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = value;
    }
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    setIsMuted(value === 0);
    const video = videoRef.current;
    if (video) {
      video.volume = value;
      video.muted = value === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [isPlaying]);

  const handleMouseLeave = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) setShowControls(false);
  }, [isPlaying]);

  const handleProgressMouseDown = useCallback(() => setIsSeeking(true), []);
  const handleProgressMouseUp = useCallback(() => setIsSeeking(false), []);

  return (
    <div
      ref={containerRef}
      className={`whithin-video-player ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="whithin-video-player__video"
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={(e) => onError?.(e)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Центральная кнопка Play до первого запуска */}
      {!hasStarted && (
        <button
          type="button"
          className="whithin-video-player__center-play"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          aria-label="Смотреть"
        >
          <PlayArrowIcon sx={{ fontSize: 64 }} />
        </button>
      )}

      {/* Оверлей с контролами */}
      <div className={`whithin-video-player__controls ${showControls || !isPlaying ? 'visible' : ''}`}>
        <div
          className="whithin-video-player__progress-wrap"
          role="progressbar"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration || 100}
        >
          <div
            className="whithin-video-player__progress-fill"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
          <input
            type="range"
            className="whithin-video-player__progress"
            min={0}
            max={duration || 100}
            value={currentTime}
            step={0.1}
            onChange={handleSeek}
            onMouseDown={handleProgressMouseDown}
            onMouseUp={handleProgressMouseUp}
            onTouchEnd={handleProgressMouseUp}
            aria-label="Перемотка"
          />
        </div>
        <div className="whithin-video-player__bar">
          <button
            type="button"
            className="whithin-video-player__btn"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? <PauseIcon sx={{ fontSize: 28 }} /> : <PlayArrowIcon sx={{ fontSize: 28 }} />}
          </button>
          <span className="whithin-video-player__time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="whithin-video-player__volume">
            <button
              type="button"
              className="whithin-video-player__btn"
              onClick={toggleMute}
              aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isMuted || volume === 0 ? (
                <VolumeOffIcon sx={{ fontSize: 24 }} />
              ) : (
                <VolumeUpIcon sx={{ fontSize: 24 }} />
              )}
            </button>
            <input
              type="range"
              className="whithin-video-player__volume-range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              aria-label="Громкость"
            />
          </div>
          <button
            type="button"
            className="whithin-video-player__btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'}
          >
            {isFullscreen ? (
              <FullscreenExitIcon sx={{ fontSize: 24 }} />
            ) : (
              <FullscreenIcon sx={{ fontSize: 24 }} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
