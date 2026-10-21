import React, { useRef, useEffect, useState, useCallback } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { buildMediaUrl } from '../../../lib/utils/urlHelpers';
import {
  isValidAudioDuration,
  fetchAudioBlob,
  analyzeAudioBuffer,
  readMediaFileDuration,
  readCachedAudioDuration,
  cacheAudioDuration,
  probeDurationOnElement,
  resolveMediaContentType,
  resolveMediaFilePath,
} from '../../../lib/utils/probeAudioDuration';
import { BarWaveform } from '../../atoms/BarWaveform';
import './AudioMessage.css';

const formatTime = (time) => {
  if (!Number.isFinite(time) || time < 0) return '0:00';
  const rounded = Math.max(0, Math.round(time));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const AudioMessage = ({ mediaFile }) => {
  const rootRef = useRef(null);
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const loadIdRef = useRef(0);
  const durationRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [peaks, setPeaks] = useState([]);
  const [duration, setDuration] = useState(() => {
    const fromMeta = readMediaFileDuration(mediaFile);
    const fromPath = readCachedAudioDuration(resolveMediaFilePath(mediaFile));
    return fromMeta > 0 ? fromMeta : fromPath;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const filePath = resolveMediaFilePath(mediaFile);
  const contentType = resolveMediaContentType(mediaFile);
  const audioUrl = buildMediaUrl(filePath);

  const applyDuration = useCallback(
    (value) => {
      if (!isValidAudioDuration(value)) return;
      durationRef.current = value;
      setDuration(value);
      cacheAudioDuration(filePath, value);
    },
    [filePath]
  );

  const tryResolveDurationFromAudio = useCallback(
    async (audio, { probe = false } = {}) => {
      if (!audio) return durationRef.current;

      const applyIfChanged = (value) => {
        if (!isValidAudioDuration(value)) return durationRef.current;
        if (Math.abs(durationRef.current - value) < 0.05) return value;
        applyDuration(value);
        return value;
      };

      if (isValidAudioDuration(audio.duration)) {
        return applyIfChanged(audio.duration);
      }

      if (durationRef.current > 0) return durationRef.current;

      if (probe) {
        const probed = await probeDurationOnElement(audio, { resetPosition: true });
        if (probed > 0) {
          return applyIfChanged(probed);
        }
      }

      return durationRef.current;
    },
    [applyDuration]
  );

  useEffect(() => {
    const fromMeta = readMediaFileDuration(mediaFile);
    const fromCache = readCachedAudioDuration(filePath);
    const nextDuration = fromMeta > 0 ? fromMeta : fromCache;
    durationRef.current = nextDuration;
    setDuration(nextDuration);
    setCurrentTime(0);
    setIsPlaying(false);
    setError(null);
    setIsReady(false);
    setPeaks([]);
  }, [audioUrl, mediaFile, filePath]);

  useEffect(() => {
    if (!audioUrl) return undefined;

    const loadId = ++loadIdRef.current;
    let disposed = false;
    let audio = null;

    const isStale = () => disposed || loadId !== loadIdRef.current;

    const init = async () => {
      try {
        const { blobUrl, arrayBuffer } = await fetchAudioBlob(
          audioUrl,
          contentType || 'audio/webm'
        );

        if (isStale()) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        blobUrlRef.current = blobUrl;

        if (!durationRef.current) {
          const fromMeta = readMediaFileDuration(mediaFile);
          const fromCache = readCachedAudioDuration(filePath);
          if (fromMeta > 0) applyDuration(fromMeta);
          else if (fromCache > 0) applyDuration(fromCache);
        }

        const { peaks: nextPeaks, duration: decodedDuration } = await analyzeAudioBuffer(
          arrayBuffer,
          filePath || audioUrl
        );
        if (isStale()) return;

        setPeaks(Array.isArray(nextPeaks) ? nextPeaks : []);
        if (decodedDuration > 0) {
          applyDuration(decodedDuration);
        }

        audio = new Audio();
        audio.preload = 'auto';
        audio.src = blobUrl;
        audioRef.current = audio;

        if (!durationRef.current) {
          await tryResolveDurationFromAudio(audio, { probe: true });
        } else {
          await tryResolveDurationFromAudio(audio);
        }

        if (isStale()) return;

        const onTimeUpdate = () => {
          if (isStale()) return;
          setCurrentTime(audio.currentTime);
          if (isValidAudioDuration(audio.duration)) {
            void tryResolveDurationFromAudio(audio);
          }
        };

        const onPlay = async () => {
          setIsPlaying(true);
          if (!durationRef.current) {
            await tryResolveDurationFromAudio(audio, { probe: true });
          }
        };

        const onPause = () => setIsPlaying(false);

        const onEnded = () => {
          setIsPlaying(false);
          if (!durationRef.current) {
            const finalDuration = isValidAudioDuration(audio.duration)
              ? audio.duration
              : audio.currentTime;
            if (finalDuration > 0) {
              applyDuration(finalDuration);
            }
          }
          setCurrentTime(0);
        };

        const onAudioMetadata = () => {
          void tryResolveDurationFromAudio(audio);
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('loadedmetadata', onAudioMetadata);
        audio.addEventListener('durationchange', onAudioMetadata);
        audio.addEventListener('error', () => {
          if (!isStale()) {
            setError('Ошибка при загрузке аудио');
          }
        });

        if (!isStale()) {
          setIsReady(true);
        }
      } catch (loadError) {
        console.error('AudioMessage load failed:', loadError);
        if (!isStale()) {
          setError('Ошибка при загрузке аудио');
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [
    audioUrl,
    contentType,
    filePath,
    mediaFile,
    applyDuration,
    tryResolveDurationFromAudio,
  ]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (playError) {
      console.warn('Ошибка при воспроизведении:', playError);
      setError('Ошибка при воспроизведении');
    }
  };

  const handleSeek = useCallback((ratio) => {
    const audio = audioRef.current;
    const total = durationRef.current;
    if (!audio || !isValidAudioDuration(total)) return;
    audio.currentTime = ratio * total;
    setCurrentTime(audio.currentTime);
  }, []);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const totalTimeLabel =
    duration > 0 ? formatTime(duration) : isPlaying ? '…' : '0:00';

  return (
    <div ref={rootRef} className={`audio-message ${isPlaying ? 'playing' : ''}`}>
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <button
            onClick={togglePlay}
            className="play-pause-button"
            type="button"
            disabled={!isReady && duration <= 0}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? (
              <PauseIcon sx={{ width: 24, height: 24 }} />
            ) : (
              <PlayArrowIcon sx={{ width: 24, height: 24 }} />
            )}
          </button>
          <BarWaveform
            peaks={peaks}
            progress={progress}
            className="audio-message-waveform"
            onSeek={handleSeek}
            aria-label="Форма волны голосового сообщения"
          />
          <span className="duration">
            {formatTime(currentTime)} / {totalTimeLabel}
          </span>
        </>
      )}
    </div>
  );
};

export default AudioMessage;
