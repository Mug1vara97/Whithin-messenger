import React, { useRef, useState, useEffect, useCallback } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SettingsIcon from '@mui/icons-material/Settings';
import { useVideoHls } from '../../../lib/hooks/useVideoHls';
import {
  exitDocumentFullscreen,
  isElementFullscreen,
  requestElementFullscreen,
  subscribeFullscreenChange,
} from '../../../lib/utils/videoFullscreen';
import './VideoPlayer.css';

const CONTROLS_HIDE_MS = 2800;

const formatTime = (time) => {
  if (!Number.isFinite(time) || time < 0) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const readVideoDuration = (video) => {
  if (!video) return 0;

  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }

  if (video.seekable?.length > 0) {
    const end = video.seekable.end(video.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) {
      return end;
    }
  }

  return 0;
};

const stopBubble = (event) => {
  event.stopPropagation();
};

const VideoPlayer = ({
  src,
  hlsSrc,
  poster,
  onError,
  onLoad,
  className = '',
  knownDuration = 0,
}) => {
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const volumeSliderRef = useRef(null);
  const qualityMenuRef = useRef(null);
  const controlsHideTimerRef = useRef(null);

  const [hasStarted, setHasStarted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() =>
    Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : 0
  );
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);

  const showControls =
    hasStarted && (controlsVisible || !isPlaying || qualityMenuOpen);

  const {
    applyQuality,
    isBuffering,
    qualities,
    qualityLabel,
    selectedQuality,
    usesHls,
  } = useVideoHls(videoRef, {
    hlsSrc,
    fallbackSrc: src,
    onError,
    onReady: onLoad,
  });

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsHideTimer();
    if (!hasStarted || !isPlaying || qualityMenuOpen) return;

    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, [clearControlsHideTimer, hasStarted, isPlaying, qualityMenuOpen]);

  const revealControls = useCallback(() => {
    if (!hasStarted) return;
    setControlsVisible(true);
    scheduleControlsHide();
  }, [hasStarted, scheduleControlsHide]);

  const exitFullscreenMode = useCallback(async () => {
    await exitDocumentFullscreen();
  }, []);

  const enterFullscreenMode = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;

    if (isFullscreen || isElementFullscreen(player)) {
      await exitFullscreenMode();
      return;
    }

    await requestElementFullscreen(player);
  }, [exitFullscreenMode, isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    revealControls();

    if (isFullscreen || isElementFullscreen(playerRef.current)) {
      await exitFullscreenMode();
      return;
    }

    try {
      await enterFullscreenMode();
    } catch (fullscreenError) {
      console.warn('VideoPlayer: fullscreen failed', fullscreenError);
    }
  }, [enterFullscreenMode, exitFullscreenMode, isFullscreen, revealControls]);

  const applyDuration = useCallback((value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    setDuration(value);
  }, []);

  const syncDuration = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    applyDuration(readVideoDuration(video));
  }, [applyDuration]);

  const probeDuration = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const existing = readVideoDuration(video);
    if (existing > 0) {
      applyDuration(existing);
      return;
    }

    const savedTime = video.currentTime || 0;

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      applyDuration(readVideoDuration(video));
      try {
        video.currentTime = savedTime;
      } catch {
        /* ignore */
      }
    };

    video.addEventListener('seeked', onSeeked);
    try {
      video.currentTime = Number.MAX_SAFE_INTEGER;
    } catch {
      video.removeEventListener('seeked', onSeeked);
    }
  }, [applyDuration]);

  useEffect(() => {
    if (volumeSliderRef.current) {
      volumeSliderRef.current.style.setProperty('--fill-percent', `${volume * 100}%`);
    }
  }, [volume]);

  useEffect(() => {
    return subscribeFullscreenChange(() => {
      setIsFullscreen(isElementFullscreen(playerRef.current));
    });
  }, []);

  useEffect(() => {
    if (!isFullscreen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        void exitFullscreenMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, exitFullscreenMode]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!qualityMenuRef.current?.contains(event.target)) {
        setQualityMenuOpen(false);
      }
    };

    if (qualityMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [qualityMenuOpen]);

  useEffect(() => {
    setHasStarted(false);
    setControlsVisible(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setQualityMenuOpen(false);
    clearControlsHideTimer();
    setDuration(Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : 0);
  }, [src, hlsSrc, knownDuration, clearControlsHideTimer]);

  useEffect(() => {
    if (hasStarted && isPlaying) {
      scheduleControlsHide();
    } else {
      clearControlsHideTimer();
      if (hasStarted && !isPlaying) {
        setControlsVisible(true);
      }
    }
  }, [hasStarted, isPlaying, scheduleControlsHide, clearControlsHideTimer]);

  useEffect(() => () => clearControlsHideTimer(), [clearControlsHideTimer]);

  const togglePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (playError) {
      console.warn('VideoPlayer: playback failed', playError);
    }
  }, []);

  const startPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      setHasStarted(true);
      setControlsVisible(true);
      await video.play();
    } catch (playError) {
      console.warn('VideoPlayer: playback failed', playError);
      setHasStarted(false);
      setControlsVisible(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    const nextDuration = readVideoDuration(video);
    if (nextDuration > 0) {
      setDuration((prev) => (prev !== nextDuration ? nextDuration : prev));
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    syncDuration();
    if (readVideoDuration(videoRef.current) <= 0 && !(knownDuration > 0)) {
      probeDuration();
    }
    onLoad?.();
  }, [knownDuration, onLoad, syncDuration, probeDuration]);

  const handleVolumeChange = useCallback((event) => {
    const newVolume = parseFloat(event.target.value);
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    video.muted = newVolume === 0;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    event.target.style.setProperty('--fill-percent', `${newVolume * 100}%`);
    revealControls();
  }, [revealControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
    revealControls();
  }, [revealControls]);

  const seekTo = useCallback(
    (seekTime) => {
      const video = videoRef.current;
      if (!video || !duration) return;

      const clamped = Math.max(0, Math.min(duration, seekTime));
      video.currentTime = clamped;
      setCurrentTime(clamped);
      revealControls();
    },
    [duration, revealControls]
  );

  const handleSeekClick = useCallback(
    (event) => {
      stopBubble(event);
      if (!duration) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      seekTo(ratio * duration);
    },
    [duration, seekTo]
  );

  const handleQualitySelect = useCallback(
    (levelIndex) => {
      applyQuality(levelIndex);
      setQualityMenuOpen(false);
      revealControls();
    },
    [applyQuality, revealControls]
  );

  const handlePlayerMouseMove = useCallback(() => {
    revealControls();
  }, [revealControls]);

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const overlayClassName = [
    'video-player__overlay',
    showControls ? 'is-visible' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const playerClassName = [
    'video-player',
    className,
    hasStarted ? 'video-player--started' : 'video-player--idle',
    showControls ? 'video-player--controls-visible' : '',
    isFullscreen ? 'video-player--fullscreen' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={playerClassName}
      ref={playerRef}
      onMouseMove={handlePlayerMouseMove}
      onTouchStart={handlePlayerMouseMove}
    >
      <video
        ref={videoRef}
        className="video-player__media"
        poster={poster}
        playsInline
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        preload="metadata"
        onClick={(event) => {
          stopBubble(event);
          if (!hasStarted) return;
          void togglePlayPause();
          revealControls();
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={syncDuration}
        onLoadedData={syncDuration}
        onCanPlay={syncDuration}
        onCanPlayThrough={() => {
          syncDuration();
          if (readVideoDuration(videoRef.current) <= 0 && !(knownDuration > 0)) {
            probeDuration();
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          setHasStarted(true);
          revealControls();
        }}
        onPause={() => {
          setIsPlaying(false);
          setControlsVisible(true);
          clearControlsHideTimer();
        }}
        onEnded={() => {
          setIsPlaying(false);
          setHasStarted(false);
          setControlsVisible(false);
          clearControlsHideTimer();

          const video = videoRef.current;
          if (!video) return;
          const finalDuration = readVideoDuration(video) || video.currentTime;
          if (finalDuration > 0) {
            setDuration(finalDuration);
            setCurrentTime(finalDuration);
          }
        }}
        onError={(event) => {
          const video = videoRef.current;
          if (!video?.src) return;
          onError?.(event);
        }}
      >
        Ваш браузер не поддерживает видео.
      </video>

      {isPlaying && isBuffering && (
        <div className="video-player__buffering" aria-hidden="true">
          <div className="video-player__spinner" />
        </div>
      )}

      {!hasStarted && (
        <button
          type="button"
          className="video-player__center-play"
          onClick={(event) => {
            stopBubble(event);
            void startPlayback();
          }}
          aria-label="Воспроизвести"
        >
          <PlayArrowIcon sx={{ fontSize: 56 }} />
        </button>
      )}

      {hasStarted && (
        <div
          className={overlayClassName}
          onClick={stopBubble}
          onMouseDown={stopBubble}
          onTouchStart={stopBubble}
        >
          <div
            className="video-player__timeline"
            onClick={handleSeekClick}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={duration || 100}
            aria-valuenow={currentTime}
          >
            <div className="video-player__track">
              <div
                className="video-player__track-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="video-player__controls">
            <div className="video-player__controls-left">
              <button
                type="button"
                onClick={(event) => {
                  stopBubble(event);
                  void togglePlayPause();
                  revealControls();
                }}
                className="video-player__btn"
                aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
              >
                {isPlaying ? (
                  <PauseIcon sx={{ width: 24, height: 24, color: '#fff' }} />
                ) : (
                  <PlayArrowIcon sx={{ width: 24, height: 24, color: '#fff' }} />
                )}
              </button>

              <button
                type="button"
                onClick={(event) => {
                  stopBubble(event);
                  toggleMute();
                }}
                className="video-player__btn"
                aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeOffIcon sx={{ width: 24, height: 24, color: '#fff' }} />
                ) : (
                  <VolumeUpIcon sx={{ width: 24, height: 24, color: '#fff' }} />
                )}
              </button>

              <input
                ref={volumeSliderRef}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="video-player__volume"
                aria-label="Громкость"
              />

              <span className="video-player__time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="video-player__controls-right">
              {usesHls && qualities.length > 0 && (
                <div className="video-player__quality" ref={qualityMenuRef}>
                  <button
                    type="button"
                    className="video-player__quality-btn"
                    onClick={(event) => {
                      stopBubble(event);
                      setQualityMenuOpen((open) => !open);
                      revealControls();
                    }}
                    aria-label="Качество"
                    aria-expanded={qualityMenuOpen}
                  >
                    <SettingsIcon sx={{ width: 20, height: 20, color: '#fff' }} />
                    <span>{qualityLabel}</span>
                  </button>

                  {qualityMenuOpen && (
                    <div className="video-player__quality-menu" role="menu">
                      {qualities.map((level) => (
                        <button
                          key={level.index}
                          type="button"
                          role="menuitem"
                          className={[
                            'video-player__quality-option',
                            selectedQuality === level.index ? 'is-active' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={(event) => {
                            stopBubble(event);
                            handleQualitySelect(level.index);
                          }}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={(event) => {
                  stopBubble(event);
                  void toggleFullscreen();
                }}
                className="video-player__btn"
                aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'}
              >
                {isFullscreen ? (
                  <FullscreenExitIcon sx={{ width: 24, height: 24, color: '#fff' }} />
                ) : (
                  <FullscreenIcon sx={{ width: 24, height: 24, color: '#fff' }} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
